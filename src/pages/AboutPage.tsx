import {
  RiInformationLine,
  RiMessage3Line,
  RiGithubLine,
  RiRefreshLine,
  RiUserFollowLine,
  RiHeartLine,
  RiDownload2Line,
  RiFileTextLine,
} from "@remixicon/react"
import RightColumn from "@/shared/components/RightColumn"
import AlgorithmicFeed from "@/shared/components/feed/AlgorithmicFeed"
import Header from "@/shared/components/header/Header"
import Widget from "@/shared/components/ui/Widget"
import {useState, useEffect} from "react"
import {Link} from "@/navigation"
import {openExternalLink, isTauri} from "@/utils/utils"

export const AboutPage = () => {
  const [updateAvailable, setUpdateAvailable] = useState(false)
  const buildTime = import.meta.env.VITE_BUILD_TIME || "development"

  const formatBuildTime = (timestamp: string) => {
    if (timestamp === "development") return timestamp
    try {
      const date = new Date(timestamp)
      return new Intl.DateTimeFormat("default", {
        dateStyle: "medium",
        timeStyle: "medium",
      }).format(date)
    } catch {
      return timestamp
    }
  }

  useEffect(() => {
    // Check for service worker updates
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.ready.then((registration) => {
        registration.addEventListener("controllerchange", () => {
          setUpdateAvailable(true)
        })
      })
    }
  }, [])

  const refreshApp = () => {
    window.location.reload()
  }

  const checkForUpdates = () => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.ready.then((registration) => {
        registration.update().catch(console.error)
      })
    }
  }

  // Check for updates when the page loads
  useEffect(() => {
    checkForUpdates()
  }, [])

  return (
    <div className="flex justify-center">
      <div className="flex-1">
        <section className="flex flex-col">
          <Header title="About" />
          <div className="flex flex-1 mx-4 my-4 lg:mx-8 pt-[calc(4rem+env(safe-area-inset-top))] pb-[calc(4rem+env(safe-area-inset-bottom))] md:pt-0 md:pb-0">
            <div className="prose max-w-prose">
              <h1>About</h1>
              <p>{CONFIG.aboutText}</p>

              <h2>Getting Started</h2>
              <p>
                <a
                  href="https://soapbox.pub/blog/nostr101/"
                  onClick={(e) => {
                    e.preventDefault()
                    openExternalLink("https://soapbox.pub/blog/nostr101/")
                  }}
                  className="flex items-center gap-1 w-fit"
                >
                  <RiInformationLine className="inline" /> What is Nostr?
                </a>
              </p>
              <p>
                <a
                  href="https://following.space/"
                  onClick={(e) => {
                    e.preventDefault()
                    openExternalLink("https://following.space/")
                  }}
                  className="flex items-center gap-1 w-fit"
                >
                  <RiUserFollowLine className="inline" /> Find people to follow
                </a>
              </p>

              <h2>Community</h2>
              <p>
                <Link
                  to="/chats/1d2f13b495d7425b70298a8acd375897a632562043d461e89b63499363eaf8e7"
                  className="flex items-center gap-1 w-fit"
                >
                  <RiMessage3Line className="inline" /> Iris feedback, support and
                  discussion chat
                </Link>
              </p>
              <p>
                <Link to="/subscribe" className="flex items-center gap-1 w-fit">
                  <RiHeartLine className="inline" /> Subscribe to support Iris development
                </Link>
              </p>

              {!isTauri() && (
                <>
                  <h2>Download</h2>
                  <p>
                    <a
                      href="https://apps.apple.com/en/app/iris-the-nostr-client/id1665849007"
                      onClick={(e) => {
                        e.preventDefault()
                        openExternalLink(
                          "https://apps.apple.com/en/app/iris-the-nostr-client/id1665849007"
                        )
                      }}
                      className="flex items-center gap-1 w-fit"
                    >
                      <RiDownload2Line className="inline" /> iOS App Store
                    </a>
                  </p>
                  <p>
                    <a
                      href="https://zapstore.dev/apps/naddr1qvzqqqr7pvpzq3frhevd89d3kxt2nwxg9vpck6y4evptdq7scff6j4gx3kapltxsqqrhgmewd9exjucxe8nj5"
                      onClick={(e) => {
                        e.preventDefault()
                        openExternalLink(
                          "https://zapstore.dev/apps/naddr1qvzqqqr7pvpzq3frhevd89d3kxt2nwxg9vpck6y4evptdq7scff6j4gx3kapltxsqqrhgmewd9exjucxe8nj5"
                        )
                      }}
                      className="flex items-center gap-1 w-fit"
                    >
                      <RiDownload2Line className="inline" /> Android Zapstore
                    </a>
                  </p>
                  <p>
                    <a
                      href="https://github.com/irislib/iris-client/releases"
                      onClick={(e) => {
                        e.preventDefault()
                        openExternalLink("https://github.com/irislib/iris-client/releases")
                      }}
                      className="flex items-center gap-1 w-fit"
                    >
                      <RiDownload2Line className="inline" /> Desktop
                    </a>
                  </p>
                </>
              )}

              <h2>Developers</h2>
              <p>
                <a
                  href={CONFIG.repository}
                  onClick={(e) => {
                    e.preventDefault()
                    openExternalLink(CONFIG.repository)
                  }}
                  className="flex items-center gap-1 w-fit"
                >
                  <RiGithubLine className="inline" /> Source code
                </a>
              </p>

              <h2>Legal</h2>
              <p>
                <Link to="/terms" className="flex items-center gap-1 w-fit">
                  <RiFileTextLine className="inline" /> Terms of Service
                </Link>
              </p>
              <p>
                <Link to="/privacy" className="flex items-center gap-1 w-fit">
                  <RiFileTextLine className="inline" /> Privacy Policy
                </Link>
              </p>

              <h2>Application</h2>
              <div className="mt-4">
                <p>
                  Version:{" "}
                  {isTauri() ? (
                    <>
                      <span className="line-through opacity-50">Web</span> /{" "}
                      <strong>Native</strong>
                    </>
                  ) : (
                    <>
                      <strong>Web</strong> / <span className="line-through opacity-50">Native</span>
                    </>
                  )}
                </p>
                <p>App build time: {formatBuildTime(buildTime)}</p>
              </div>

              <div className="mt-6">
                <button
                  className={`btn btn-primary ${updateAvailable ? "animate-pulse" : ""}`}
                  onClick={refreshApp}
                >
                  <RiRefreshLine className="inline mr-1" />
                  {updateAvailable
                    ? "Update Available - Click to Refresh"
                    : "Refresh Application"}
                </button>
                <p className="text-sm mt-4">
                  Reload the application to apply any pending updates or fix issues.
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>
      <RightColumn>
        {() => (
          <>
            <Widget title="Popular" className="h-96">
              <AlgorithmicFeed
                type="popular"
                displayOptions={{
                  small: true,
                  showDisplaySelector: false,
                }}
              />
            </Widget>
          </>
        )}
      </RightColumn>
    </div>
  )
}
