import { getRuntime } from '../../platform/runtime'

export type PronunciationSpeed = 'normal' | 'slow'
export function formatPhonetic(phonetic: string): string {
  const value = phonetic.trim()
  return ((value.startsWith('/') && value.endsWith('/')) || (value.startsWith('[') && value.endsWith(']'))) ? value.slice(1, -1) : value
}
export function englishVoice(voices: SpeechSynthesisVoice[]) {
  const english = voices.filter((voice) => /^en(?:[-_]|$)/i.test(voice.lang))
  return english.find((voice) => voice.localService && /^en[-_]US$/i.test(voice.lang)) ?? english.find((voice) => voice.localService) ?? english[0]
}
export async function pronounce(text: string, speed: PronunciationSpeed, signal: AbortSignal): Promise<void> {
  signal.throwIfAborted()
  if (!text.trim() || text.length > 600) throw new Error('请先选择一个词或较短的句子。')
  if (getRuntime() !== 'browser') {
    const { invoke } = await import('@tauri-apps/api/core')
    signal.throwIfAborted()
    const requestId = crypto.randomUUID()
    const cancel = () => { void invoke('cancel_reading_speech', { requestId }).catch(() => undefined) }
    signal.addEventListener('abort', cancel, { once: true })
    try { await invoke('speak_reading_text', { requestId, text, slow: speed === 'slow' }); signal.throwIfAborted() }
    catch (error) {
      if (signal.aborted) throw new DOMException('Cancelled', 'AbortError')
      throw new Error(error === 'speech-no-english-voice' ? '系统没有可用的离线英语语音。请在系统文字转语音设置中下载英语语音后重试。' : '系统朗读未能完成，请检查音量和声音输出设备后重试。', { cause: error })
    } finally { signal.removeEventListener('abort', cancel) }
    return
  }
  if (!('speechSynthesis' in window) || !('SpeechSynthesisUtterance' in window)) throw new Error('当前设备没有可用的朗读引擎。音标和词义仍可使用。')
  const synthesis = window.speechSynthesis
  // Voices often arrive after the first render. Wait only after a user gesture.
  if (!synthesis.getVoices().length) await new Promise<void>((resolve, reject) => {
    const cleanup = () => { clearTimeout(timer); synthesis.removeEventListener('voiceschanged', ready); signal.removeEventListener('abort', cancel) }
    const ready = () => { cleanup(); resolve() }
    const cancel = () => { cleanup(); reject(new DOMException('Cancelled', 'AbortError')) }
    const timer = window.setTimeout(ready, 1200)
    synthesis.addEventListener('voiceschanged', ready); signal.addEventListener('abort', cancel, { once: true })
  })
  signal.throwIfAborted()
  const voice = englishVoice(synthesis.getVoices())
  if (!voice) throw new Error('当前设备未提供英语语音，请在系统语音设置中添加英语后重试。')
  return new Promise<void>((resolve, reject) => {
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.voice = voice; utterance.lang = voice.lang; utterance.rate = speed === 'slow' ? 0.65 : 0.9
    let finished = false
    const finish = (error?: Error) => {
      if (finished) return
      finished = true; clearTimeout(startTimer); clearTimeout(endTimer); signal.removeEventListener('abort', cancel)
      utterance.onend = null; utterance.onerror = null; utterance.onstart = null
      if (error) { synthesis.cancel(); reject(error) } else resolve()
    }
    const cancel = () => finish(new DOMException('Cancelled', 'AbortError'))
    const startTimer = window.setTimeout(() => finish(new Error('朗读引擎未响应，请检查系统英语语音和输出设备。')), 5000)
    const endTimer = window.setTimeout(() => finish(new Error('朗读超时，请尝试较短的句子。')), 90000)
    utterance.onstart = () => clearTimeout(startTimer)
    utterance.onend = () => finish()
    utterance.onerror = () => finish(new Error('朗读失败，请检查声音输出设备或更换系统英语语音。'))
    signal.addEventListener('abort', cancel, { once: true })
    synthesis.cancel()
    try { synthesis.speak(utterance) } catch { finish(new Error('当前设备无法播放英语语音，请检查系统语音设置。')) }
  })
}
