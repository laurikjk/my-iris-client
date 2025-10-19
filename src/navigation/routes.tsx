import {lazy} from "react"
import {RouteDefinition} from "./types"

// Import pages
import NostrLinkHandler from "@/pages/NostrLinkHandler"
import Notifications from "@/pages/notifications/Notifications"
import CashuWallet from "@/pages/wallet/CashuWallet"
import OldWallet from "@/pages/wallet/OldWallet"
import {AboutPage} from "@/pages/AboutPage"
import SearchPage from "@/pages/search"
import HomePage from "@/pages/home"
import NewNote from "@/pages/new"

// Lazy load components
const ChatsPage = lazy(() => import("@/pages/chats"))
const SettingsPage = lazy(() => import("@/pages/settings"))
const SubscriptionPage = lazy(() => import("@/pages/subscription"))
const RelayPage = lazy(() => import("@/pages/relay"))
const MapPage = lazy(() => import("@/pages/map"))
const MarketPage = lazy(() => import("@/pages/market"))
const UserSearchPage = lazy(() => import("@/pages/user-search"))

export const routes: RouteDefinition[] = [
  {path: "/", component: HomePage, alwaysKeep: true},
  {path: "/new", component: NewNote},
  {path: "/notifications", component: Notifications},
  {path: "/wallet", component: CashuWallet},
  {path: "/old-wallet", component: OldWallet},
  {path: "/chats/*", component: ChatsPage},
  {path: "/settings/*", component: SettingsPage},
  {path: "/subscribe", component: SubscriptionPage},
  {path: "/search", component: SearchPage},
  {path: "/search/:query", component: SearchPage},
  {path: "/m", component: MarketPage},
  {path: "/m/:category", component: MarketPage},
  {path: "/u", component: UserSearchPage},
  {path: "/u/:query", component: UserSearchPage},
  {path: "/relay", component: RelayPage},
  {path: "/relay/:url", component: RelayPage},
  {path: "/map", component: MapPage},
  {path: "/map/:query", component: MapPage},
  {path: "/about", component: AboutPage},
  {path: "/:link/*", component: NostrLinkHandler},
  {path: "/:link", component: NostrLinkHandler},
]
