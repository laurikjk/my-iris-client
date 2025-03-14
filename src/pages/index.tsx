import {createBrowserRouter, createRoutesFromElements, Route} from "react-router"
import {lazy, Suspense} from "react"

import {LoadingFallback} from "@/shared/components/LoadingFallback"
import NostrLinkHandler from "@/pages/NostrLinkHandler.tsx"
import Notifications from "./notifications/Notifications"
import Layout from "@/shared/components/Layout"
import WalletPage from "./wallet/WalletPage"
import {AboutPage} from "@/pages/HelpPage"
import SearchPage from "@/pages/search"
import HomePage from "@/pages/home"

// Lazy load components
const MessagesPage = lazy(() => import("@/pages/messages"))
const SettingsPage = lazy(() => import("@/pages/settings"))
const Explorer = lazy(() => import("@/pages/explorer/Explorer"))

export const router = createBrowserRouter(
  createRoutesFromElements([
    <Route key={1} element={<Layout />}>
      <Route path="/" element={<HomePage />} />
      <Route path="/notifications" element={<Notifications />} />
      <Route path="/wallet" element={<WalletPage />} />
      <Route
        path="/messages/*"
        element={
          <Suspense fallback={<LoadingFallback />}>
            <MessagesPage />
          </Suspense>
        }
      />
      <Route
        path="/settings/*"
        element={
          <Suspense fallback={<LoadingFallback />}>
            <SettingsPage />
          </Suspense>
        }
      />
      <Route
        path="/explorer/:file?"
        element={
          <Suspense fallback={<LoadingFallback />}>
            <Explorer />
          </Suspense>
        }
      />
      <Route path="/search/:query?" element={<SearchPage />} />
      <Route path="/about" element={<AboutPage />} />
      <Route path="/:link/*" element={<NostrLinkHandler />} />
    </Route>,
  ])
)
