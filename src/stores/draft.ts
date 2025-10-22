import {persist, createJSONStorage} from "zustand/middleware"
import {create} from "zustand"
import localforage from "localforage"

export interface ImetaTag {
  url: string
  width?: number
  height?: number
  blurhash?: string
  alt?: string
  m?: string
  x?: string
  size?: string
  dim?: string
  fallback?: string[]
}

interface Draft {
  content: string
  imeta: ImetaTag[]
  gTags: string[]
  expirationDelta?: number | null // Time delta in seconds (e.g., 3600 for 1 hour)
  eventKind?: number // Nostr event kind (1 for post, 30402 for market listing, etc.)
  price?: {amount: string; currency: string; frequency?: string}
  title?: string
  timestamp: number
}

const MAX_REPLY_DRAFTS = 20

export interface DraftState {
  drafts: Record<string, Draft>
  hasHydrated: boolean

  setDraft: (key: string, draft: Partial<Draft>) => void
  getDraft: (key: string) => Draft | undefined
  clearDraft: (key: string) => void
  clearAll: () => void
}

export const useDraftStore = create<DraftState>()(
  persist(
    (set, get) => {
      const evictOldestDrafts = (drafts: Record<string, Draft>) => {
        // Never evict main draft (empty string key)
        const mainDraft = drafts[""]
        const replyDrafts = Object.entries(drafts).filter(([key]) => key !== "")

        if (replyDrafts.length <= MAX_REPLY_DRAFTS) return drafts

        // Sort reply drafts by timestamp and keep newest
        const sorted = replyDrafts.sort((a, b) => b[1].timestamp - a[1].timestamp)
        const kept = sorted.slice(0, MAX_REPLY_DRAFTS)

        const result = Object.fromEntries(kept)
        if (mainDraft) result[""] = mainDraft
        return result
      }

      return {
        drafts: {} as Record<string, Draft>,
        hasHydrated: false,

        setDraft: (key: string, draft: Partial<Draft>) =>
          set((state) => {
            const existing = state.drafts[key]
            const newDraft: Draft = {
              content: draft.content ?? existing?.content ?? "",
              imeta: draft.imeta ?? existing?.imeta ?? [],
              gTags: draft.gTags ?? existing?.gTags ?? [],
              expirationDelta:
                draft.expirationDelta !== undefined
                  ? draft.expirationDelta
                  : existing?.expirationDelta,
              eventKind: draft.eventKind ?? existing?.eventKind,
              price: draft.price ?? existing?.price,
              title: draft.title ?? existing?.title,
              timestamp: Date.now(),
            }
            const drafts = evictOldestDrafts({
              ...state.drafts,
              [key]: newDraft,
            })
            return {drafts}
          }),

        getDraft: (key: string) => get().drafts[key],

        clearDraft: (key: string) =>
          set((state) => {
            const newDrafts = {...state.drafts}
            delete newDrafts[key]
            return {drafts: newDrafts}
          }),

        clearAll: () => set({drafts: {}}),
      }
    },
    {
      name: "draft-storage",
      storage: createJSONStorage(() => localforage),
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.hasHydrated = true
        }
      },
    }
  )
)
