import {persist} from "zustand/middleware"
import {create} from "zustand"
import localforage from "localforage"
import {isTouchDevice} from "@/shared/utils/isTouchDevice"

interface SettingsState {
  // Appearance settings
  appearance: {
    theme: string
    showRightColumn: boolean
    singleColumnLayout: boolean
    limitedMaxWidth: boolean
  }
  // Content settings
  content: {
    blurNSFW: boolean
    hideEventsByUnknownUsers: boolean
    hidePostsByMutedMoreThanFollowed: boolean
    autoplayVideos: boolean
    showLikes: boolean
    showReposts: boolean
    showReplies: boolean
    showZaps: boolean
    showReactionsBar: boolean
    showReactionCounts: boolean
    showReactionCountsInStandalone: boolean
  }
  // Imgproxy settings
  imgproxy: {
    url: string
    key: string
    salt: string
    enabled: boolean
    fallbackToOriginal: boolean
  }
  // Notification settings
  notifications: {
    server: string
  }
  // Debug settings
  debug: {
    enabled: boolean
    privateKey: string | null
  }
  // Update a specific setting group
  updateAppearance: (settings: Partial<SettingsState["appearance"]>) => void
  updateContent: (settings: Partial<SettingsState["content"]>) => void
  updateImgproxy: (settings: Partial<SettingsState["imgproxy"]>) => void
  updateNotifications: (settings: Partial<SettingsState["notifications"]>) => void
  updateDebug: (settings: Partial<SettingsState["debug"]>) => void
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      appearance: {
        theme: CONFIG.defaultTheme,
        showRightColumn: true,
        singleColumnLayout: false,
        limitedMaxWidth: false,
      },
      content: {
        blurNSFW: true,
        hideEventsByUnknownUsers: true,
        hidePostsByMutedMoreThanFollowed: true,
        autoplayVideos: true,
        showLikes: true,
        showReposts: true,
        showReplies: true,
        showZaps: true,
        showReactionsBar: true,
        showReactionCounts: !isTouchDevice, // Hide in feed on mobile by default
        showReactionCountsInStandalone: true, // Always show in post view by default
      },
      imgproxy: {
        url: "https://imgproxy.coracle.social",
        key: "",
        salt: "",
        enabled: true,
        fallbackToOriginal: true,
      },
      notifications: {
        server: CONFIG.defaultSettings.notificationServer,
      },
      debug: {
        enabled: false,
        privateKey: null,
      },
      updateAppearance: (settings) =>
        set((state) => ({
          appearance: {...state.appearance, ...settings},
        })),
      updateContent: (settings) =>
        set((state) => ({
          content: {...state.content, ...settings},
        })),
      updateImgproxy: (settings) =>
        set((state) => {
          const newImgproxy = {...state.imgproxy, ...settings}
          localforage.setItem("imgproxy-settings", newImgproxy)
          return {imgproxy: newImgproxy}
        }),
      updateNotifications: (settings) =>
        set((state) => ({
          notifications: {...state.notifications, ...settings},
        })),
      updateDebug: (settings) =>
        set((state) => ({
          debug: {...state.debug, ...settings},
        })),
    }),
    {
      name: "settings-storage",
      onRehydrateStorage: () => (state) => {
        if (state?.imgproxy) {
          localforage.setItem("imgproxy-settings", state.imgproxy)
        }
      },
    }
  )
)
