import "@/index.css"

import {NavigationProvider, Router} from "@/navigation"
import {useUserStore} from "./stores/user"
import ReactDOM from "react-dom/client"

import {subscribeToDMNotifications, subscribeToNotifications} from "./utils/notifications"
import {migrateUserState, migratePublicChats} from "./utils/migration"
import {useSettingsStore} from "@/stores/settings"
import {usePrivateChatsStoreNew} from "@/stores/privateChats.new"
import {ndk} from "./utils/ndk"
import socialGraph from "./utils/socialGraph"
import DebugManager from "./utils/DebugManager"
import Layout from "@/shared/components/Layout"

ndk()

// Initialize debug system
DebugManager

// Initialize chat modules if we have a public key
const state = useUserStore.getState()
if (state.publicKey) {
  console.log("Initializing chat modules with existing user data")
  subscribeToNotifications()
  subscribeToDMNotifications()
  migratePublicChats()
  socialGraph().recalculateFollowDistances()

  // Only initialize private chats if not in readonly mode
  if (state.privateKey || state.nip07Login) {
    usePrivateChatsStoreNew.getState().initialize().catch(console.error)
  }
}

document.title = CONFIG.appName

// Initialize theme from settings store
const {appearance} = useSettingsStore.getState()
document.documentElement.setAttribute(
  "data-theme",
  appearance.theme || CONFIG.defaultTheme
)

// Perform migration before rendering the app
migrateUserState()

ReactDOM.createRoot(document.getElementById("root")!).render(
  <NavigationProvider>
    <Layout>
      <Router />
    </Layout>
  </NavigationProvider>
)

// Subscribe to public key changes from the user store
useUserStore.subscribe((state, prevState) => {
  // Only proceed if public key actually changed
  if (state.publicKey && state.publicKey !== prevState.publicKey) {
    console.log("Public key changed, initializing chat modules")

    // Reset and initialize new private chats store
    usePrivateChatsStoreNew.getState().reset()
    subscribeToNotifications()
    subscribeToDMNotifications()
    migratePublicChats()

    // Only initialize private chats if not in readonly mode
    if (state.privateKey || state.nip07Login) {
      usePrivateChatsStoreNew.getState().initialize().catch(console.error)
    }
  }
})

// Subscribe to theme changes
useSettingsStore.subscribe((state) => {
  if (typeof state.appearance.theme === "string") {
    document.documentElement.setAttribute("data-theme", state.appearance.theme)
  }
})
