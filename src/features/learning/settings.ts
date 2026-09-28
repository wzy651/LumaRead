import type { AISettings } from './types'
import { getRuntime } from '../../platform/runtime'

const key = 'lumaread-context-settings:v1'
let sessionKey = ''
let sessionEndpoint = ''
let rememberedEndpoint = ''
export function canRememberCredential() { return getRuntime() !== 'browser' }
export async function refreshCredential(settings = readAISettings()) {
  if (!canRememberCredential() || settings.protocol !== 'compatible') return false
  const endpoint = contextEndpoint(settings)
  const { invoke } = await import('@tauri-apps/api/core')
  const remembered = await invoke<boolean>('reading_credential_status', { endpoint })
  rememberedEndpoint = remembered ? endpoint : ''
  return remembered
}
export async function rememberCredential(settings: AISettings, apiKey: string, remember: boolean) {
  if (!canRememberCredential()) return false
  const { invoke } = await import('@tauri-apps/api/core')
  if (!remember || settings.protocol === 'ollama') {
    await invoke('clear_reading_credential'); rememberedEndpoint = ''; return false
  }
  const endpoint = contextEndpoint(settings)
  if (apiKey.trim()) { await invoke('save_reading_credential', { endpoint, apiKey: apiKey.trim() }); rememberedEndpoint = endpoint; return true }
  return refreshCredential(settings)
}
export async function clearRememberedCredential() {
  clearSessionKey()
  if (canRememberCredential()) { const { invoke } = await import('@tauri-apps/api/core'); await invoke('clear_reading_credential') }
  rememberedEndpoint = ''
}
export async function ensureContextConfigured() {
  const settings = readAISettings()
  if (!settings.model) return false
  if (settings.protocol === 'ollama' || getSessionKey()) return true
  try { return await refreshCredential(settings) } catch { throw new Error('已保存的密钥无法读取，请在解释服务设置中重新保存。') }
}
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
  if (getRuntime() === 'tauri-android' && url.protocol === 'http:') throw new Error('手机版的模型服务请使用 HTTPS 地址。localhost 指手机本身，不是你的电脑。')
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
  sessionEndpoint = contextEndpoint(settings)
  window.dispatchEvent(new Event('learning-settings-changed'))
}
export function getSessionKey() { try { return sessionEndpoint === contextEndpoint(readAISettings()) ? sessionKey : '' } catch { return '' } }
export function clearSessionKey() { sessionKey = ''; sessionEndpoint = ''; rememberedEndpoint = ''; window.dispatchEvent(new Event('learning-settings-changed')) }
export function isContextConfigured() { const settings = readAISettings(); try { return Boolean(settings.model && (settings.protocol === 'ollama' || getSessionKey() || rememberedEndpoint === contextEndpoint(settings))) } catch { return false } }
