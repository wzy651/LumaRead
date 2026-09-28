package com.lumaread.reader

import android.os.Bundle
import android.webkit.WebView
import android.view.View
import androidx.activity.enableEdgeToEdge
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat

class MainActivity : TauriActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    enableEdgeToEdge()
    super.onCreate(savedInstanceState)
  }
  override fun onWebViewCreate(webView: WebView) {
    super.onWebViewCreate(webView)
    // Keep WebView content clear of status/navigation bars and the IME. This also
    // works on WebViews that do not expose Android cutouts via CSS env().
    val container = findViewById<View>(android.R.id.content)
    ViewCompat.setOnApplyWindowInsetsListener(container) { view, insets ->
      val bars = insets.getInsets(WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout())
      val keyboard = insets.getInsets(WindowInsetsCompat.Type.ime())
      view.setPadding(bars.left, bars.top, bars.right, maxOf(bars.bottom, keyboard.bottom))
      WindowInsetsCompat.CONSUMED
    }
    ViewCompat.requestApplyInsets(container)
  }
}
