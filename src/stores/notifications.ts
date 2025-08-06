import {persist} from "zustand/middleware"
import {create} from "zustand"

interface NotificationsState {
  latestNotification: number
  notificationsDeclined: boolean
  notificationsSeenAt: number
  goToNotifications: number

  setLatestNotification: (timestamp: number) => void
  setNotificationsDeclined: (declined: boolean) => void
  setNotificationsSeenAt: (timestamp: number) => void
  incrementGoToNotifications: () => void
}

export const useNotificationsStore = create<NotificationsState>()(
  persist(
    (set, get) => {
      const initialState = {
        latestNotification: 0,
        notificationsDeclined: false,
        notificationsSeenAt: 0,
        goToNotifications: 0,
      }

      const actions = {
        setLatestNotification: (latestNotification: number) => set({latestNotification}),
        setNotificationsDeclined: (notificationsDeclined: boolean) =>
          set({notificationsDeclined}),
        setNotificationsSeenAt: (notificationsSeenAt: number) =>
          set({notificationsSeenAt}),
        incrementGoToNotifications: () =>
          set({goToNotifications: get().goToNotifications + 1}),
      }

      return {
        ...initialState,
        ...actions,
      }
    },
    {
      name: "notifications-storage",
    }
  )
)

if (typeof window !== "undefined") {
  ;(
    window as {
      useNotificationsStore?: typeof useNotificationsStore
    }
  ).useNotificationsStore = useNotificationsStore
}
