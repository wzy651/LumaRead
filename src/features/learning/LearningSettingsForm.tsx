import { useEffect, useRef, useState } from 'react'
import { ConfiguredContextProvider } from './context-provider'
import { canRememberCredential, clearRememberedCredential, getSessionKey, readAISettings, refreshCredential, rememberCredential, saveAISettings } from './settings'
import type { AISettings } from './types'

export function LearningSettingsForm({ onSaved }: { onSaved?: () => void }) {
  const [settings, setSettings] = useState(readAISettings)
  const [apiKey, setApiKey] = useState(getSessionKey)
  const [status, setStatus] = useState('')
  const [testing, setTesting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [remember, setRemember] = useState(canRememberCredential)
  const [remembered, setRemembered] = useState(false)
  const controller = useRef<AbortController | undefined>(undefined)
  useEffect(() => () => controller.current?.abort(), [])
  useEffect(() => { let active = true; void refreshCredential(settings).then((value) => { if (active) setRemembered(value) }).catch(() => { if (active) setRemembered(false) }); return () => { active = false } }, [settings])
  async function save() {
    setSaving(true)
    try {
      saveAISettings(settings, apiKey)
      const stored = await rememberCredential(settings, apiKey, remember)
      setRemembered(stored)
      setStatus(stored ? '已安全记住密钥。下次打开应用可直接使用，可随时清除。' : '设置已保存。密钥仅用于本次会话。')
      return true
    }
    catch (error) { setStatus(error instanceof Error ? error.message : '设置无法保存，请检查本地存储权限。'); return false }
    finally { setSaving(false) }
  }
  async function test() {
    if (!await save()) return
    controller.current?.abort(); const request = new AbortController(); controller.current = request
    setTesting(true); setStatus('正在用一条测试句子检查服务…')
    try {
      const result = await new ConfiguredContextProvider().explain({ text: 'bank', sentence: 'She sat on the bank of the river.', resourceKey: 'connection-test', bookTitle: '' }, 'context', request.signal)
      if (!request.signal.aborted) setStatus(`连接成功：${result}`)
    } catch (error) { if (!request.signal.aborted) setStatus(error instanceof Error ? error.message : '连接失败，请检查设置。') }
    finally { if (!request.signal.aborted) setTesting(false) }
  }
  return <form className="learning-settings" lang="zh-CN" onSubmit={(event) => { event.preventDefault(); void save().then((success) => { if (success) onSaved?.() }) }}>
    <p>基础英汉查词离线可用。语境解释只在你主动点击时，将所选文字和当前原句发送到下面的服务。</p>
    <label>接口协议<select value={settings.protocol} onChange={(event) => { setApiKey(''); setSettings((current) => ({ ...current, protocol: event.target.value as AISettings['protocol'], baseUrl: event.target.value === 'ollama' ? 'http://localhost:11434' : 'https://api.deepseek.com', model: '' })) }}><option value="compatible">兼容 Chat Completions 的服务</option><option value="ollama">本机 Ollama</option></select></label>
    <label>服务地址<input autoComplete="off" spellCheck={false} type="url" required value={settings.baseUrl} onChange={(event) => { setApiKey(''); setSettings((current) => ({ ...current, baseUrl: event.target.value })) }} placeholder="https://api.deepseek.com" /></label>
    <small>填写服务商的 API Base URL，可包含 /v1；请勿填写网页聊天地址。更换地址后请重新填写对应密钥。</small>
    {settings.protocol === 'compatible' && /^https:\/\/api\.deepseek\.com(?:\/|$)/i.test(settings.baseUrl.trim()) && <small>DeepSeek 阅读解释采用非思考模式，优先简短、快速回答。测试连接与阅读内解释使用同一套请求配置。</small>}
    <label>模型 ID<input autoComplete="off" spellCheck={false} required value={settings.model} onChange={(event) => setSettings((current) => ({ ...current, model: event.target.value }))} placeholder="填写服务商提供或本机已安装的模型 ID" /></label>
    {settings.protocol === 'compatible' && <><label>API Key<input autoComplete="off" spellCheck={false} type="password" value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder={remembered ? '已安全保存；留空继续使用，填写可替换' : '填写服务商的 API Key'} /></label>{canRememberCredential() ? <label className="learning-check"><input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} />在此设备安全记住密钥</label> : <small>此平台目前仅支持会话密钥；不会以明文替代安全存储。</small>}</>}
    <small>Windows 使用系统加密，Android 使用系统 Keystore。密钥绑定此服务地址，不写入浏览器存储或阅读记录。测试连接会发送一条测试句子，可能产生少量 API 用量。</small>
    <div className="learning-actions"><button disabled={saving || testing} type="submit">保存设置</button><button disabled={saving || testing} onClick={() => { void test() }} type="button">{testing ? '测试中…' : '测试连接'}</button><button disabled={saving} type="button" onClick={() => { controller.current?.abort(); setTesting(false); setApiKey(''); void clearRememberedCredential().then(() => { setRemembered(false); setStatus('已清除会话及本机保存的密钥。') }).catch(() => setStatus('本机密钥未能清除，请重试。')) }}>清除密钥</button></div>
    {status && <p role="status" className="learning-status">{status}</p>}
  </form>
}
