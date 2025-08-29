import {create} from "zustand"

interface SocialGraphState {
  isRecrawling: boolean
  setIsRecrawling: (isRecrawling: boolean) => void
}

export const useSocialGraphStore = create<SocialGraphState>((set) => ({
  isRecrawling: false,
  setIsRecrawling: (isRecrawling: boolean) => set({isRecrawling}),
}))
