import localforage from "localforage"

class MarketStore {
  private seenTags: Set<string> = new Set()
  private tagMap: Map<string, string> = new Map() // lowercase -> original case
  private categoryUsers: Map<string, Set<string>> = new Map() // lowercase tag -> set of user prefixes
  private categoryCooccurrence: Map<string, Map<string, number>> = new Map() // tag -> Map(coTag -> count) - in memory only
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

      // Don't load co-occurrence data from storage - keep it in memory only

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
    let hasNewCooccurrence = false

    const validTags: string[] = []

    for (const tag of tags) {
      if (tag && !this.isNumeric(tag)) {
        const lowerTag = tag.toLowerCase()
        validTags.push(lowerTag)

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

    // Track co-occurrences between ALL tags in the event
    // This builds accurate co-occurrence data
    if (validTags.length > 1) {
      for (let i = 0; i < validTags.length; i++) {
        const tag1 = validTags[i]
        if (!this.categoryCooccurrence.has(tag1)) {
          this.categoryCooccurrence.set(tag1, new Map())
        }
        const coMap = this.categoryCooccurrence.get(tag1)!

        for (let j = 0; j < validTags.length; j++) {
          if (i !== j) {
            const tag2 = validTags[j]
            const currentCount = coMap.get(tag2) || 0
            coMap.set(tag2, currentCount + 1)
            hasNewCooccurrence = true
          }
        }
      }
    }

    if (hasNewTags || hasNewUsers || hasNewCooccurrence) {
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

  async getTagsWithCounts(): Promise<{tag: string; userCount: number}[]> {
    await this.initialize()

    // Sort by user count (descending), then alphabetically
    const tagsWithCounts = Array.from(this.seenTags).map((lowerTag) => ({
      tag: this.tagMap.get(lowerTag) || lowerTag,
      userCount: this.categoryUsers.get(lowerTag)?.size || 0,
    }))

    return tagsWithCounts.sort((a, b) => {
      if (b.userCount !== a.userCount) {
        return b.userCount - a.userCount
      }
      return a.tag.localeCompare(b.tag)
    })
  }

  async getCooccurringTags(
    selectedTags: string[]
  ): Promise<{tag: string; userCount: number; cooccurrenceScore: number}[]> {
    await this.initialize()

    if (selectedTags.length === 0) {
      // Return all tags if no selection
      return (await this.getTagsWithCounts()).map((t) => ({...t, cooccurrenceScore: 0}))
    }

    const lowerSelectedTags = selectedTags.map((t) => t.toLowerCase())

    if (selectedTags.length === 1) {
      // Single tag selected - show tags that co-occur with it
      const selectedTag = lowerSelectedTags[0]
      const coMap = this.categoryCooccurrence.get(selectedTag)

      if (!coMap || coMap.size === 0) {
        // No co-occurrences found, return empty
        return []
      }

      const result: {tag: string; userCount: number; cooccurrenceScore: number}[] = []

      for (const [coTag, count] of coMap) {
        if (!lowerSelectedTags.includes(coTag) && this.seenTags.has(coTag)) {
          result.push({
            tag: this.tagMap.get(coTag) || coTag,
            userCount: this.categoryUsers.get(coTag)?.size || 0,
            cooccurrenceScore: count,
          })
        }
      }

      // Sort by co-occurrence score (descending), then by user count
      return result.sort((a, b) => {
        if (b.cooccurrenceScore !== a.cooccurrenceScore) {
          return b.cooccurrenceScore - a.cooccurrenceScore
        }
        if (b.userCount !== a.userCount) {
          return b.userCount - a.userCount
        }
        return a.tag.localeCompare(b.tag)
      })
    } else {
      // Multiple tags selected - only show tags that co-occur with ALL selected tags
      // Start with tags that co-occur with the first selected tag
      const firstTag = lowerSelectedTags[0]
      const firstCoMap = this.categoryCooccurrence.get(firstTag)

      if (!firstCoMap || firstCoMap.size === 0) {
        return []
      }

      // Find tags that co-occur with ALL selected tags
      const candidateTags = new Map<string, number>()

      for (const [coTag, count] of firstCoMap) {
        if (!lowerSelectedTags.includes(coTag)) {
          // Check if this tag co-occurs with all other selected tags
          let cooccursWithAll = true
          let minCount = count

          for (let i = 1; i < lowerSelectedTags.length; i++) {
            const otherTag = lowerSelectedTags[i]
            const otherCoMap = this.categoryCooccurrence.get(otherTag)

            if (!otherCoMap || !otherCoMap.has(coTag)) {
              cooccursWithAll = false
              break
            }

            // Use minimum co-occurrence count across all selected tags
            minCount = Math.min(minCount, otherCoMap.get(coTag)!)
          }

          if (cooccursWithAll) {
            candidateTags.set(coTag, minCount)
          }
        }
      }

      // Build result array
      const result: {tag: string; userCount: number; cooccurrenceScore: number}[] = []

      for (const [lowerTag, score] of candidateTags) {
        if (this.seenTags.has(lowerTag)) {
          result.push({
            tag: this.tagMap.get(lowerTag) || lowerTag,
            userCount: this.categoryUsers.get(lowerTag)?.size || 0,
            cooccurrenceScore: score,
          })
        }
      }

      // Sort by co-occurrence score (descending), then by user count
      return result.sort((a, b) => {
        if (b.cooccurrenceScore !== a.cooccurrenceScore) {
          return b.cooccurrenceScore - a.cooccurrenceScore
        }
        if (b.userCount !== a.userCount) {
          return b.userCount - a.userCount
        }
        return a.tag.localeCompare(b.tag)
      })
    }
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

      // Don't persist co-occurrence data - keep it in memory only
    } catch (error) {
      console.error("Failed to persist market tags:", error)
    }
  }
}

export const marketStore = new MarketStore()
