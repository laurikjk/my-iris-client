import {useState, useEffect} from "react"

export default function SystemSettings() {
  const [memoryUsage, setMemoryUsage] = useState<{
    used: number
    total: number
  } | null>(null)
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
    const updateMemoryUsage = () => {
      if (
        typeof performance !== "undefined" &&
        "memory" in performance &&
        performance.memory
      ) {
        setMemoryUsage({
          used: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024),
          total: Math.round(performance.memory.jsHeapSizeLimit / 1024 / 1024),
        })
      }
    }

    updateMemoryUsage()
    const interval = setInterval(updateMemoryUsage, 2000)
    return () => clearInterval(interval)
  }, [])

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

  return (
    <div className="space-y-6">
      <h2 className="text-2xl mb-4">System</h2>

      <div className="card bg-base-200 shadow-xl">
        <div className="card-body">
          <h3 className="card-title">Debug Information</h3>
          <div className="grid grid-cols-2 gap-2">
            <div>App Version:</div>
            <div>{appVersion}</div>
            <div>Build Time:</div>
            <div>{formatBuildTime(buildTime)}</div>
            {memoryUsage && (
              <>
                <div>Memory Usage:</div>
                <div>
                  {memoryUsage.used}MB / {memoryUsage.total}MB
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="card bg-base-200 shadow-xl">
        <div className="card-body">
          <h3 className="card-title">Maintenance</h3>
          <div>
            <button
              className={`btn btn-primary w-full ${updateAvailable ? "animate-pulse" : ""}`}
              onClick={refreshApp}
            >
              {updateAvailable
                ? "Update Available - Click to Refresh"
                : "Refresh Application"}
            </button>
            <p className="text-sm text-base-content/70 mt-1">
              Reload the application to apply any pending updates or fix weirdness.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
