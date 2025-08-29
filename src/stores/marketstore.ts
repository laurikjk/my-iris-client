import localforage from "localforage"

class MarketStore {
  private seenTags: Set<string> = new Set()
  private storageKey = "market-tags"
  private isLoaded = false

  async initialize() {
    if (this.isLoaded) return

    try {
      const storedTags = await localforage.getItem<string[]>(this.storageKey)
      if (storedTags && Array.isArray(storedTags)) {
        this.seenTags = new Set(storedTags)
      }
      this.isLoaded = true
    } catch (error) {
      console.error("Failed to load market tags from storage:", error)
      this.isLoaded = true
    }
  }

  async addTags(tags: string[]) {
    await this.initialize()

    let hasNewTags = false
    for (const tag of tags) {
      if (tag && !this.seenTags.has(tag)) {
        this.seenTags.add(tag)
        hasNewTags = true
      }
    }

    if (hasNewTags) {
      await this.persist()
    }
  }

  async getTags(): Promise<string[]> {
    await this.initialize()
    return Array.from(this.seenTags).sort()
  }

  private async persist() {
    try {
      await localforage.setItem(this.storageKey, Array.from(this.seenTags))
    } catch (error) {
      console.error("Failed to persist market tags:", error)
    }
  }
}

export const marketStore = new MarketStore()
