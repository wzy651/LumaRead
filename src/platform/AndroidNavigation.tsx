import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { getRuntime } from './runtime'
import { handleAndroidBack } from './android-back'

export function AndroidNavigation() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  useEffect(() => {
    if (getRuntime() !== 'tauri-android') return
    let disposed = false
    let remove: (() => void) | undefined
    void import('@tauri-apps/api/app').then(({ onBackButtonPress }) => onBackButtonPress(() => {
      if (disposed) return
      handleAndroidBack(pathname, () => navigate('/', { replace: true }), () => { void import('@tauri-apps/api/core').then(({ invoke }) => invoke('close_mobile_app')).catch(() => undefined) })
    })).then((listener) => {
      const unregister = () => { void listener.unregister().catch(() => undefined) }
      if (disposed) unregister(); else remove = unregister
    }).catch(() => undefined)
    return () => { disposed = true; remove?.() }
  }, [pathname, navigate])
  return null
}
