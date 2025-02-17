import NoteCreator from "@/shared/components/create/NoteCreator.tsx"
import {useInviteLinkFromUrl} from "../hooks/useInviteLinkFromUrl"
import {Outlet, useLocation, useNavigate} from "react-router-dom"
import LoginDialog from "@/shared/components/user/LoginDialog"
import NavSideBar from "@/shared/components/NavSideBar.tsx"
import Header from "@/shared/components/header/Header.tsx"
import {clearNotifications} from "@/utils/notifications"
import {socialGraphLoaded} from "@/utils/socialGraph"
import Modal from "@/shared/components/ui/Modal.tsx"
import Footer from "@/shared/components/Footer.tsx"
import ErrorBoundary from "./ui/ErrorBoundary"
import {trackEvent} from "@/utils/SnortApi"
import {useLocalState} from "irisdb-hooks"
import {Helmet} from "react-helmet"
import {useEffect} from "react"

const openedAt = Math.floor(Date.now() / 1000)

interface ServiceWorkerMessage {
  type: "NAVIGATE_REACT_ROUTER"
  url: string
}

const Layout = () => {
  const [newPostOpen, setNewPostOpen] = useLocalState("home/newPostOpen", false)
  const [enableAnalytics] = useLocalState("settings/enableAnalytics", true)
  const [goToNotifications] = useLocalState("goToNotifications", 0)
  const [showLoginDialog, setShowLoginDialog] = useLocalState(
    "home/showLoginDialog",
    false
  )
  const navigate = useNavigate()
  const location = useLocation()

  useInviteLinkFromUrl()

  socialGraphLoaded.then() // just make sure we start loading social the graph

  useEffect(() => {
    if (goToNotifications > openedAt) {
      navigate("/notifications")
    }
  }, [navigate, goToNotifications])

  useEffect(() => {
    const isMessagesRoute = location.pathname.startsWith("/messages/")
    const isSearchRoute = location.pathname.startsWith("/search/")
    if (
      CONFIG.features.analytics &&
      enableAnalytics &&
      !isMessagesRoute &&
      !isSearchRoute
    ) {
      trackEvent("pageview")
    }
  }, [location])

  useEffect(() => {
    const handleServiceWorkerMessage = (event: MessageEvent<ServiceWorkerMessage>) => {
      if (event.data?.type === "NAVIGATE_REACT_ROUTER") {
        const url = new URL(event.data.url)
        navigate(url.pathname + url.search + url.hash)
      }
    }

    navigator.serviceWorker.addEventListener("message", handleServiceWorkerMessage)
    return () => {
      navigator.serviceWorker.removeEventListener("message", handleServiceWorkerMessage)
    }
  }, [navigate])

  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState === "visible") {
        await clearNotifications()
      }
    }

    const handleFocus = async () => {
      await clearNotifications()
    }

    document.addEventListener("visibilitychange", handleVisibilityChange)
    window.addEventListener("focus", handleFocus)

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange)
      window.removeEventListener("focus", handleFocus)
    }
  }, [])

  return (
    <div className="relative flex flex-col w-full max-w-screen-xl min-h-screen overscroll-none">
      <Header />
      <div className="flex relative min-h-screen flex-1 overscroll-none">
        <NavSideBar />
        <div className="flex-1 min-h-screen py-16 md:py-0 overscroll-none mb-[env(safe-area-inset-bottom)]">
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </div>
      </div>
      {newPostOpen && (
        <Modal onClose={() => setNewPostOpen(!newPostOpen)} hasBackground={false}>
          <div
            className="w-full max-w-prose rounded-2xl bg-base-100"
            onClick={(e) => e.stopPropagation()}
          >
            <NoteCreator handleClose={() => setNewPostOpen(!newPostOpen)} />
          </div>
        </Modal>
      )}
      {showLoginDialog && (
        <Modal onClose={() => setShowLoginDialog(false)}>
          <LoginDialog />
        </Modal>
      )}
      <Footer /> {/* Add Footer component here */}
      <Helmet titleTemplate={`%s / ${CONFIG.appName}`} defaultTitle={CONFIG.appName}>
        <title>{CONFIG.appName}</title>
      </Helmet>
    </div>
  )
}

export default Layout
