import {useNotificationsStore} from "@/stores/notifications"
import {useEffect} from "react"
import {useUserStore} from "@/stores/user"
import {startNotificationsSubscription} from "@/shared/components/feed/notificationsSubscription"

export default function UnseenNotificationsBadge() {
  const {latestNotification} = useNotificationsStore()
  const notificationsSeenAt = useNotificationsStore(
    (state) => state.notificationsSeenAt || 0
  )

  // Ensure we start the subscription as soon as the user is logged in
  const publicKey = useUserStore((state) => state.publicKey)

  useEffect(() => {
    if (publicKey) {
      startNotificationsSubscription(publicKey)
    }
  }, [publicKey])

  const shouldShow = notificationsSeenAt < latestNotification && latestNotification > 0

  return (
    <>
      {shouldShow && <div className="indicator-item badge badge-primary badge-xs"></div>}
    </>
  )
}
