import {persist} from "zustand/middleware"
import {create} from "zustand"

interface SettingsState {
  theme: string
  setTheme: (theme: string) => void
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      theme: CONFIG.defaultTheme,
      setTheme: (theme) => set({theme}),
    }),
    {
      name: "settings-storage",
    }
  )
)
