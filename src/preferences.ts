import type { FeedMode, FeedPeriod } from './tabnews'

export interface Preferences { mode: FeedMode; period: FeedPeriod }
const KEY = 'tabnews.preferences.v1'

export function readPreferences(storage: Pick<Storage, 'getItem'>): Preferences {
  const defaults: Preferences = { mode: 'newsletter', period: 'latest' }
  try {
    const value = JSON.parse(storage.getItem(KEY) ?? 'null')
    if (!value || !['newsletter', 'relevant', 'new'].includes(value.mode) || !['latest', 'five'].includes(value.period)) return defaults
    return { mode: value.mode, period: value.period }
  } catch {
    return defaults
  }
}

export function savePreferences(storage: Pick<Storage, 'setItem'>, preferences: Preferences): void {
  try {
    storage.setItem(KEY, JSON.stringify(preferences))
  } catch {
    // WebViews que negam armazenamento ainda permitem usar a seleção nesta sessão.
  }
}
