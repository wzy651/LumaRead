import type { DictionaryEntry } from './types'

type Entry = [string, string, string, string] | string
type Shard = Record<string, Entry>
const shards = new Map<string, Promise<Shard>>()
export function normalizeTerm(text: string) { return text.normalize('NFKC').replace(/[’‘]/g, "'").replace(/\s+/g, ' ').trim().toLowerCase() }
async function loadShard(key: string): Promise<Shard> {
  let pending = shards.get(key)
  if (!pending) {
    pending = fetch(`${import.meta.env.BASE_URL}dictionary/${key}.json`).then(async (response) => {
      if (response.status === 404) return {}
      if (!response.ok) throw new Error('离线词库暂时无法读取，请重试。')
      return await response.json() as Shard
    }).catch((error) => { shards.delete(key); throw error })
    if (shards.size >= 12) shards.delete(shards.keys().next().value!)
    shards.set(key, pending)
  }
  return pending
}
export async function lookupDictionary(text: string): Promise<DictionaryEntry | undefined> {
  let word = normalizeTerm(text)
  if (!/^[a-z][a-z '-]{0,79}$/.test(word)) return undefined
  for (let depth = 0; depth < 3; depth++) {
    const shard = await loadShard(word.slice(0, 2).replace(/[^a-z]/g, '_'))
    const item = Object.hasOwn(shard, word) ? shard[word] : undefined
    if (typeof item === 'string') { word = item; continue }
    if (!Array.isArray(item) || item.length !== 4 || !item.every((part) => typeof part === 'string')) return undefined
    return { word: item[0], phonetic: item[1], translation: item[2], definition: item[3], source: 'ECDICT' }
  }
  return undefined
}
