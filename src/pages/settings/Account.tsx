import {unsubscribeAll} from "@/utils/notifications"
import {useUserStore} from "@/stores/user"
import {MouseEvent, useState} from "react"
import {useNavigate, Link} from "react-router"
import localforage from "localforage"
import {ndk} from "@/utils/ndk"

function Account() {
  const store = useUserStore()
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const navigate = useNavigate()

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

  async function handleLogout(e: MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (
      !store.privateKey ||
      confirm("Log out? Make sure you have a backup of your secret key.")
    ) {
      setIsLoggingOut(true)

      try {
        // Try to unsubscribe from notifications first, while we still have the signer
        try {
          await unsubscribeAll()
        } catch (e) {
          console.error("Error unsubscribing from push notifications:", e)
        }

        await cleanupNDK()
        const {reset} = useUserStore.getState()
        reset()
      } catch (e) {
        console.error("Error during logout cleanup:", e)
      } finally {
        await cleanupStorage()
        await cleanupServiceWorker()
        navigate("/")
        location.reload() // quick & dirty way to ensure everything is reset, especially localState
      }
    }
  }

  return (
    <div>
      <h1 className="text-2xl mb-4">Log out</h1>
      <div className="flex flex-col gap-4">
        <small>Make sure you have a backup of your secret key before logging out.</small>
        <small>
          Your <b>Iris chats</b> and <b>Cashu wallet</b> on this device will be
          permanently deleted.
        </small>
        <div className="mt-2 flex gap-2">
          {store.privateKey && (
            <Link to="/settings/backup" className="btn btn-default">
              Backup
            </Link>
          )}
          <button
            className="btn btn-primary"
            onClick={handleLogout}
            disabled={isLoggingOut}
          >
            {isLoggingOut ? (
              <div className="loading loading-spinner loading-sm" />
            ) : (
              "Log out"
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

export default Account
