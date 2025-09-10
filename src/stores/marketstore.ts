import localforage from "localforage"

class MarketStore {
  private seenTags: Set<string> = new Set()
  private tagMap: Map<string, string> = new Map() // lowercase -> original case
  private categoryUsers: Map<string, Set<string>> = new Map() // lowercase tag -> set of user prefixes
  private storageKey = "market-tags"
  private userStorageKey = "market-category-users"
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

      // Load category users
      const storedUsers = await localforage.getItem<Record<string, string[]>>(
        this.userStorageKey
      )
      if (storedUsers && typeof storedUsers === "object") {
        for (const [tag, users] of Object.entries(storedUsers)) {
          this.categoryUsers.set(tag, new Set(users))
        }
      }

      this.isLoaded = true
    } catch (error) {
      console.error("Failed to load market tags from storage:", error)
      this.isLoaded = true
    }
  }

  async addTags(tags: string[], pubkey?: string) {
    await this.initialize()

    let hasNewTags = false
    let hasNewUsers = false

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

        // Track user for this category
        if (pubkey && pubkey.length >= 8) {
          const userPrefix = pubkey.substring(0, 8)
          if (!this.categoryUsers.has(lowerTag)) {
            this.categoryUsers.set(lowerTag, new Set())
          }
          const users = this.categoryUsers.get(lowerTag)!
          if (!users.has(userPrefix)) {
            users.add(userPrefix)
            hasNewUsers = true
          }
        }
      }
    }

    if (hasNewTags || hasNewUsers) {
      await this.persist()
    }
  }

  private isNumeric(str: string): boolean {
    return /^\d+$/.test(str.trim())
  }

  async getTags(): Promise<string[]> {
    await this.initialize()

    // Sort by user count (descending), then alphabetically
    const tagsWithCounts = Array.from(this.seenTags).map((lowerTag) => ({
      tag: this.tagMap.get(lowerTag) || lowerTag,
      lowerTag,
      userCount: this.categoryUsers.get(lowerTag)?.size || 0,
    }))

    return tagsWithCounts
      .sort((a, b) => {
        if (b.userCount !== a.userCount) {
          return b.userCount - a.userCount
        }
        return a.tag.localeCompare(b.tag)
      })
      .map((item) => item.tag)
  }

  private async persist() {
    try {
      const tagsToStore = Array.from(this.seenTags).map(
        (lowerTag) => this.tagMap.get(lowerTag) || lowerTag
      )
      await localforage.setItem(this.storageKey, tagsToStore)

      // Persist category users
      const usersToStore: Record<string, string[]> = {}
      for (const [tag, users] of this.categoryUsers.entries()) {
        usersToStore[tag] = Array.from(users)
      }
      await localforage.setItem(this.userStorageKey, usersToStore)
    } catch (error) {
      console.error("Failed to persist market tags:", error)
    }
  }
}

export const marketStore = new MarketStore()
