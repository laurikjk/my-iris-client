import {create} from "zustand"

interface SocialGraphState {
  isRecrawling: boolean
  version: number
  muteListVersion: number
  setIsRecrawling: (isRecrawling: boolean) => void
  incrementVersion: () => void
  incrementMuteListVersion: () => void
}

export const useSocialGraphStore = create<SocialGraphState>((set) => ({
  isRecrawling: false,
  version: 0,
  muteListVersion: 0,
  setIsRecrawling: (isRecrawling: boolean) => set({isRecrawling}),
  incrementVersion: () => set((state) => ({version: state.version + 1})),
  incrementMuteListVersion: () =>
    set((state) => ({muteListVersion: state.muteListVersion + 1})),
}))
