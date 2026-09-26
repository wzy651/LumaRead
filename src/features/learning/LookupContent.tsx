import { useEffect, useRef, useState } from 'react'
import { Settings2, Volume2 } from 'lucide-react'
import { lookupDictionary } from './dictionary'
import { ConfiguredContextProvider } from './context-provider'
import { isContextConfigured } from './settings'
import { recordLookup, setLearningStatus } from './repository'
import type { DictionaryEntry, HelpMode, LearningTerm, ReadingExcerpt } from './types'

const labels: Record<HelpMode, string> = { context: '这里是什么意思', translate: '原句翻译', simplify: 'Simple English', detail: '进一步理解' }
export function LookupContent({ excerpt, onSettings, onClose }: { excerpt: ReadingExcerpt; onSettings: () => void; onClose: () => void }) {
  const [entry, setEntry] = useState<DictionaryEntry>(); const [loading, setLoading] = useState(true); const [dictionaryError, setDictionaryError] = useState('')
  const [term, setTerm] = useState<LearningTerm>(); const [previous, setPrevious] = useState<ReadingExcerpt>(); const [storageNotice, setStorageNotice] = useState('')
  const [mode, setMode] = useState<HelpMode>('context'); const [answer, setAnswer] = useState(''); const [aiError, setAiError] = useState(''); const [busy, setBusy] = useState(false)
  const [more, setMore] = useState(false); const [retry, setRetry] = useState(0)
  const controller = useRef<AbortController | undefined>(undefined)
  const saved = useRef<ReturnType<typeof recordLookup> | undefined>(undefined)
  const cache = useRef(new Map<HelpMode, string>())
  useEffect(() => {
    let current = true
    void lookupDictionary(excerpt.text).then((result) => { if (current) { setEntry(result); setDictionaryError('') } }).catch(() => { if (current) setDictionaryError('本地词库无法读取，请重试。') }).finally(() => { if (current) setLoading(false) })
    if (excerpt.text.length <= 120) {
      saved.current ??= recordLookup(excerpt)
      void saved.current.then((result) => { if (current) { setTerm(result.term); setPrevious(result.previous) } }).catch(() => { if (current) setStorageNotice('本次查询未能保存，你仍可以继续阅读。') })
    }
    return () => { current = false }
  }, [excerpt, retry])
  useEffect(() => {
    const changed = () => { cache.current.clear(); controller.current?.abort(); setBusy(false); setAnswer(''); setAiError('') }
    window.addEventListener('learning-settings-changed', changed)
    return () => { controller.current?.abort(); if ('speechSynthesis' in window) window.speechSynthesis.cancel(); window.removeEventListener('learning-settings-changed', changed) }
  }, [])
  async function explain(nextMode: HelpMode) {
    if (!isContextConfigured()) { onSettings(); return }
    controller.current?.abort(); setMode(nextMode); setAiError(''); setAnswer('')
    const cached = cache.current.get(nextMode)
    if (cached) { setAnswer(cached); setBusy(false); return }
    const request = new AbortController(); controller.current = request; setBusy(true)
    try {
      const result = await new ConfiguredContextProvider().explain(excerpt, nextMode, request.signal)
      if (!request.signal.aborted) { cache.current.set(nextMode, result); setAnswer(result) }
    } catch (error) { if (!request.signal.aborted) setAiError(error instanceof Error ? error.message : '解释暂时不可用，请重试。') }
    finally { if (controller.current === request) setBusy(false) }
  }
  async function learn() {
    try {
      await saved.current
      const status = term?.status === 'learning' ? 'unknown' : 'learning'
      await setLearningStatus(excerpt.text, status); setTerm((current) => current ? { ...current, status } : current); setStorageNotice('')
    } catch { setStorageNotice('暂时无法保存学习状态，请稍后重试。') }
  }
  function speak() { if (!('speechSynthesis' in window)) return; window.speechSynthesis.cancel(); const speech = new SpeechSynthesisUtterance(excerpt.text); speech.lang = 'en-US'; speech.rate = 0.9; window.speechSynthesis.speak(speech) }
  return <div className="lookup-content" lang="zh-CN">
    <div className="lookup-heading"><div><h2 lang={excerpt.text.length > 80 ? 'zh-CN' : 'en'}>{excerpt.text.length > 80 ? '句子理解' : excerpt.text}</h2>{entry?.phonetic && <p className="lookup-phonetic">/{entry.phonetic}/</p>}</div><div className="lookup-heading__actions">{'speechSynthesis' in window && <button type="button" aria-label="朗读所选文字" onClick={speak}><Volume2 size={18} /></button>}<button type="button" aria-label="解释服务设置" title="解释服务设置" onClick={onSettings}><Settings2 size={18} /></button></div></div>
    {entry && entry.word.toLowerCase() !== excerpt.text.toLowerCase() && <p className="lookup-source">词形对应：<span lang="en">{entry.word}</span></p>}
    <div aria-live="polite">{loading ? <p>正在读取本地词义…</p> : entry ? <p className="lookup-definition">{entry.translation.split('\n').slice(0, more ? undefined : 3).join('\n')}</p> : dictionaryError ? <p>{dictionaryError} <button type="button" onClick={() => { setLoading(true); setRetry((value) => value + 1) }}>重试</button></p> : <p className="lookup-muted">{excerpt.text.length > 80 ? '可以翻译原句，或用简单英文理解这段文字。' : '本地词库暂未收录，可使用语境解释理解这个表达。'}</p>}</div>
    {entry && <><div className="lookup-dictionary-meta"><button className="lookup-text-button" type="button" onClick={() => setMore((value) => !value)}>{more ? '收起词典释义' : '更多词典释义'}</button><small className="lookup-source">ECDICT · 离线词典 · 通用释义</small></div>{more && entry.definition && <p className="lookup-definition" lang="en">{entry.definition}</p>}</>}
    <blockquote className="lookup-context" lang="en">{excerpt.sentence}<small className="lookup-source">{excerpt.bookTitle}{excerpt.pageNumber ? ` · Page ${excerpt.pageNumber}` : ''}</small></blockquote>
    <div className="lookup-help-actions"><button type="button" onClick={() => { void explain('context') }}>这里是什么意思</button><button type="button" onClick={() => { void explain('translate') }}>原句翻译</button><button type="button" onClick={() => { void explain('simplify') }}>Simple English</button></div>
    {(busy || answer || aiError) && <section className="lookup-answer" aria-label={labels[mode]} aria-live="polite"><h3>{labels[mode]}</h3>{busy ? <><p>正在理解原句…</p><button type="button" onClick={() => { controller.current?.abort(); setBusy(false) }}>取消</button></> : aiError ? <><p role="alert">{aiError}</p><button type="button" onClick={() => { void explain(mode) }}>重试</button></> : <p lang={mode === 'simplify' ? 'en' : 'zh-CN'}>{answer}</p>}{answer && <><small>AI 辅助解释 · 仅基于所选原文，可能有误</small>{mode !== 'detail' && <button className="lookup-text-button" type="button" onClick={() => { void explain('detail') }}>Explain more</button>}</>}</section>}
    {previous && (previous.sentence !== excerpt.sentence || previous.resourceKey !== excerpt.resourceKey) && <details className="lookup-previous"><summary>你之前见过这个表达</summary><p lang="en">{previous.sentence}</p><small>{previous.bookTitle}</small></details>}
    {storageNotice && <p className="lookup-muted" role="status">{storageNotice}</p>}
    <div className="learning-actions"><button className="lookup-done" type="button" onClick={onClose}>懂了，继续读</button>{term && <button type="button" aria-pressed={term.status === 'learning'} onClick={() => { void learn() }}>{term.status === 'learning' ? '已加入学习 · 撤销' : '加入学习'}</button>}</div>
    <div className="lookup-footer"><small>查询不会自动加入复习</small></div>
  </div>
}
