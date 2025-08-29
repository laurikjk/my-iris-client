import localforage from "localforage"

class MarketStore {
  private seenTags: Set<string> = new Set()
  private tagMap: Map<string, string> = new Map() // lowercase -> original case
  private storageKey = "market-tags"
  private isLoaded = false

  async initialize() {
    if (this.isLoaded) return

    try {
      const storedTags = await localforage.getItem<string[]>(this.storageKey)
      if (storedTags && Array.isArray(storedTags)) {
        for (const tag of storedTags) {
          const lowerTag = tag.toLowerCase()
          this.seenTags.add(lowerTag)
          this.tagMap.set(lowerTag, tag)
        }
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
      if (tag && !this.isNumeric(tag)) {
        const lowerTag = tag.toLowerCase()
        if (!this.seenTags.has(lowerTag)) {
          this.seenTags.add(lowerTag)
          this.tagMap.set(lowerTag, tag)
          hasNewTags = true
        } else {
          // Update to keep the most recently seen case
          this.tagMap.set(lowerTag, tag)
        }
      }
    }

    if (hasNewTags) {
      await this.persist()
    }
  }

  private isNumeric(str: string): boolean {
    return /^\d+$/.test(str.trim())
  }

  async getTags(): Promise<string[]> {
    await this.initialize()
    return Array.from(this.seenTags)
      .map((lowerTag) => this.tagMap.get(lowerTag) || lowerTag)
      .sort()
  }

  private async persist() {
    try {
      const tagsToStore = Array.from(this.seenTags).map(
        (lowerTag) => this.tagMap.get(lowerTag) || lowerTag
      )
      await localforage.setItem(this.storageKey, tagsToStore)
    } catch (error) {
      console.error("Failed to persist market tags:", error)
    }
  }
}

export const marketStore = new MarketStore()
