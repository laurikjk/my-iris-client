import UnseenNotificationsBadge from "./UnseenNotificationsBadge"
import {usePublicKey} from "@/stores/user"
import {NavLink} from "@/navigation"
import Icon from "../Icons/Icon"

export default function NotificationButton() {
  const myPubKey = usePublicKey()

  return (
    <>
      {myPubKey && (
        <NavLink
          to={`/notifications`}
          className={({isActive}) =>
            `btn btn-ghost btn-circle -ml-2 ${isActive ? "active" : ""}`
          }
        >
          {({isActive}) => (
            <span className="indicator">
              <UnseenNotificationsBadge />
              <Icon name={isActive ? "bell-solid" : "bell-outline"} className="w-5 h-5" />
            </span>
          )}
        </NavLink>
      )}
    </>
  )
}
