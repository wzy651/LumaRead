import { useEffect, useRef, useState } from 'react'
import { ConfiguredContextProvider } from './context-provider'
import { clearSessionKey, getSessionKey, readAISettings, saveAISettings } from './settings'
import type { AISettings } from './types'

export function LearningSettingsForm({ onSaved }: { onSaved?: () => void }) {
  const [settings, setSettings] = useState(readAISettings)
  const [apiKey, setApiKey] = useState(getSessionKey)
  const [status, setStatus] = useState('')
  const [testing, setTesting] = useState(false)
  const controller = useRef<AbortController | undefined>(undefined)
  useEffect(() => () => controller.current?.abort(), [])
  function save() {
    try { saveAISettings(settings, apiKey); setStatus('设置已保存。API Key 仅用于本次应用会话。'); return true }
    catch (error) { setStatus(error instanceof Error ? error.message : '设置无法保存，请检查本地存储权限。'); return false }
  }
  async function test() {
    if (!save()) return
    controller.current?.abort(); const request = new AbortController(); controller.current = request
    setTesting(true); setStatus('正在用一条测试句子检查服务…')
    try {
      const result = await new ConfiguredContextProvider().explain({ text: 'bank', sentence: 'She sat on the bank of the river.', resourceKey: 'connection-test', bookTitle: '' }, 'context', request.signal)
      if (!request.signal.aborted) setStatus(`连接成功：${result}`)
    } catch (error) { if (!request.signal.aborted) setStatus(error instanceof Error ? error.message : '连接失败，请检查设置。') }
    finally { if (!request.signal.aborted) setTesting(false) }
  }
  return <form className="learning-settings" lang="zh-CN" onSubmit={(event) => { event.preventDefault(); if (save()) onSaved?.() }}>
    <p>基础英汉查词离线可用。语境解释只在你主动点击时，将所选文字和当前原句发送到下面的服务。</p>
    <label>接口协议<select value={settings.protocol} onChange={(event) => { setApiKey(''); setSettings((current) => ({ ...current, protocol: event.target.value as AISettings['protocol'], baseUrl: event.target.value === 'ollama' ? 'http://localhost:11434' : 'https://api.deepseek.com', model: '' })) }}><option value="compatible">兼容 Chat Completions 的服务</option><option value="ollama">本机 Ollama</option></select></label>
    <label>服务地址<input autoComplete="off" spellCheck={false} type="url" required value={settings.baseUrl} onChange={(event) => { setApiKey(''); setSettings((current) => ({ ...current, baseUrl: event.target.value })) }} placeholder="https://api.deepseek.com" /></label>
    <small>填写服务商的 API Base URL，可包含 /v1；请勿填写网页聊天地址。更换地址后请重新填写对应密钥。</small>
    <label>模型 ID<input autoComplete="off" spellCheck={false} required value={settings.model} onChange={(event) => setSettings((current) => ({ ...current, model: event.target.value }))} placeholder="填写服务商提供或本机已安装的模型 ID" /></label>
    {settings.protocol === 'compatible' && <label>API Key<input autoComplete="off" spellCheck={false} type="password" value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder="仅保存在本次应用会话" /></label>}
    <small>密钥不写入 localStorage、查询记录或备份。关闭应用后需要重新填写。测试连接会发送上面的测试句子，可能产生少量 API 用量。</small>
    <div className="learning-actions"><button type="submit">保存设置</button><button disabled={testing} onClick={() => { void test() }} type="button">{testing ? '测试中…' : '测试连接'}</button><button type="button" onClick={() => { controller.current?.abort(); setTesting(false); clearSessionKey(); setApiKey(''); setStatus('已清除本次会话的密钥。') }}>清除密钥</button></div>
    {status && <p role="status" className="learning-status">{status}</p>}
  </form>
}
