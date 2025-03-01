import "@/index.css"

import {RouterProvider} from "react-router"
import ReactDOM from "react-dom/client"
import {localState} from "irisdb/src"

import {subscribeToDMNotifications, subscribeToNotifications} from "./utils/notifications"
import {loadSessions} from "./pages/messages/Sessions"
import {loadInvites} from "./pages/messages/Invites"
import {ndk} from "./utils/ndk"
import {router} from "@/pages"

ndk() // init NDK & irisdb login flow

localState.get("user").on((user) => {
  if (user) {
    loadSessions()
    loadInvites()
    subscribeToNotifications()
    subscribeToDMNotifications()
  }
})

ReactDOM.createRoot(document.getElementById("root")!).render(
  <RouterProvider router={router} />
)

document.title = CONFIG.appName
document.documentElement.setAttribute("data-theme", CONFIG.defaultTheme)

localState.get("user/theme").on((theme) => {
  if (typeof theme === "string") {
    document.documentElement.setAttribute("data-theme", theme)
  }
})
