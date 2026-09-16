import type { HomeReadingItem } from './home-reading-service'

export function hasReliableProgress(
  item: Pick<HomeReadingItem, 'progressPercent'>,
): item is Pick<HomeReadingItem, 'progressPercent'> & { progressPercent: number } {
  return item.progressPercent !== undefined
}