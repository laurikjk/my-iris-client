import SocialGraphSettings from "@/pages/settings/SocialGraphSettings"
import {useLocation, Link} from "@/navigation"
import MediaServers from "@/pages/settings/Mediaservers.tsx"
import {ProfileSettings} from "@/pages/settings/Profile.tsx"
import NotificationSettings from "./NotificationSettings"
import Appearance from "@/pages/settings/Appearance.tsx"
import Header from "@/shared/components/header/Header"
import IrisSettings from "./IrisAccount/IrisSettings"
import {Network} from "@/pages/settings/Network.tsx"
import {RiArrowRightSLine} from "@remixicon/react"
import Icon from "@/shared/components/Icons/Icon"
import Account from "@/pages/settings/Account"
import WalletSettings from "./WalletSettings"
import SystemSettings from "./SystemSettings"
import Backup from "@/pages/settings/Backup"
import ChatSettings from "./ChatSettings"
import {Helmet} from "react-helmet"
import classNames from "classnames"
import {ReactElement} from "react"
import Content from "./Content"

interface SettingsItem {
  icon: string | ReactElement
  iconBg: string
  message: string
  path: string
}

interface SettingsGroup {
  title: string
  items: SettingsItem[]
}

function Settings() {
  const location = useLocation()
  const isSettingsRoot = location.pathname === "/settings"

  const settingsGroups: SettingsGroup[] = [
    {
      title: "User",
      items: [
        {
          icon: "profile",
          iconBg: "bg-green-500",
          message: "Profile",
          path: "/settings/profile",
        },
        {
          icon: "wallet-outline",
          iconBg: "bg-emerald-500",
          message: "Wallet",
          path: "/settings/wallet",
        },
        {
          icon: "profile",
          iconBg: "bg-purple-500",
          message: "iris.to username",
          path: "/settings/iris",
        },
        {
          icon: <Icon name="mail-outline" className="w-5 h-5" />, // Consistent with sidebar
          iconBg: "bg-blue-500",
          message: "Chat",
          path: "/settings/chat",
        },
      ],
    },
    {
      title: "Application",
      items: [
        {
          icon: "stars",
          iconBg: "bg-purple-500",
          message: "Appearance",
          path: "/settings/appearance",
        },
        {
          icon: "hard-drive",
          iconBg: "bg-yellow-500",
          message: "Content",
          path: "/settings/content",
        },
        {
          icon: "bell-outline",
          iconBg: "bg-green-500",
          message: "Notifications",
          path: "/settings/notifications",
        },
        {
          icon: "gear",
          iconBg: "bg-indigo-500",
          message: "System",
          path: "/settings/system",
        },
      ],
    },
    {
      title: "Data",
      items: [
        {
          icon: "relay",
          iconBg: "bg-blue-500",
          message: "Network",
          path: "/settings/network",
        },
        {
          icon: "media",
          iconBg: "bg-blue-500",
          message: "Media Servers",
          path: "/settings/mediaservers",
        },
        {
          icon: "key",
          iconBg: "bg-gray-500",
          message: "Backup",
          path: "/settings/backup",
        },
        {
          icon: "link",
          iconBg: "bg-teal-500",
          message: "Social Graph",
          path: "/settings/social-graph",
        },
      ],
    },
    {
      title: "Log out",
      items: [
        {
          icon: "key",
          iconBg: "bg-red-500",
          message: "Log out",
          path: "/settings/account",
        },
      ],
    },
  ]

  return (
    <div className="flex flex-col h-full">
      <Header title="Settings" />
      <div
        className="flex flex-1 overflow-y-scroll overflow-x-hidden scrollbar-hide relative"
        data-main-scroll-container="true"
        data-header-scroll-target
      >
        <div className="pt-[calc(4rem+env(safe-area-inset-top))] md:pt-0 flex w-full flex-col">
          <div className="flex w-full flex-1">
            <nav
              className={`sticky top-0 w-full lg:w-64 p-4 lg:h-screen ${
                isSettingsRoot ? "block" : "hidden"
              } lg:block lg:border-r border-custom`}
            >
              <div className="flex flex-col pb-[calc(4rem+env(safe-area-inset-bottom))] lg:pb-0">
                {settingsGroups.map((group, groupIndex) => (
                  <div key={groupIndex} className="mb-4">
                    <h3 className="font-bold text-xs text-base-content/50 uppercase tracking-wide mb-2">
                      {group.title}
                    </h3>
                    {group.items.map(({icon, iconBg, message, path}, index) => (
                      <Link
                        to={path}
                        key={path}
                        className={classNames(
                          "px-2.5 py-1.5 flex justify-between items-center border border-custom hover:bg-base-300",
                          {
                            "rounded-t-xl": index === 0,
                            "rounded-b-xl": index === group.items.length - 1,
                            "border-t-0": index !== 0,
                            "bg-base-100":
                              location.pathname === path ||
                              (isSettingsRoot && path === "/settings/profile"),
                          }
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`p-1 ${iconBg} rounded-lg flex justify-center items-center text-white`}
                          >
                            {typeof icon === "string" ? (
                              <Icon name={icon} size={18} />
                            ) : (
                              icon
                            )}
                          </div>
                          <span className="text-base font-semibold flex-grow">
                            {message}
                          </span>
                        </div>
                        <RiArrowRightSLine size={18} className="text-base-content" />
                      </Link>
                    ))}
                  </div>
                ))}
              </div>
            </nav>
            <div className={`flex-1 ${isSettingsRoot ? "hidden lg:block" : "block"}`}>
              <div className="p-4 mx-4 md:p-8 md:mt-16 rounded-lg bg-base-100 shadow">
                {(() => {
                  // Determine which component to show based on the path
                  const pathSegments = location.pathname.split("/").filter(Boolean)
                  const settingsPath = pathSegments[1] || "" // After filtering, settings is at index 0, subpage at index 1

                  switch (settingsPath) {
                    case "account":
                      return <Account />
                    case "network":
                      return <Network />
                    case "profile":
                      return <ProfileSettings />
                    case "iris":
                      return <IrisSettings />
                    case "content":
                      return <Content />
                    case "wallet":
                      return <WalletSettings />
                    case "backup":
                      return <Backup />
                    case "appearance":
                      return <Appearance />
                    case "mediaservers":
                      return <MediaServers />
                    case "social-graph":
                      return <SocialGraphSettings />
                    case "notifications":
                      return <NotificationSettings />
                    case "system":
                      return <SystemSettings />
                    case "chat":
                      return <ChatSettings />
                    default:
                      return <ProfileSettings />
                  }
                })()}
              </div>
            </div>
          </div>
          {/* Spacer for mobile footer */}
          <div className="h-44 md:hidden" aria-hidden="true" />
        </div>
      </div>
      <Helmet>
        <title>Settings</title>
      </Helmet>
    </div>
  )
}

export default Settings
