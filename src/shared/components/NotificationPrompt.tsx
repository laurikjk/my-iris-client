import {subscribeToDMNotifications, subscribeToNotifications} from "@/utils/notifications"
import {useLocalState} from "irisdb-hooks/src/useLocalState"
import {useEffect, useState} from "react"

const NotificationPrompt = () => {
  const [showPrompt, setShowPrompt] = useState(false)
  const [notificationsDeclined, setNotificationsDeclined] = useLocalState(
    "notificationsDeclined",
    false
  )
  const [myPubKey] = useLocalState("user/publicKey", "")

  useEffect(() => {
    setShowPrompt(
      !!myPubKey &&
        window.Notification?.permission === "default" &&
        !notificationsDeclined
    )
  }, [notificationsDeclined, myPubKey])

  const handleEnableNotifications = () => {
    window.Notification?.requestPermission().then((permission) => {
      if (permission === "granted" || permission === "denied") {
        setShowPrompt(false)
      }
      subscribeToNotifications()
      subscribeToDMNotifications()
    })
  }

  const handleDeclineNotifications = () => {
    setNotificationsDeclined(true)
    setShowPrompt(false)
  }

  if (!showPrompt) return null

  return (
    <div className="w-full bg-neutral text-neutral-content p-4 flex justify-between items-center select-none flex-col md:flex-row gap-4">
      <span>Enable push notifications?</span>
      <div>
        <button className="btn btn-primary mr-2" onClick={handleEnableNotifications}>
          Enable
        </button>
        <button className="btn btn-neutral" onClick={handleDeclineNotifications}>
          No Thanks
        </button>
      </div>
    </div>
  )
}

export default NotificationPrompt
