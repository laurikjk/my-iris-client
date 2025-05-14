import "@/index.css"

import {RouterProvider} from "react-router"
import ReactDOM from "react-dom/client"
import {localState} from "irisdb/src"

import {subscribeToDMNotifications, subscribeToNotifications} from "./utils/notifications"
import {loadSessions} from "@/utils/chat/Sessions"
import {useSettingsStore} from "@/stores/settings"
import {loadInvites} from "@/utils/chat/Invites"
import {ndk} from "./utils/ndk"
import {router} from "@/pages"

ndk() // init NDK & irisdb login flow

localState.get("user/publicKey").on((user) => {
  if (user) {
    loadSessions()
    loadInvites()
    subscribeToNotifications()
    subscribeToDMNotifications()
  }
})

document.title = CONFIG.appName

// Initialize theme from settings store
const {theme} = useSettingsStore.getState()
document.documentElement.setAttribute("data-theme", theme)

ReactDOM.createRoot(document.getElementById("root")!).render(
  <RouterProvider router={router} />
)

// Subscribe to theme changes
useSettingsStore.subscribe((state) => {
  if (typeof state.theme === "string") {
    document.documentElement.setAttribute("data-theme", state.theme)
  }
})
