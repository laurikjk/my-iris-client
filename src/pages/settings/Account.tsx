import {unsubscribeAll} from "@/utils/notifications"
import {useUserStore} from "@/stores/user"
// import {useUserRecordsStore} from "@/stores/userRecords" // TEMP: Removed
import {usePrivateMessagesStore} from "@/stores/privateMessages"
import {useDraftStore} from "@/stores/draft"
import {MouseEvent, useEffect, useState} from "react"
import {useNavigate} from "@/navigation"
import localforage from "localforage"
import {ndk} from "@/utils/ndk"
import {NDKEvent} from "@nostr-dev-kit/ndk"
import {SettingsGroup} from "@/shared/components/settings/SettingsGroup"
import {SettingsGroupItem} from "@/shared/components/settings/SettingsGroupItem"
import {useWalletProviderStore} from "@/stores/walletProvider"
import {SettingsButton} from "@/shared/components/settings/SettingsButton"

// Helper function to add timeout to any promise
const withTimeout = (promise: Promise<unknown>, ms: number): Promise<unknown> => {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`Operation timeout after ${ms}ms`)), ms)
    ),
  ])
}

function Account() {
  const store = useUserStore()
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [cashuBalance, setCashuBalance] = useState<number | null>(null)
  const navigate = useNavigate()
  const {activeProviderType, nwcConnections, activeNWCId, getBalance} =
    useWalletProviderStore()

  useEffect(() => {
    const fetchBalance = async () => {
      if (activeProviderType === "nwc" && activeNWCId) {
        const connection = nwcConnections.find((c) => c.id === activeNWCId)
        if (connection?.isLocalCashuWallet) {
          try {
            const balance = await getBalance()
            setCashuBalance(balance ?? connection.balance ?? null)
          } catch (error) {
            console.error("Error getting Cashu balance:", error)
            // Fall back to stored balance if live call fails
            setCashuBalance(connection.balance ?? null)
          }
        } else {
          setCashuBalance(null)
        }
      } else {
        setCashuBalance(null)
      }
    }

    fetchBalance()
  }, [activeProviderType, activeNWCId, nwcConnections, getBalance])

  async function cleanupNDK() {
    const ndkInstance = ndk()
    ndkInstance.signer = undefined
    ndkInstance.activeUser = undefined
    ndkInstance.pool.relays.forEach((relay) => {
      relay.disconnect()
    })
    ndkInstance.pool.relays.clear()
  }

  async function cleanupStorage() {
    try {
      localStorage.clear()
      await localforage.clear()
    } catch (err) {
      console.error("Error clearing storage:", err)
    }
  }

  async function cleanupStores() {
    try {
      // Clear events store (clears message repository)
      await usePrivateMessagesStore.getState().clear()

      // TEMP: Skip resetting userRecords store
      // useUserRecordsStore.getState().reset()
      useDraftStore.getState().clearAll()

      // For stores without reset methods, we'll rely on storage clearing
      console.log("All stores cleaned up")
    } catch (err) {
      console.error("Error cleaning up stores:", err)
    }
  }

  async function publishInviteTombstones() {
    try {
      // TEMP: Skip publishing invite tombstones
      const invites = new Map() // useUserRecordsStore.getState().getOwnDeviceInvites()
      for (const invite of invites.values()) {
        const deletionEvent = new NDKEvent(ndk(), {
          kind: 30078,
          pubkey: invite.inviter,
          content: "",
          created_at: Math.floor(Date.now() / 1000),
          tags: [["d", "double-ratchet/invites/" + invite.deviceId]],
        })
        try {
          await deletionEvent.publish()
        } catch (e) {
          console.warn("Error publishing invite tombstone", e)
        }
      }
    } catch (e) {
      console.error("Failed to publish invite tombstones", e)
    }
  }

  async function cleanupServiceWorker() {
    if (!("serviceWorker" in navigator)) return

    try {
      const reg = await navigator.serviceWorker.ready
      const existingSub = await reg.pushManager.getSubscription()
      if (existingSub) {
        await existingSub.unsubscribe()
        console.log("Unsubscribed from push notifications")
      }
    } catch (e) {
      console.error("Error unsubscribing from service worker:", e)
    }
  }

  async function handleLogout(e?: MouseEvent) {
    e?.preventDefault()
    e?.stopPropagation()
    if (
      !store.privateKey ||
      confirm("Log out? Make sure you have a backup of your secret key.")
    ) {
      setIsLoggingOut(true)

      try {
        // Try to unsubscribe from notifications first, while we still have the signer
        try {
          await withTimeout(unsubscribeAll(), 3000)
        } catch (e) {
          console.error("Error unsubscribing from push notifications:", e)
        }

        // Clean up stores first (while we still have access to data)
        try {
          await withTimeout(cleanupStores(), 3000)
        } catch (e) {
          console.error("Error cleaning up stores:", e)
        }

        try {
          await publishInviteTombstones()
        } catch (e) {
          console.error("Error publishing invite tombstones:", e)
        }

        await withTimeout(cleanupNDK(), 3000)
        const {reset} = useUserStore.getState()
        reset()
      } catch (e) {
        console.error("Error during logout cleanup:", e)
      } finally {
        try {
          await withTimeout(Promise.all([cleanupStorage(), cleanupServiceWorker()]), 5000)
        } catch (e) {
          console.error("Error during final cleanup:", e)
        } finally {
          // Ensure spinner always stops and navigation happens
          setIsLoggingOut(false)
          navigate("/")
          location.reload()
        }
      }
    }
  }

  return (
    <div className="bg-base-200 min-h-full">
      <div className="p-4">
        <div className="space-y-6">
          <SettingsGroup title="Log out">
            <SettingsGroupItem>
              <div className="flex flex-col gap-3">
                <div className="text-sm text-base-content/70">
                  Make sure you have a backup of your secret key before logging out.
                </div>
                <div className="text-sm text-base-content/70">
                  Your <span className="font-medium">Iris chats</span> and{" "}
                  <span className="font-medium">Cashu wallet</span> on this device will be
                  permanently deleted.
                </div>
                {cashuBalance !== null && cashuBalance > 0 && (
                  <div className="text-sm text-warning font-medium">
                    Your Cashu wallet contains {cashuBalance} sats that will be lost!
                  </div>
                )}
              </div>
            </SettingsGroupItem>

            {store.privateKey && (
              <SettingsGroupItem onClick={() => navigate("/settings/backup")}>
                <div className="flex items-center justify-between">
                  <span>Backup secret key</span>
                  <svg
                    className="w-5 h-5 text-base-content/40"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </div>
              </SettingsGroupItem>
            )}

            <SettingsButton
              label={isLoggingOut ? "Logging out..." : "Log out"}
              onClick={handleLogout}
              variant="destructive"
              isLast
              disabled={isLoggingOut}
            />
          </SettingsGroup>
        </div>
      </div>
    </div>
  )
}

export default Account
