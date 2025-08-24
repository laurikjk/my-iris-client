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
import {useEffect, ReactNode, useRef, useMemo} from "react"
import {useIsLargeScreen} from "@/shared/hooks/useIsLargeScreen"
import HomeFeed from "@/pages/home/feed/components/HomeFeed"
import {ScrollProvider} from "@/contexts/ScrollContext"
import Header from "@/shared/components/header/Header"
import {RiArrowLeftSLine, RiArrowRightSLine} from "@remixicon/react"
import useFollows from "@/shared/hooks/useFollows"
import {usePublicKey} from "@/stores/user"
import {
  useFeedStore,
  useFeedConfigs,
  useEnabledFeedIds,
  type FeedConfig,
} from "@/stores/feed"

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
  const {appearance, updateAppearance} = useSettingsStore()
  const goToNotifications = useUIStore((state) => state.goToNotifications)
  const showLoginDialog = useUIStore((state) => state.showLoginDialog)
  const setShowLoginDialog = useUIStore((state) => state.setShowLoginDialog)
  const activeProviderType = useWalletProviderStore((state) => state.activeProviderType)
  const initializeProviders = useWalletProviderStore((state) => state.initializeProviders)
  const navigate = useNavigate()
  const location = useLocation()
  const isLargeScreen = useIsLargeScreen()

  // Feed header logic for two-column layout
  const myPubKey = usePublicKey()
  const follows = useFollows(myPubKey, true)
  const {activeFeed, getAllFeedConfigs, loadFeedConfig} = useFeedStore()
  const enabledFeedIds = useEnabledFeedIds()
  const feedConfigs = useFeedConfigs()

  const allFeeds = useMemo(() => {
    return getAllFeedConfigs()
  }, [feedConfigs, enabledFeedIds, getAllFeedConfigs])

  const feeds = useMemo(() => {
    const feedsMap = new Map(allFeeds.map((feed) => [feed.id, feed]))
    return enabledFeedIds
      .map((id) => feedsMap.get(id))
      .filter((feed): feed is FeedConfig => feed !== undefined)
  }, [allFeeds, enabledFeedIds])

  const activeFeedItem = useMemo(
    () => feeds.find((f) => f.id === activeFeed) || feeds[0] || null,
    [activeFeed, feeds]
  )

  const activeFeedConfig = useMemo(
    () => loadFeedConfig(activeFeed),
    [loadFeedConfig, activeFeed, feedConfigs]
  )

  const feedName =
    follows.length <= 1
      ? "Home"
      : activeFeedConfig?.customName || activeFeedItem?.name || "Following"

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
            className={`flex-1 min-w-0 border-r border-base-300 flex flex-col ${
              shouldShowMainFeed ? "hidden lg:flex" : "hidden"
            }`}
          >
            <Header showBack={false} showNotifications={true}>
              <div className="flex items-center justify-between w-full">
                <span className="md:px-3 md:py-2">{feedName}</span>
                <button
                  className="p-2 bg-base-100 hover:bg-base-200 rounded-full transition-colors mt-1"
                  onClick={() =>
                    updateAppearance({singleColumnLayout: !appearance.singleColumnLayout})
                  }
                  title={
                    appearance.singleColumnLayout
                      ? "Expand to two columns"
                      : "Collapse to single column"
                  }
                >
                  {appearance.singleColumnLayout ? (
                    <RiArrowLeftSLine className="w-5 h-5" />
                  ) : (
                    <RiArrowRightSLine className="w-5 h-5" />
                  )}
                </button>
              </div>
            </Header>
            <div
              ref={middleColumnRef}
              className="flex-1 overflow-y-scroll overflow-x-hidden scrollbar-hide"
              data-main-scroll-container="middle-column"
              data-header-scroll-target
            >
              <ScrollProvider scrollContainerRef={middleColumnRef}>
                <HomeFeed />
              </ScrollProvider>
            </div>
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
              className="w-[600px] max-w-[90vw] rounded-2xl bg-base-100"
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
