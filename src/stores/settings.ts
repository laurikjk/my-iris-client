import {persist} from "zustand/middleware"
import {create} from "zustand"

interface SettingsState {
  // Appearance settings
  appearance: {
    theme: string
  }
  // Content settings
  content: {
    blurNSFW: boolean
    hideEventsByUnknownUsers: boolean
    hidePostsByMutedMoreThanFollowed: boolean
    autoplayVideos: boolean
  }
  // Update a specific setting group
  updateAppearance: (settings: Partial<SettingsState["appearance"]>) => void
  updateContent: (settings: Partial<SettingsState["content"]>) => void
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      appearance: {
        theme: CONFIG.defaultTheme,
      },
      content: {
        blurNSFW: true,
        hideEventsByUnknownUsers: true,
        hidePostsByMutedMoreThanFollowed: true,
        autoplayVideos: true,
      },
      updateAppearance: (settings) =>
        set((state) => ({
          appearance: {...state.appearance, ...settings},
        })),
      updateContent: (settings) =>
        set((state) => ({
          content: {...state.content, ...settings},
        })),
    }),
    {
      name: "settings-storage",
    }
  )
)
