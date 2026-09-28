package com.lumaread.reader

import android.app.Activity
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import android.util.AtomicFile
import android.util.Base64
import app.tauri.annotation.Command
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.JSObject
import app.tauri.plugin.Plugin
import org.json.JSONObject
import java.io.File
import java.net.HttpURLConnection
import java.net.URI
import java.security.KeyStore
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

/** No command returns a stored secret. Requests use it only inside this process. */
@TauriPlugin
class ReadingMobilePlugin(private val activity: Activity) : Plugin(activity) {
    private val alias = "lumaread.context.v1"
    private val vaultLock = Any()
    private val vault get() = AtomicFile(File(activity.noBackupFilesDir, "reading-credential.enc"))
    private val pool = Executors.newFixedThreadPool(4)
    private val ui = Handler(Looper.getMainLooper())
    private val requests = ConcurrentHashMap<String, Request>()
    private class Request { val cancelled = AtomicBoolean(false); @Volatile var connection: HttpURLConnection? = null }

    private fun endpoint(value: String): String {
        val uri = URI(value)
        require(uri.scheme == "https" || uri.scheme == "http" && uri.host in listOf("localhost", "127.0.0.1", "[::1]", "::1"))
        require(!uri.host.isNullOrBlank() && uri.rawUserInfo == null && uri.rawQuery == null && uri.rawFragment == null)
        require(uri.path.endsWith("/chat/completions") || uri.path.endsWith("/api/chat"))
        return uri.toASCIIString()
    }
    private fun key(create: Boolean): SecretKey? {
        val store = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        (store.getKey(alias, null) as? SecretKey)?.let { return it }
        if (!create) return null
        return KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore").run {
            init(KeyGenParameterSpec.Builder(alias, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setKeySize(256).setRandomizedEncryptionRequired(true).build())
            generateKey()
        }
    }
    private fun storedKey(address: String): String? = synchronized(vaultLock) {
        if (!vault.baseFile.exists()) return@synchronized null
        require(vault.baseFile.length() <= 20000)
        val record = JSONObject(String(vault.readFully(), Charsets.UTF_8))
        if (record.getString("endpoint") != address) return@synchronized null
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.DECRYPT_MODE, key(false) ?: error("missing key"), GCMParameterSpec(128, Base64.decode(record.getString("iv"), Base64.NO_WRAP)))
        cipher.updateAAD(address.toByteArray(Charsets.UTF_8))
        val plain = cipher.doFinal(Base64.decode(record.getString("ciphertext"), Base64.NO_WRAP))
        try { String(plain, Charsets.UTF_8) } finally { plain.fill(0) }
    }
    @Command fun credentialStatus(invoke: Invoke) {
        pool.execute { try { val address = endpoint(invoke.getArgs().getString("endpoint")); invoke.resolve(JSObject().put("available", storedKey(address) != null)) } catch (_: Exception) { invoke.reject("credential-unavailable") } }
    }
    @Command fun saveCredential(invoke: Invoke) {
        pool.execute {
            try {
                val args = invoke.getArgs(); val address = endpoint(args.getString("endpoint")); val secret = args.getString("apiKey").trim()
                require(secret.isNotEmpty() && secret.length <= 4096 && !secret.contains('\r') && !secret.contains('\n'))
                synchronized(vaultLock) {
                    val cipher = Cipher.getInstance("AES/GCM/NoPadding"); cipher.init(Cipher.ENCRYPT_MODE, key(true))
                    cipher.updateAAD(address.toByteArray(Charsets.UTF_8))
                    val plain = secret.toByteArray(Charsets.UTF_8)
                    val bytes = try { cipher.doFinal(plain) } finally { plain.fill(0) }
                    val record = JSONObject().put("endpoint", address).put("iv", Base64.encodeToString(cipher.iv, Base64.NO_WRAP)).put("ciphertext", Base64.encodeToString(bytes, Base64.NO_WRAP))
                    val file = vault; val stream = file.startWrite()
                    try { stream.write(record.toString().toByteArray(Charsets.UTF_8)); file.finishWrite(stream) } catch (error: Exception) { file.failWrite(stream); throw error }
                }
                invoke.resolve()
            } catch (_: Exception) { invoke.reject("credential-save-failed") }
        }
    }
    @Command fun clearCredential(invoke: Invoke) {
        pool.execute {
            try {
                synchronized(vaultLock) {
                    vault.delete()
                    val store = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
                    if (store.containsAlias(alias)) store.deleteEntry(alias)
                    check(!vault.baseFile.exists())
                }
                invoke.resolve()
            } catch (_: Exception) { invoke.reject("credential-clear-failed") }
        }
    }
    @Command fun requestContext(invoke: Invoke) {
        val args = invoke.getArgs(); val id = args.optString("requestId")
        if (id.isEmpty() || id.length > 80 || requests.size >= 4) { invoke.reject("context-busy"); return }
        val request = Request()
        if (requests.putIfAbsent(id, request) != null) { invoke.reject("context-busy"); return }
        pool.execute {
            try {
                val address = endpoint(args.getString("endpoint")); val body = args.getString("body")
                require(body.toByteArray(Charsets.UTF_8).size <= 24000)
                val payload = JSONObject(body); require(payload.get("model") is String && payload.get("stream") == false); payload.getJSONArray("messages")
                val supplied = args.optString("apiKey"); require(supplied.length <= 4096 && !supplied.contains('\r') && !supplied.contains('\n'))
                val secret = if (address.endsWith("/api/chat")) "" else supplied.ifEmpty { storedKey(address) ?: "" }
                if (request.cancelled.get()) { invoke.reject("context-cancelled"); return@execute }
                val connection = URI(address).toURL().openConnection() as HttpURLConnection
                request.connection = connection
                connection.requestMethod = "POST"; connection.instanceFollowRedirects = false
                connection.connectTimeout = 10000; connection.readTimeout = 60000; connection.useCaches = false; connection.doOutput = true
                connection.setRequestProperty("Content-Type", "application/json")
                if (secret.isNotEmpty()) connection.setRequestProperty("Authorization", "Bearer $secret")
                val bytes = body.toByteArray(Charsets.UTF_8); connection.setFixedLengthStreamingMode(bytes.size)
                if (request.cancelled.get()) { invoke.reject("context-cancelled"); return@execute }
                connection.outputStream.use { it.write(bytes) }
                val status = connection.responseCode
                var response = ""
                if (status in 200..299) {
                    connection.inputStream.use { input ->
                        val output = java.io.ByteArrayOutputStream(); val buffer = ByteArray(4096)
                        while (true) { val count = input.read(buffer); if (count < 0) break; require(output.size() + count <= 100000); if (request.cancelled.get()) error("cancelled"); output.write(buffer, 0, count) }
                        response = output.toString("UTF-8")
                    }
                }
                if (request.cancelled.get()) invoke.reject("context-cancelled") else invoke.resolve(JSObject().put("status", status).put("body", response))
            } catch (_: java.net.SocketTimeoutException) { invoke.reject("context-timeout") }
              catch (_: Exception) { invoke.reject(if (request.cancelled.get()) "context-cancelled" else "context-network") }
            finally { request.connection?.disconnect(); requests.remove(id, request) }
        }
    }
    @Command fun cancelContext(invoke: Invoke) { requests[invoke.getArgs().optString("requestId")]?.let { it.cancelled.set(true); it.connection?.disconnect() }; invoke.resolve() }

    private var tts: TextToSpeech? = null
    private var speechReady = false
    private var speechInvoke: Invoke? = null
    private var speechId: String? = null
    private var pendingText = ""
    private var slow = false
    private var speechTimeout: Runnable? = null
    private fun finishSpeech(id: String?, error: String? = null) {
        if (id != speechId) return
        val invoke = speechInvoke ?: return
        speechInvoke = null; speechId = null; speechTimeout?.let(ui::removeCallbacks); speechTimeout = null
        if (error == null) invoke.resolve() else invoke.reject(error)
    }
    private fun playPending() {
        val engine = tts ?: return; val id = speechId ?: return
        val voice = engine.voices?.filter { it.locale.language == "en" && !it.isNetworkConnectionRequired && !it.features.contains(TextToSpeech.Engine.KEY_FEATURE_NOT_INSTALLED) }?.sortedBy { if (it.locale.country == "US") 0 else 1 }?.firstOrNull()
        if (voice == null) { finishSpeech(id, "speech-no-english-voice"); return }
        engine.voice = voice; engine.setSpeechRate(if (slow) 0.65f else 0.9f)
        engine.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
            override fun onStart(utteranceId: String?) {}
            override fun onDone(utteranceId: String?) { ui.post { finishSpeech(utteranceId) } }
            @Deprecated("Platform override") override fun onError(utteranceId: String?) { ui.post { finishSpeech(utteranceId, "speech-unavailable") } }
            override fun onError(utteranceId: String?, errorCode: Int) { ui.post { finishSpeech(utteranceId, "speech-unavailable") } }
        })
        if (engine.speak(pendingText, TextToSpeech.QUEUE_FLUSH, Bundle(), id) == TextToSpeech.ERROR) finishSpeech(id, "speech-unavailable")
    }
    @Command fun speak(invoke: Invoke) {
        val args = invoke.getArgs(); val id = args.optString("requestId"); val text = args.optString("text")
        if (id.isEmpty() || id.length > 80 || text.isBlank() || text.length > 600) { invoke.reject("speech-invalid-text"); return }
        finishSpeech(speechId, "speech-cancelled"); tts?.stop()
        speechInvoke = invoke; speechId = id; pendingText = text; slow = args.optBoolean("slow")
        speechTimeout = Runnable { tts?.stop(); finishSpeech(id, "speech-unavailable") }.also { ui.postDelayed(it, 90000) }
        if (speechReady) playPending()
        else if (tts == null) {
            tts = TextToSpeech(activity.applicationContext) { status -> ui.post {
                if (status == TextToSpeech.SUCCESS) { speechReady = true; playPending() }
                else { finishSpeech(speechId, "speech-unavailable"); tts?.shutdown(); tts = null }
            } }
        }
    }
    @Command fun cancelSpeech(invoke: Invoke) { val id = invoke.getArgs().optString("requestId"); if (id == speechId) { tts?.stop(); finishSpeech(id, "speech-cancelled") }; invoke.resolve() }
    @Command fun closeApp(invoke: Invoke) { invoke.resolve(); activity.finish() }
    override fun onPause() { tts?.stop(); finishSpeech(speechId, "speech-cancelled") }
    override fun onDestroy() { onPause(); tts?.shutdown(); tts = null; for (request in requests.values) { request.cancelled.set(true); request.connection?.disconnect() }; pool.shutdownNow() }
}
