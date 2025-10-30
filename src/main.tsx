import "@/index.css"

import {NavigationProvider, Router} from "@/navigation"
import {useUserStore} from "./stores/user"
import ReactDOM from "react-dom/client"

import {subscribeToDMNotifications, subscribeToNotifications} from "./utils/notifications"
import {migrateUserState, migratePublicChats} from "./utils/migration"
import pushNotifications from "./utils/pushNotifications"
import {useSettingsStore} from "@/stores/settings"
import {ndk} from "./utils/ndk"
import socialGraph from "./utils/socialGraph"
import DebugManager from "./utils/DebugManager"
import Layout from "@/shared/components/Layout"
import {usePrivateMessagesStore} from "./stores/privateMessages"
import {getSessionManager} from "./shared/services/PrivateChats"
import {getTag} from "./utils/tagUtils"
import {useGroupsStore} from "./stores/groups"
import {KIND_CHANNEL_CREATE} from "./utils/constants"
import {isTauri} from "./utils/utils"
import {onOpenUrl} from "@tauri-apps/plugin-deep-link"
import {
  enable as enableAutostart,
  isEnabled as isAutostartEnabled,
} from "@tauri-apps/plugin-autostart"

let unsubscribeSessionEvents: (() => void) | null = null

// Register deep link handler for hot starts (when app already open)
// Note: Cold start (app closed) doesn't work due to Tauri bug #13580
if (isTauri()) {
  onOpenUrl((urls) => {
    if (!urls?.length) return

    const url = urls[0]
    let path: string
    let state: Record<string, unknown> | undefined

    if (url.startsWith("lightning:")) {
      const invoice = url.replace(/^lightning:/, "")
      path = "/wallet"
      state = {lightningInvoice: invoice}
    } else {
      path = `/${url.replace(/^(nostr:|web\+nostr:)/, "")}`
      state = undefined
    }

    // Dispatch custom event for NavigationProvider to handle
    window.dispatchEvent(new CustomEvent("iris-deep-link", {detail: {path, state}}))
  })
}

const attachSessionEventListener = () => {
  try {
    const sessionManager = getSessionManager()
    if (!sessionManager) {
      console.error("Session manager not available")
      return
    }
    void sessionManager
      .init()
      .then(() => {
        unsubscribeSessionEvents?.()
        unsubscribeSessionEvents = sessionManager.onEvent((event, pubKey) => {
          const {publicKey} = useUserStore.getState()
          if (!publicKey) return

          // Check if it's a group creation event
          const lTag = getTag("l", event.tags)
          if (event.kind === KIND_CHANNEL_CREATE && lTag) {
            try {
              const group = JSON.parse(event.content)
              const {addGroup} = useGroupsStore.getState()
              addGroup(group)
              console.log("Received group creation:", group.name, group.id)
            } catch (e) {
              console.error("Failed to parse group creation event:", e)
            }
            return
          }

          // Check if it's a group message (has l tag but not group creation)
          if (lTag) {
            // Create placeholder group if we don't have metadata yet
            const {groups, addGroup} = useGroupsStore.getState()
            if (!groups[lTag]) {
              const placeholderGroup = {
                id: lTag,
                name: `Group ${lTag.slice(0, 8)}`,
                description: "",
                picture: "",
                members: [publicKey],
                createdAt: Date.now(),
              }
              addGroup(placeholderGroup)
              console.log("Created placeholder group:", lTag)
            }

            // Group message or reaction - store under group ID
            console.log("Received group message for group:", lTag)
            void usePrivateMessagesStore.getState().upsert(lTag, publicKey, event)
            return
          }

          const pTag = getTag("p", event.tags)
          if (!pTag) return

          const from = pubKey === publicKey ? pTag : pubKey
          const to = pubKey === publicKey ? publicKey : pTag

          if (!from || !to) return

          void usePrivateMessagesStore.getState().upsert(from, to, event)
        })
      })
      .catch((error) => {
        console.error(
          "Failed to initialize session manager (possibly corrupt data):",
          error
        )
      })
  } catch (error) {
    console.error("Failed to attach session event listener", error)
  }
}

// Check if logged-in user has deleted account (Tauri only)
const checkDeletedAccount = async (publicKey: string) => {
  if (!isTauri()) {
    return
  }

  try {
    const user = ndk().getUser({pubkey: publicKey})
    await user.fetchProfile()
    if (user.profile?.deleted) {
      console.log("Detected deleted account, logging out")
      // Clear user state
      useUserStore.getState().reset()
      // Clear storage
      localStorage.clear()
      // Reload
      location.reload()
    }
  } catch (e) {
    console.error("Error checking deleted account:", e)
  }
}

// Move initialization to a function to avoid side effects
const initializeApp = async () => {
  ndk()

  // Initialize debug system
  DebugManager

  // Enable autostart on first launch if not already set (desktop only)
  if (isTauri()) {
    try {
      const {desktop} = useSettingsStore.getState()
      const autostartCurrentlyEnabled = await isAutostartEnabled()

      // If setting is true but autostart is disabled, enable it
      if (desktop.startOnBoot && !autostartCurrentlyEnabled) {
        await enableAutostart()
      }
    } catch (error) {
      console.error("Failed to initialize autostart:", error)
    }
  }

  // Initialize chat modules if we have a public key
  const state = useUserStore.getState()
  if (state.publicKey) {
    console.log("Initializing chat modules with existing user data")

    // Check for deleted account first
    void checkDeletedAccount(state.publicKey)

    subscribeToNotifications()
    subscribeToDMNotifications()
    migratePublicChats()
    socialGraph().recalculateFollowDistances()

    // Initialize mobile push notifications for Tauri
    if (window.__TAURI__) {
      pushNotifications.init().catch(console.error)
    }

    // Only initialize DM sessions if not in readonly mode
    if (state.privateKey || state.nip07Login) {
      attachSessionEventListener()
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
void initializeApp()

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

    // Check for deleted account when user logs in
    checkDeletedAccount(state.publicKey)

    subscribeToNotifications()
    subscribeToDMNotifications()
    migratePublicChats()

    // Only initialize DM sessions if not in readonly mode
    if (state.privateKey || state.nip07Login) {
      attachSessionEventListener()
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
    unsubscribeSessionEvents?.()
  })
}
