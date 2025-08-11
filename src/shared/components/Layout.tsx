import {useLocation, useNavigate} from "@/navigation"
import NoteCreator from "@/shared/components/create/NoteCreator.tsx"
import LoginDialog from "@/shared/components/user/LoginDialog"
import NavSideBar from "@/shared/components/nav/NavSideBar"
import {clearNotifications} from "@/utils/notifications"
import {socialGraphLoaded} from "@/utils/socialGraph"
import Modal from "@/shared/components/ui/Modal.tsx"
import Footer from "@/shared/components/Footer.tsx"
import {useSettingsStore} from "@/stores/settings"
import ErrorBoundary from "./ui/ErrorBoundary"
import {useWalletProviderStore} from "@/stores/walletProvider"
import {useUIStore} from "@/stores/ui"
import {Helmet} from "react-helmet"
import {useEffect, ReactNode, useRef} from "react"
import {useIsLargeScreen} from "@/shared/hooks/useIsLargeScreen"
import HomeFeedEvents from "@/pages/home/feed/components/HomeFeedEvents"
import {ScrollProvider} from "@/contexts/ScrollContext"

const openedAt = Math.floor(Date.now() / 1000)

interface ServiceWorkerMessage {
  type: "NAVIGATE_REACT_ROUTER"
  url: string
}

const Layout = ({children}: {children: ReactNode}) => {
  const middleColumnRef = useRef<HTMLDivElement>(null)
  const newPostOpen = useUIStore((state) => state.newPostOpen)
  const setNewPostOpen = useUIStore((state) => state.setNewPostOpen)
  const navItemClicked = useUIStore((state) => state.navItemClicked)
  const {appearance} = useSettingsStore()
  const goToNotifications = useUIStore((state) => state.goToNotifications)
  const showLoginDialog = useUIStore((state) => state.showLoginDialog)
  const setShowLoginDialog = useUIStore((state) => state.setShowLoginDialog)
  const activeProviderType = useWalletProviderStore((state) => state.activeProviderType)
  const initializeProviders = useWalletProviderStore((state) => state.initializeProviders)
  const navigate = useNavigate()
  const location = useLocation()
  const isLargeScreen = useIsLargeScreen()

  const shouldShowMainFeed =
    !appearance.singleColumnLayout &&
    isLargeScreen &&
    !location.pathname.startsWith("/settings") &&
    !location.pathname.startsWith("/chats")

  socialGraphLoaded.then() // just make sure we start loading social the graph

  // Initialize wallet providers on app startup
  useEffect(() => {
    console.log("🔍 Layout: Initializing wallet providers")
    initializeProviders()
  }, [initializeProviders])

  // Scroll middle column when home is clicked (for two-column layout)
  useEffect(() => {
    if (navItemClicked.signal === 0 || navItemClicked.path !== "/" || !shouldShowMainFeed)
      return

    if (middleColumnRef.current) {
      middleColumnRef.current.scrollTo({top: 0, behavior: "instant"})
    }
  }, [navItemClicked, shouldShowMainFeed])

  useEffect(() => {
    if (goToNotifications > openedAt) {
      navigate("/notifications")
    }
  }, [navigate, goToNotifications])

  // Handle nav item clicks - no longer needed for scroll since each component manages its own
  // Keep this for potential future use with navItemClicked signal

  useEffect(() => {
    const handleServiceWorkerMessage = (event: MessageEvent<ServiceWorkerMessage>) => {
      if (event.data?.type === "NAVIGATE_REACT_ROUTER") {
        const url = new URL(event.data.url)
        if (url.pathname.match(/^\/chats\/[^/]+$/)) {
          const chatId = url.pathname.split("/").pop()
          navigate("/chats/chat", {state: {id: chatId}})
        } else {
          navigate(url.pathname + url.search + url.hash)
        }
      }
    }

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.addEventListener("message", handleServiceWorkerMessage)
      return () => {
        navigator.serviceWorker.removeEventListener("message", handleServiceWorkerMessage)
      }
    }
  }, [navigate])

  useEffect(() => {
    // clear potential push notifications when the app is opened
    clearNotifications()

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
    <div
      className={`relative flex flex-col w-full h-screen overflow-hidden ${appearance.limitedMaxWidth ? "max-w-screen-2xl mx-auto" : ""}`}
    >
      <div
        className="flex relative flex-1 overflow-hidden min-w-0 w-full"
        id="main-content"
      >
        <NavSideBar />
        {!appearance.singleColumnLayout && isLargeScreen && (
          <div
            ref={middleColumnRef}
            className={`flex-1 min-w-0 border-r border-base-300 overflow-y-scroll overflow-x-hidden scrollbar-hide ${
              shouldShowMainFeed ? "hidden lg:block" : "hidden"
            }`}
          >
            <ScrollProvider scrollContainerRef={middleColumnRef}>
              <HomeFeedEvents />
            </ScrollProvider>
          </div>
        )}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          {children}
          {activeProviderType !== "disabled" && (
            <iframe
              id="cashu-wallet"
              title="Background Cashu Wallet"
              src="/cashu/index.html#/"
              className="fixed top-0 left-0 w-0 h-0 border-none"
              style={{zIndex: -1}}
              referrerPolicy="no-referrer"
              sandbox="allow-scripts allow-same-origin allow-forms"
            />
          )}
        </div>
      </div>
      <ErrorBoundary>
        {newPostOpen && (
          <Modal onClose={() => setNewPostOpen(false)} hasBackground={false}>
            <div
              className="w-full max-w-prose rounded-2xl bg-base-100"
              onClick={(e) => e.stopPropagation()}
            >
              <NoteCreator handleClose={() => setNewPostOpen(false)} />
            </div>
          </Modal>
        )}
        {showLoginDialog && (
          <Modal onClose={() => setShowLoginDialog(false)}>
            <LoginDialog />
          </Modal>
        )}
      </ErrorBoundary>
      <Footer />
      <Helmet titleTemplate={`%s / ${CONFIG.appName}`} defaultTitle={CONFIG.appName}>
        <title>{CONFIG.appName}</title>
      </Helmet>
    </div>
  )
}

export default Layout
