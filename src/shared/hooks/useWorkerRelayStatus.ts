import {useState, useEffect} from "react"
import {getWorkerTransport} from "@/utils/ndk"

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
    const worker = getWorkerTransport()
    if (!worker) {
      setLoading(false)
      return
    }

    const fetchStatus = async () => {
      try {
        const statuses = await worker.getRelayStatus()
        setRelays(statuses)
        setLoading(false)
      } catch (error) {
        console.error("Failed to fetch relay status from worker:", error)
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
  const worker = getWorkerTransport()

  const addRelay = async (url: string) => {
    await worker?.addRelay(url)
  }

  const removeRelay = async (url: string) => {
    await worker?.removeRelay(url)
  }

  const connectRelay = async (url: string) => {
    await worker?.connectRelay(url)
  }

  const disconnectRelay = async (url: string) => {
    await worker?.disconnectRelay(url)
  }

  return {
    addRelay,
    removeRelay,
    connectRelay,
    disconnectRelay,
    available: !!worker,
  }
}
