const CACHE_DURATION_HOURS = 24

interface StoredTimestamp {
  date: string
  oldestTimestamp: string
}

export const storeOldestTimestamp = (
  storageKey: string,
  oldestTimestamp: number
): void => {
  const obj: StoredTimestamp = {
    date: new Date().toISOString(),
    oldestTimestamp: oldestTimestamp.toString(),
  }
  localStorage.setItem(storageKey, JSON.stringify(obj))
}

export const getStoredOldestTimestamp = (
  storageKey: string,
  fallbackHoursAgo: number = 48
): number => {
  const stored = localStorage.getItem(storageKey)
  if (stored) {
    try {
      const parsed = JSON.parse(stored) as StoredTimestamp
      if (
        parsed.date &&
        parsed.oldestTimestamp &&
        !isNaN(Number(parsed.oldestTimestamp))
      ) {
        const storedDate = new Date(parsed.date)
        const now = new Date()
        const hoursDiff = (now.getTime() - storedDate.getTime()) / (1000 * 60 * 60)

        if (hoursDiff > CACHE_DURATION_HOURS) {
          localStorage.removeItem(storageKey)
          return Math.floor(Date.now() / 1000) - fallbackHoursAgo * 60 * 60
        }

        return Number(parsed.oldestTimestamp)
      }
    } catch (e) {
      // Ignore parse errors
    }
  }
  return Math.floor(Date.now() / 1000) - fallbackHoursAgo * 60 * 60
}
