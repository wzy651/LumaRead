import { useEffect, useRef, useState } from 'react'
import { updateVocabularyState } from './repository'
import { getVocabularyState } from './vocabulary-state'
import type { LearningTerm, VocabularyAction } from './types'

export function useVocabularyActions(onSaved: (term: LearningTerm) => void, onRefresh: () => Promise<void>) {
  const [busy, setBusy] = useState(false), [notice, setNotice] = useState('')
  const mounted = useRef(true), inFlight = useRef(false)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  async function perform(term: LearningTerm, action: VocabularyAction) {
    if (inFlight.current) return
    const state = getVocabularyState(term)
    if (!state) { setNotice('这个表达的状态暂时无法读取，原记录已保留。'); return }
    inFlight.current = true; setBusy(true); setNotice('')
    try {
      const result = await updateVocabularyState(term.normalized, action, state.revision)
      if (!mounted.current) return
      if (result.outcome === 'saved') { onSaved(result.term); return }
      setNotice('状态已更新，本次操作未保存。请查看最新状态后再选择。')
      try { await onRefresh() } catch { if (mounted.current) setNotice('状态已更新，本次操作未保存。最新记录暂时无法读取，请稍后重试。') }
    } catch { if (mounted.current) setNotice('暂时无法保存，请稍后重试。原记录已保留。') }
    finally { inFlight.current = false; if (mounted.current) setBusy(false) }
  }
  return { busy, notice, perform }
}
