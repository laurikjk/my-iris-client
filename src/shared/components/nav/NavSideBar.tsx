import {RiLoginBoxLine, RiLockLine, RiBugLine} from "@remixicon/react"
import {useRef, useMemo} from "react"
import NavLink from "./NavLink"

import {useWalletBalance} from "../../hooks/useWalletBalance"
import {NotificationNavItem} from "./NotificationNavItem"
import {SubscriptionNavItem} from "./SubscriptionNavItem"
import {MessagesNavItem} from "./MessagesNavItem"
import PublishButton from "../ui/PublishButton"
import ErrorBoundary from "../ui/ErrorBoundary"
import {formatAmount, isTauri} from "@/utils/utils"
import {usePublicKey, useUserStore} from "@/stores/user"
import {useWalletStore} from "@/stores/wallet"
import {useSettingsStore} from "@/stores/settings"
import {navItemsConfig} from "./navConfig"
import {UserRow} from "../user/UserRow"
import {useUIStore} from "@/stores/ui"
import {NavItem} from "./NavItem"
import {ndk} from "@/utils/ndk"
import {RelayConnectivityIndicator} from "../RelayConnectivityIndicator"

const NavSideBar = () => {
  const ref = useRef<HTMLDivElement>(null)
  const {setShowLoginDialog} = useUIStore()
  const {balance} = useWalletBalance()
  const {showBalanceInNav} = useWalletStore()
  const myPubKey = usePublicKey()
  const myPrivKey = useUserStore((state) => state.privateKey)
  const nip07Login = useUserStore((state) => state.nip07Login)
  const {debug} = useSettingsStore()

  const hasSigner = !!(myPrivKey || nip07Login)

  const navItems = useMemo(() => {
    const configItems = navItemsConfig()
    return Object.values(configItems).filter((item) => {
      // Hide Chats if no signer (view-only mode)
      if (item.label === "Chats" && !hasSigner) {
        return false
      }
      // Hide Subscription in Tauri apps
      if (item.label === "Subscription" && isTauri()) {
        return false
      }
      return !("requireLogin" in item) || (item.requireLogin && myPubKey)
    })
  }, [myPubKey, hasSigner])

  const logoUrl = CONFIG.navLogo

  return (
    <ErrorBoundary>
      <div
        ref={ref}
        className="bg-base-200 hidden md:sticky md:flex top-0 select-none md:w-20 xl:w-64 h-screen z-40 flex-col md:justify-between border-r border-custom overflow-y-scroll scrollbar-hide pt-[env(safe-area-inset-top)] flex-shrink-0"
      >
        <div className="flex flex-col items-start md:items-center xl:items-start gap-4 md:gap-2 xl:gap-4">
          <NavLink
            className="md:mb-2 xl:mb-0 mt-4 ml-4 md:ml-0 xl:ml-5 flex flex-row gap-2 items-center md:justify-center font-bold font-bold text-3xl"
            to="/"
          >
            <img className="w-8 h-8" src={logoUrl} />
            <span className="inline md:hidden xl:inline">{CONFIG.appName}</span>
          </NavLink>
          {myPubKey && !ndk().signer && (
            <div
              title="Read-only mode"
              className="px-4 py-2 mx-2 md:mx-0 xl:mx-2 flex items-center gap-2 text-error text-xl"
            >
              <RiLockLine className="w-6 h-6" />
              <span className="hidden xl:inline">Read-only mode</span>
            </div>
          )}
          {debug.enabled && (
            <NavLink
              to="/settings/system"
              title="Debug mode active - Click to manage"
              className="px-4 py-2 mx-2 md:mx-0 xl:mx-2 flex items-center gap-2 text-warning text-xl hover:bg-base-300 rounded-full"
            >
              <RiBugLine className="w-6 h-6" />
              <span className="hidden xl:inline">Debug mode</span>
            </NavLink>
          )}
          <ul className="menu px-2 py-0 text-xl flex flex-col gap-4 md:gap-2 xl:gap-4 rounded-2xl">
            {navItems.map(({to, icon, activeIcon, inactiveIcon, label, onClick}) => {
              if (label === "Chats") {
                return (
                  <MessagesNavItem label={label} key={to} to={to} onClick={onClick} />
                )
              }
              if (label === "Notifications") {
                return <NotificationNavItem key={to} to={to} onClick={onClick} />
              }
              if (label === "Subscription") {
                return <SubscriptionNavItem key={to} to={to} onClick={onClick} />
              }
              return (
                <NavItem
                  key={to}
                  to={to}
                  icon={icon}
                  activeIcon={activeIcon}
                  inactiveIcon={inactiveIcon}
                  label={label}
                  onClick={onClick}
                  badge={
                    label === "Wallet" && showBalanceInNav && balance !== null ? (
                      <span className="select-none">
                        {formatAmount(balance)}
                        <span className="text-[0.85em]">₿</span>
                      </span>
                    ) : undefined
                  }
                />
              )
            })}
          </ul>
          {myPubKey && ndk().signer && <PublishButton />}
          {!myPubKey && (
            <div className="ml-2 md:ml-0 xl:px-2 md:mt-2 hidden md:block xl:w-full">
              <button
                className="btn btn-primary btn-circle xl:w-full xl:rounded-full text-lg signup-btn"
                onClick={() => setShowLoginDialog(true)}
              >
                <RiLoginBoxLine className="xl:hidden" />
                <span className="hidden xl:inline">Sign up</span>
              </button>
            </div>
          )}
        </div>
        {myPubKey && (
          <>
            <div className="flex flex-col p-4 gap-2">
              <div className="flex justify-center md:justify-center xl:justify-start mb-2">
                <RelayConnectivityIndicator className="md:hidden xl:flex" />
                <RelayConnectivityIndicator className="hidden md:flex xl:hidden" />
              </div>
              <div className="flex-1">
                <UserRow
                  pubKey={myPubKey}
                  showBadge={false}
                  textClassName="md:hidden xl:inline font-bold"
                  avatarWidth={45}
                />
              </div>
            </div>
          </>
        )}
      </div>
    </ErrorBoundary>
  )
}

export default NavSideBar
