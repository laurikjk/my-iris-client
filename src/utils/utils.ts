export const formatAmount = (n: number) => {
  if (n < 1000) return n + " "
  if (n < 1000000) return (n / 1000).toFixed(2).replace(".00", "") + "K "
  return (n / 1000000).toFixed(2).replace(".00", "") + "M "
}

export const createTimestampStorage = (
  key: string,
  defaultValue: number,
  maxAgeMs: number = 24 * 60 * 60 * 1000
) => {
  const get = (): number => {
    const stored = localStorage.getItem(key)
    if (!stored) return defaultValue

    try {
      const {value, timestamp} = JSON.parse(stored)
      const now = Date.now()

      // Reset if older than maxAge
      return now - timestamp > maxAgeMs ? defaultValue : value
    } catch {
      return defaultValue
    }
  }

  const set = (value: number): void => {
    localStorage.setItem(
      key,
      JSON.stringify({
        value,
        timestamp: Date.now(),
      })
    )
  }

  return {get, set}
}
