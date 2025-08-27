import {lazy} from "react"
import {RouteDefinition} from "./types"

// Import pages
import NostrLinkHandler from "@/pages/NostrLinkHandler"
import Notifications from "@/pages/notifications/Notifications"
import WalletPage from "@/pages/wallet/WalletPage"
import {AboutPage} from "@/pages/HelpPage"
import SearchPage from "@/pages/search"
import HomePage from "@/pages/home"
import NewNote from "@/pages/new"

// Lazy load components
const ChatsPage = lazy(() => import("@/pages/chats"))
const SettingsPage = lazy(() => import("@/pages/settings"))
const SubscriptionPage = lazy(() => import("@/pages/subscription"))
const RelayPage = lazy(() => import("@/pages/relay"))
const MapPage = lazy(() => import("@/pages/map"))

export const routes: RouteDefinition[] = [
  {path: "/", component: HomePage, alwaysKeep: true},
  {path: "/new", component: NewNote},
  {path: "/notifications", component: Notifications},
  {path: "/wallet", component: WalletPage},
  {path: "/chats/*", component: ChatsPage},
  {path: "/settings/*", component: SettingsPage},
  {path: "/subscribe", component: SubscriptionPage},
  {path: "/search", component: SearchPage},
  {path: "/search/:query", component: SearchPage},
  {path: "/relay/:url?", component: RelayPage},
  {path: "/map", component: MapPage},
  {path: "/map/:geohash", component: MapPage},
  {path: "/about", component: AboutPage},
  {path: "/:link/*", component: NostrLinkHandler},
  {path: "/:link", component: NostrLinkHandler},
]
