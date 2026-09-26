import type { AISettings } from './types'

const key = 'lumaread-context-settings:v1'
let sessionKey = ''
export const defaultAISettings: AISettings = { protocol: 'compatible', baseUrl: 'https://api.deepseek.com', model: '' }
export function readAISettings(): AISettings {
  try {
    const value = JSON.parse(localStorage.getItem(key) ?? 'null') as Partial<AISettings> | null
    if (value && (value.protocol === 'compatible' || value.protocol === 'ollama') && typeof value.baseUrl === 'string' && typeof value.model === 'string') return { protocol: value.protocol, baseUrl: value.baseUrl, model: value.model }
  } catch { /* Settings may be unavailable; the local dictionary still works. */ }
  return { ...defaultAISettings }
}
export function contextEndpoint(settings: AISettings) {
  let url: URL
  try { url = new URL(settings.baseUrl.trim()) } catch { throw new Error('请输入完整的服务地址，例如 https://api.deepseek.com。') }
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
  if (!(url.protocol === 'https:' || (url.protocol === 'http:' && local)) || url.username || url.password || url.search || url.hash) throw new Error('服务地址须使用 HTTPS；本机 localhost 可使用 HTTP。地址不能包含密钥、参数或用户信息。')
  const path = settings.protocol === 'ollama' ? '/api/chat' : '/chat/completions'
  const basePath = url.pathname.replace(/\/+$/, '')
  url.pathname = basePath.endsWith(path) ? basePath : basePath + path
  return url.toString()
}
export function saveAISettings(settings: AISettings, apiKey: string) {
  contextEndpoint(settings)
  if (!settings.model.trim() || settings.model.length > 160) throw new Error('请输入服务商提供的模型 ID。')
  const safe = { protocol: settings.protocol, baseUrl: settings.baseUrl.trim(), model: settings.model.trim() }
  // Deliberately whitelist persisted fields. Credentials never enter browser storage.
  localStorage.setItem(key, JSON.stringify(safe))
  sessionKey = apiKey.trim()
  window.dispatchEvent(new Event('learning-settings-changed'))
}
export function getSessionKey() { return sessionKey }
export function clearSessionKey() { sessionKey = ''; window.dispatchEvent(new Event('learning-settings-changed')) }
export function isContextConfigured() { const settings = readAISettings(); return Boolean(settings.model && (settings.protocol === 'ollama' || sessionKey)) }
