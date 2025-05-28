import {npubEncode} from "nostr-tools/nip19"
import {MouseEventHandler} from "react"

export interface NavItemConfig {
  to: string
  label: string
  icon?: string
  activeIcon?: string
  inactiveIcon?: string
  requireLogin?: boolean
  onClick?: MouseEventHandler<HTMLAnchorElement>
}

export const navItemsConfig = (myPubKey: string): Record<string, NavItemConfig> => ({
  home: {to: "/", icon: "home", label: "Home"},
  wallet: {
    to: "/wallet",
    icon: "wallet",
    label: "Wallet",
    requireLogin: true,
  },
  messages: {
    to: "/chats",
    icon: "mail",
    label: "Chats",
    requireLogin: true,
  },
  notifications: {
    to: "/notifications",
    icon: "notifications",
    label: "Notifications",
    requireLogin: true,
  },
  organizations: {
    to: "/organizations",
    activeIcon: "user-v2",
    inactiveIcon: "user-v2",
    label: "Organizations",
    requireLogin: true,
  },
  repositories: {
    to: `/${npubEncode(myPubKey)}/code`,
    activeIcon: "hard-drive",
    inactiveIcon: "hard-drive",
    label: "Repositories",
    requireLogin: true,
  },
  settings: {to: "/settings", icon: "settings", label: "Settings", requireLogin: true},
  subscription: {
    to: "/subscribe",
    icon: "star",
    label: "Subscription",
    requireLogin: true,
  },
  about: {to: "/about", icon: "info", label: "About"},
  search: {to: "/search", icon: "search", label: "Search"},
})
