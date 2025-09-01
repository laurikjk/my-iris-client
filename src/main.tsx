import "@/index.css"

import {NavigationProvider, Router} from "@/navigation"
import {useUserStore} from "./stores/user"
import ReactDOM from "react-dom/client"

import {subscribeToDMNotifications, subscribeToNotifications} from "./utils/notifications"
import {migrateUserState, migratePublicChats} from "./utils/migration"
import {useSettingsStore} from "@/stores/settings"
import {
  initializeSessionManager,
  resetSessionManagerInitialization,
} from "@/stores/privateChatsNew"
import {ndk} from "./utils/ndk"
import socialGraph from "./utils/socialGraph"
import DebugManager from "./utils/DebugManager"
import Layout from "@/shared/components/Layout"

// Move initialization to a function to avoid side effects
const initializeApp = () => {
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

    // Only initialize DM sessions if not in readonly mode
    if (state.privateKey || state.nip07Login) {
      initializeSessionManager().catch(console.error)
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
}

// Initialize app
initializeApp()

const root = ReactDOM.createRoot(document.getElementById("root")!)

root.render(
  <NavigationProvider>
    <Layout>
      <Router />
    </Layout>
  </NavigationProvider>
)

// Store subscriptions
const unsubscribeUser = useUserStore.subscribe((state, prevState) => {
  // Only proceed if public key actually changed
  if (state.publicKey && state.publicKey !== prevState.publicKey) {
    console.log("Public key changed, initializing chat modules")
    resetSessionManagerInitialization() // Reset to allow re-initialization
    subscribeToNotifications()
    subscribeToDMNotifications()
    migratePublicChats()

    // Only initialize DM sessions if not in readonly mode
    if (state.privateKey || state.nip07Login) {
      initializeSessionManager().catch(console.error)
    }
  }
})

// Subscribe to theme changes
const unsubscribeTheme = useSettingsStore.subscribe((state) => {
  if (typeof state.appearance.theme === "string") {
    document.documentElement.setAttribute("data-theme", state.appearance.theme)
  }
})

// HMR support
if (import.meta.hot) {
  import.meta.hot.accept()
  import.meta.hot.dispose(() => {
    // Clean up subscriptions on hot reload
    unsubscribeUser()
    unsubscribeTheme()
  })
}
