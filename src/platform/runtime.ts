/** The one place that detects the host runtime. */
export type AppRuntime = 'browser' | 'tauri-windows' | 'tauri-android'

function hasTauriRuntime(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

export function getRuntime(): AppRuntime {
  if (!hasTauriRuntime()) return 'browser'
  return navigator.userAgent.toLowerCase().includes('android') ? 'tauri-android' : 'tauri-windows'
}

export function isTauriRuntime(): boolean {
  return getRuntime() !== 'browser'
}