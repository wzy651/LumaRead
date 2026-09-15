import { Minus, Plus } from 'lucide-react'
import type { Dispatch, SetStateAction } from 'react'
import { useTheme } from '../../../app/providers/useTheme'
import type { ReaderSettings } from '../useReaderSettings'

export function ReadingSettingsPanel({ settings, setSettings }: { settings: ReaderSettings; setSettings: Dispatch<SetStateAction<ReaderSettings>> }) {
  const { setTheme, theme } = useTheme()
  const changeScale = (amount: number) => setSettings((current) => ({ ...current, fontScale: Math.min(1.2, Math.max(0.9, Number((current.fontScale + amount).toFixed(2)))) }))
  return <section aria-labelledby="reading-settings-title" className="reading-settings">
    <h2 id="reading-settings-title">Reading settings</h2>
    <div className="reading-settings__size"><span>Text size</span><div><button aria-label="Decrease text size" disabled={settings.fontScale <= 0.9} onClick={() => changeScale(-0.05)} type="button"><Minus aria-hidden="true" size={17} /></button><output aria-label="Current text size">{Math.round(settings.fontScale * 18)}px</output><button aria-label="Increase text size" disabled={settings.fontScale >= 1.2} onClick={() => changeScale(0.05)} type="button"><Plus aria-hidden="true" size={17} /></button></div></div>
    <fieldset><legend>Font</legend><div className="reading-settings__choices"><button aria-pressed={settings.fontFamily === 'serif'} className={settings.fontFamily === 'serif' ? 'is-selected' : ''} onClick={() => setSettings((current) => ({ ...current, fontFamily: 'serif' }))} type="button">Serif</button><button aria-pressed={settings.fontFamily === 'sans'} className={settings.fontFamily === 'sans' ? 'is-selected' : ''} onClick={() => setSettings((current) => ({ ...current, fontFamily: 'sans' }))} type="button">Sans</button></div></fieldset>
    <fieldset><legend>Line height</legend><div className="reading-settings__choices"><button aria-pressed={settings.lineHeight === 'compact'} className={settings.lineHeight === 'compact' ? 'is-selected' : ''} onClick={() => setSettings((current) => ({ ...current, lineHeight: 'compact' }))} type="button">Compact</button><button aria-pressed={settings.lineHeight === 'comfortable'} className={settings.lineHeight === 'comfortable' ? 'is-selected' : ''} onClick={() => setSettings((current) => ({ ...current, lineHeight: 'comfortable' }))} type="button">Comfortable</button><button aria-pressed={settings.lineHeight === 'relaxed'} className={settings.lineHeight === 'relaxed' ? 'is-selected' : ''} onClick={() => setSettings((current) => ({ ...current, lineHeight: 'relaxed' }))} type="button">Relaxed</button></div></fieldset>
    <fieldset><legend>Theme</legend><div className="reading-settings__choices"><button aria-pressed={theme === 'light'} className={theme === 'light' ? 'is-selected' : ''} onClick={() => setTheme('light')} type="button">Light</button><button aria-pressed={theme === 'dark'} className={theme === 'dark' ? 'is-selected' : ''} onClick={() => setTheme('dark')} type="button">Dark</button></div></fieldset>
  </section>
}
