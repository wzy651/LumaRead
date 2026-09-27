import { useEffect, useRef, useState } from 'react'
import { Square, Volume2 } from 'lucide-react'
import { pronounce, type PronunciationSpeed } from './pronunciation'

export function PronunciationControls({ text }: { text: string }) {
  const [playing, setPlaying] = useState<PronunciationSpeed>(); const [error, setError] = useState('')
  const current = useRef<AbortController | undefined>(undefined)
  useEffect(() => () => current.current?.abort(), [text])
  function stop() { current.current?.abort(); current.current = undefined; setPlaying(undefined) }
  async function play(speed: PronunciationSpeed) {
    current.current?.abort()
    const request = new AbortController(); current.current = request; setError(''); setPlaying(speed)
    try { await pronounce(text, speed, request.signal) }
    catch (error) { if (!request.signal.aborted) setError(error instanceof Error ? error.message : '朗读暂时不可用。') }
    finally { if (current.current === request) { setPlaying(undefined); current.current = undefined } }
  }
  return <div className="lookup-pronunciation">
    <div className="lookup-pronunciation__buttons"><button type="button" aria-label="播放英语发音" aria-pressed={playing === 'normal'} onClick={() => { void play('normal') }}><Volume2 size={16} aria-hidden="true" /> 发音</button><button type="button" aria-label="慢速播放英语发音" aria-pressed={playing === 'slow'} onClick={() => { void play('slow') }}>慢速</button>{playing && <button type="button" aria-label="停止发音" onClick={stop}><Square size={14} aria-hidden="true" /> 停止</button>}</div>
    <small className="lookup-source" role="status">{error || (playing ? '正在播放所选文字…' : '系统英语语音 · 不使用 AI 额度')}</small>
  </div>
}
