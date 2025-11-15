import {useState, useEffect} from "react"
import {getWorkerTransport, getTauriTransport} from "@/utils/ndk"
import {isTauri} from "@/utils/utils"

interface RelayStatus {
  url: string
  status: number
  stats?: {
    attempts: number
    success: number
    connectedAt?: number
  }
}

/**
 * Hook to get relay status from worker thread
 * Polls worker every 2 seconds for relay connectivity info
 */
export function useWorkerRelayStatus() {
  const [relays, setRelays] = useState<RelayStatus[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const transport = isTauri() ? getTauriTransport() : getWorkerTransport()
    if (!transport) {
      setLoading(false)
      return
    }

    const fetchStatus = async () => {
      try {
        const statuses = await transport.getRelayStatus()
        setRelays(statuses)
        setLoading(false)
      } catch (error) {
        console.error("Failed to fetch relay status:", error)
        setLoading(false)
      }
    }

    // Initial fetch
    fetchStatus()

    // Poll every 2s
    const interval = setInterval(fetchStatus, 2000)
    return () => clearInterval(interval)
  }, [])

  return {relays, loading}
}

/**
 * Hook to manage relays in worker
 */
export function useWorkerRelayManager() {
  const transport = isTauri() ? getTauriTransport() : getWorkerTransport()

  const addRelay = async (url: string) => {
    await transport?.addRelay(url)
  }

  const removeRelay = async (url: string) => {
    await transport?.removeRelay(url)
  }

  const connectRelay = async (url: string) => {
    await transport?.connectRelay(url)
  }

  const disconnectRelay = async (url: string) => {
    await transport?.disconnectRelay(url)
  }

  return {
    addRelay,
    removeRelay,
    connectRelay,
    disconnectRelay,
    available: !!transport,
  }
}
