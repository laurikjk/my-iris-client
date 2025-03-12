import {useState, useEffect} from "react"

let isClient = false

// Shared state that all instances will reference
let onlineStatus = true
const listeners = new Set<(status: boolean) => void>()

if (typeof window !== "undefined") {
  isClient = true
  onlineStatus = navigator.onLine

  window.addEventListener("online", () => {
    onlineStatus = true
    listeners.forEach((listener) => listener(true))
  })

  window.addEventListener("offline", () => {
    onlineStatus = false
    listeners.forEach((listener) => listener(false))
  })
}

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(onlineStatus)

  useEffect(() => {
    if (!isClient) return

    const listener = (status: boolean) => setIsOnline(status)
    listeners.add(listener)

    return () => {
      listeners.delete(listener)
    }
  }, [])

  return isOnline
}
