import classNames from "classnames"
import {ReactNode} from "react"
import {RiLockLine} from "@remixicon/react"

import PublishButton from "@/shared/components/ui/PublishButton"
import {useWalletBalance} from "@/shared/hooks/useWalletBalance"
import NavLink from "@/shared/components/nav/NavLink" // Adjusted import path
import Icon from "@/shared/components/Icons/Icon" // Add this import
import {Avatar} from "@/shared/components/user/Avatar"
import ErrorBoundary from "./ui/ErrorBoundary"
import {formatAmount} from "@/utils/utils"
import {nip19} from "nostr-tools"
import {useUserStore} from "@/stores/user"
import {useLocation} from "@/navigation"
import {ndk} from "@/utils/ndk"
import {useUIStore} from "@/stores/ui"

type MenuItem = {
  label?: string
  icon?: string
  link?: string
  loggedInOnly?: boolean
  requireSigner?: boolean
  el?: ReactNode
  activeIcon?: string
  inactiveIcon?: string
  badge?: string
}

const Footer = () => {
  const readonly = false
  const location = useLocation()
  const {balance} = useWalletBalance()
  const myPubKey = useUserStore((state) => state.publicKey)

  const MENU_ITEMS: MenuItem[] = [
    {link: "/", icon: "home"},
    {
      link: "/wallet",
      icon: "wallet",
      loggedInOnly: true,
      badge: balance !== null ? formatAmount(balance) : undefined,
    },
    {
      el: (
        <div className="flex flex-grow items-center justify-center">
          <PublishButton showLabel={false} />
        </div>
      ),
      loggedInOnly: true,
      requireSigner: true,
    },
  ]

  if (location.pathname.startsWith("/chats/") && !location.pathname.endsWith("/new")) {
    return null
  }

  return (
    // -mb-[1px] because weird 1px gap under footer?
    <ErrorBoundary>
      <footer className="-mb-[1px] md:hidden fixed bottom-0 z-10 w-full bg-base-200 pb-[env(safe-area-inset-bottom)] bg-bg-color">
        {myPubKey && !ndk().signer && (
          <div className="flex items-center justify-center gap-1 text-error text-xs py-1 border-b border-error/20">
            <RiLockLine className="w-3 h-3" />
            <span>Read-only mode</span>
          </div>
        )}
        <div className="flex">
          {MENU_ITEMS.map(
            (item, index) =>
              (myPubKey || !item.loggedInOnly) &&
              (!item.requireSigner || (item.requireSigner && ndk().signer)) && (
                <FooterNavItem key={index} item={item} readonly={readonly} />
              )
          )}
          <FooterNavItem item={{link: "/search", icon: "search"}} readonly={readonly} />
          {myPubKey && (
            <NavLink
              to={`/${nip19.npubEncode(myPubKey)}`}
              onClick={() => useUIStore.getState().setIsSidebarOpen(false)}
              className={({isActive}) =>
                classNames(
                  {active: isActive},
                  "flex flex-grow p-4 justify-center items-center cursor-pointer"
                )
              }
            >
              {({isActive}) => (
                <div
                  className={classNames("rounded-full", {
                    "ring-2 ring-primary": isActive,
                  })}
                >
                  <Avatar pubKey={myPubKey} width={24} showBadge={false} />
                </div>
              )}
            </NavLink>
          )}
        </div>
      </footer>
    </ErrorBoundary>
  )
}

const FooterNavItem = ({item}: {item: MenuItem; readonly: boolean}) => {
  const {setIsSidebarOpen} = useUIStore()

  if (item.el) {
    return item.el
  }

  const handleClick = () => {
    setIsSidebarOpen(false)
  }

  return (
    <NavLink
      to={item.link ?? "/"}
      onClick={handleClick}
      className={({isActive}) =>
        classNames(
          {active: isActive},
          "flex flex-grow p-4 justify-center items-center cursor-pointer"
        )
      }
    >
      {({isActive}) => (
        <span className="indicator">
          {renderIcon(item, isActive)}
          {item.badge && (
            <span className="badge badge-xs absolute -left-4 -bottom-3">
              {item.badge}
            </span>
          )}
        </span>
      )}
    </NavLink>
  )
}

const renderIcon = (item: MenuItem, isActive: boolean) => {
  let iconName
  if (item.activeIcon && item.inactiveIcon) {
    iconName = isActive ? item.activeIcon : item.inactiveIcon
  } else {
    iconName = `${item.icon}-${isActive ? "solid" : "outline"}`
  }

  return (item.icon || item.activeIcon) && <Icon className="w-5 h-5" name={iconName} />
}

export default Footer
