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

export interface DraftState {
  content: string
  imeta: ImetaTag[]
  gTags: string[]
  repliedEventId?: string
  quotedEventId?: string

  setContent: (content: string | ((prev: string) => string)) => void
  setImeta: (imeta: ImetaTag[]) => void
  setGTags: (gTags: string[]) => void
  addGeohash: (geohash: string) => void
  removeGeohash: (geohash: string) => void
  setRepliedEventId: (id?: string) => void
  setQuotedEventId: (id?: string) => void
  setState: (
    state: Partial<
      Omit<
        DraftState,
        | "setContent"
        | "setImeta"
        | "setGTags"
        | "addGeohash"
        | "removeGeohash"
        | "setRepliedEventId"
        | "setQuotedEventId"
        | "setState"
        | "reset"
      >
    >
  ) => void
  reset: () => void
}

export const useDraftStore = create<DraftState>()(
  persist(
    (set) => {
      const initialState = {
        content: "",
        imeta: [],
        gTags: [],
        repliedEventId: undefined,
        quotedEventId: undefined,
      }

      const actions = {
        setContent: (content: string | ((prev: string) => string)) =>
          set((state) => ({
            content: typeof content === "function" ? content(state.content) : content,
          })),
        setImeta: (imeta: ImetaTag[]) => set({imeta}),
        setGTags: (gTags: string[]) => set({gTags}),
        addGeohash: (geohash: string) =>
          set((state) => ({
            gTags: state.gTags.includes(geohash)
              ? state.gTags
              : [...state.gTags, geohash],
          })),
        removeGeohash: (geohash: string) =>
          set((state) => ({
            gTags: state.gTags.filter((g) => g !== geohash),
          })),
        setRepliedEventId: (repliedEventId?: string) => set({repliedEventId}),
        setQuotedEventId: (quotedEventId?: string) => set({quotedEventId}),
        setState: (
          newState: Partial<
            Omit<
              DraftState,
              | "setContent"
              | "setImeta"
              | "setGTags"
              | "addGeohash"
              | "removeGeohash"
              | "setRepliedEventId"
              | "setQuotedEventId"
              | "setState"
              | "reset"
            >
          >
        ) => set(newState),
        reset: () => set(initialState),
      }

      return {
        ...initialState,
        ...actions,
      }
    },
    {
      name: "draft-storage",
      storage: createJSONStorage(() => localforage),
    }
  )
)
