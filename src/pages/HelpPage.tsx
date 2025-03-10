import RightColumn from "@/shared/components/RightColumn"
import Trending from "@/shared/components/feed/Trending"
import Header from "@/shared/components/header/Header"
import Widget from "@/shared/components/ui/Widget"
import {useState, useEffect} from "react"

export const AboutPage = () => {
  const [updateAvailable, setUpdateAvailable] = useState(false)
  const appVersion = import.meta.env.VITE_APP_VERSION || "dev"
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
          <div className="flex flex-1 mx-4 my-4 lg:mx-8">
            <div className="prose max-w-prose">
              <h1>About</h1>
              <p>{CONFIG.aboutText}</p>
              <p>
                <a href={CONFIG.repository}>Source code</a>
              </p>
              <div className="mt-4">
                <p>Version: {appVersion}</p>
                <p>Build Time: {formatBuildTime(buildTime)}</p>
              </div>

              <div className="mt-6">
                <button
                  className={`btn btn-primary ${updateAvailable ? "animate-pulse" : ""}`}
                  onClick={refreshApp}
                >
                  {updateAvailable
                    ? "Update Available - Click to Refresh"
                    : "Refresh Application"}
                </button>
                <p className="text-sm mt-1">
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
            <Widget title="Trending posts">
              <Trending />
            </Widget>
          </>
        )}
      </RightColumn>
    </div>
  )
}
