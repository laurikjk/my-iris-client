import {invoke} from "@tauri-apps/api/core"
import {isPermissionGranted, requestPermission} from "@tauri-apps/plugin-notification"
import {platform} from "@tauri-apps/plugin-os"
import IrisAPI from "./IrisAPI"
import {useSettingsStore} from "@/stores/settings"

// Platform-specific push token registration
declare global {
  interface Window {
    // iOS - will be injected by native code
    iosRegisterPushToken?: (token: string) => void
    // Android - will be injected by native code
    androidRegisterPushToken?: (token: string) => void
  }
}

let isInitialized = false

export async function initPushNotifications() {
  if (isInitialized) return
  isInitialized = true

  try {
    const currentPlatform = await platform()
    console.log("Initializing push notifications for platform:", currentPlatform)

    // Request notification permission
    let permissionGranted = await isPermissionGranted()
    if (!permissionGranted) {
      const permission = await requestPermission()
      permissionGranted = permission === "granted"
    }

    if (!permissionGranted) {
      console.log("Notification permission not granted")
      return
    }

    // Setup platform-specific push token handlers
    if (currentPlatform === "ios") {
      setupIOSPushNotifications()
    } else if (currentPlatform === "android") {
      setupAndroidPushNotifications()
    }
  } catch (error) {
    console.error("Failed to initialize push notifications:", error)
  }
}

function setupIOSPushNotifications() {
  // This will be called by iOS native code when token is received
  window.iosRegisterPushToken = async (token: string) => {
    console.log("Received iOS push token")
    await registerTokenWithServer(token, "ios")
  }

  // Request iOS to register for remote notifications
  // This needs to be handled in the iOS native code
  if (window.webkit?.messageHandlers?.pushNotification?.postMessage) {
    window.webkit.messageHandlers.pushNotification.postMessage({action: "register"})
  }
}

function setupAndroidPushNotifications() {
  // This will be called by Android native code when token is received
  window.androidRegisterPushToken = async (token: string) => {
    console.log("Received Android FCM token")
    await registerTokenWithServer(token, "android")
  }

  // Request Android to register for FCM
  // This needs to be handled in the Android native code
  if (window.Android?.registerForPushNotifications) {
    window.Android.registerForPushNotifications()
  }
}

async function registerTokenWithServer(token: string, platformType: "ios" | "android") {
  try {
    // First register with Tauri backend
    await invoke("register_push_token", {token, platform: platformType})

    // Then send to notification server
    const settings = useSettingsStore.getState()
    const api = new IrisAPI(settings.notifications.server)

    // Get existing subscription or create new one
    const subscriptions = await api.getNotificationSubscriptions()

    // Find subscription for current user
    const myPubKey = localStorage.getItem("userPublicKey") // Adjust based on your app
    if (!myPubKey) {
      console.error("No user public key found")
      return
    }

    const notificationFilter = {
      "#p": [myPubKey],
      kinds: [1, 6, 7, 9735], // Text, Repost, Reaction, Zap
    }

    // Find existing subscription
    let subscriptionId: string | null = null
    let existingSubscription = null

    for (const [id, sub] of Object.entries(subscriptions)) {
      if (sub.filter["#p"]?.includes(myPubKey)) {
        subscriptionId = id
        existingSubscription = sub
        break
      }
    }

    // Prepare the token arrays
    const fcmTokens = platformType === "android" ? [token] : []
    const apnsTokens = platformType === "ios" ? [token] : []

    if (existingSubscription) {
      // Update existing subscription
      const updatedSub = {
        ...existingSubscription,
        fcm_tokens:
          platformType === "android"
            ? [...(existingSubscription.fcm_tokens || []), token]
            : existingSubscription.fcm_tokens || [],
        apns_tokens:
          platformType === "ios"
            ? [...(existingSubscription.apns_tokens || []), token]
            : existingSubscription.apns_tokens || [],
      }

      // Remove duplicates
      updatedSub.fcm_tokens = [...new Set(updatedSub.fcm_tokens)]
      updatedSub.apns_tokens = [...new Set(updatedSub.apns_tokens)]

      await api.updateNotificationSubscription(subscriptionId!, updatedSub)
    } else {
      // Create new subscription
      await api.registerPushNotifications([], notificationFilter, {
        fcm_tokens: fcmTokens,
        apns_tokens: apnsTokens,
      })
    }

    console.log(`Successfully registered ${platformType} push token with server`)

    // Store token locally for reference
    localStorage.setItem(`push_token_${platformType}`, token)
  } catch (error) {
    console.error("Failed to register push token with server:", error)
  }
}

// Handle incoming push notifications
export function handlePushNotification(data: unknown) {
  console.log("Received push notification:", data)

  // Parse the notification data based on your server format
  if (typeof data === "object" && data && "event" in data) {
    // Navigate to the appropriate screen
    const eventData =
      typeof data.event === "string" ? JSON.parse(data.event) : (data.event as any)

    // Handle different event kinds
    switch (eventData.kind) {
      case 443: // DM
      case 444: // DM
        // Navigate to chats
        window.location.href = `/chats/${eventData.sessionId || ""}`
        break
      default:
        // Navigate to the note
        if ("url" in data && typeof data.url === "string") {
          window.location.href = data.url
        }
    }
  }
}

// Export for use in app initialization
export default {
  init: initPushNotifications,
  handleNotification: handlePushNotification,
}
