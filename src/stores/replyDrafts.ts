import {persist, createJSONStorage} from "zustand/middleware"
import {create} from "zustand"
import {LRUCache} from "typescript-lru-cache"
import localforage from "localforage"

interface ReplyDraft {
  content: string
  imageMetadata: Record<string, {width: number; height: number; blurhash: string}>
}

interface ReplyDraftsState {
  drafts: Record<string, ReplyDraft>

  getDraft: (repliedEventId: string) => ReplyDraft | undefined
  setDraft: (repliedEventId: string, draft: Partial<ReplyDraft>) => void
  deleteDraft: (repliedEventId: string) => void
  reset: () => void
}

// Keep only 10 most recent reply drafts in memory
const MAX_DRAFTS = 10
const lruCache = new LRUCache<string, ReplyDraft>({maxSize: MAX_DRAFTS})

export const useReplyDraftsStore = create<ReplyDraftsState>()(
  persist(
    (set, get) => ({
      drafts: {},

      getDraft: (repliedEventId: string) => {
        const state = get()
        if (state.drafts[repliedEventId]) {
          // Update LRU cache access
          lruCache.set(repliedEventId, state.drafts[repliedEventId])
          return state.drafts[repliedEventId]
        }
        return undefined
      },

      setDraft: (repliedEventId: string, draft: Partial<ReplyDraft>) => {
        set((state) => {
          const currentDraft = state.drafts[repliedEventId] || {
            content: "",
            imageMetadata: {},
          }

          const updatedDraft = {
            ...currentDraft,
            ...draft,
          }

          // Update LRU cache
          lruCache.set(repliedEventId, updatedDraft)

          // Sync drafts with LRU cache (evict old ones)
          const newDrafts: Record<string, ReplyDraft> = {}
          lruCache.forEach((value, key) => {
            newDrafts[key] = value
          })

          return {drafts: newDrafts}
        })
      },

      deleteDraft: (repliedEventId: string) => {
        set((state) => {
          const newDrafts = {...state.drafts}
          delete newDrafts[repliedEventId]
          lruCache.delete(repliedEventId)
          return {drafts: newDrafts}
        })
      },

      reset: () => {
        lruCache.clear()
        set({drafts: {}})
      },
    }),
    {
      name: "reply-drafts-storage",
      storage: createJSONStorage(() => localforage),
      partialize: (state) => ({drafts: state.drafts}),
      onRehydrateStorage: () => (state) => {
        // Rebuild LRU cache from persisted drafts
        if (state?.drafts) {
          Object.entries(state.drafts)
            .slice(-MAX_DRAFTS)
            .forEach(([id, draft]) => {
              lruCache.set(id, draft)
            })
        }
      },
    }
  )
)
