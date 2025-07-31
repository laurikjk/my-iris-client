import {FormEvent, useEffect, useMemo, useState} from "react"
import {RiDeleteBinLine, RiArrowUpSLine, RiArrowDownSLine} from "@remixicon/react"
import {Link} from "react-router"

import {DEFAULT_RELAYS, ndk as getNdk} from "@/utils/ndk"
import {useUserStore} from "@/stores/user"

type SortField = "url" | "status"
type SortDirection = "asc" | "desc"

export function Network() {
  const ndk = getNdk()
  const [ndkRelays, setNdkRelays] = useState(new Map(ndk.pool.relays))
  const [connectToRelayUrls, setConnectToRelayUrls] = useState<string[]>([])
  const [sortField, setSortField] = useState<SortField>("status")
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc")
  const {relays, setRelays} = useUserStore()

  useEffect(() => {
    if (relays && relays.length > 0) {
      setConnectToRelayUrls(relays)
    } else {
      setConnectToRelayUrls(Array.from(ndk.pool.relays.keys()))
    }
  }, [relays])
  const [newRelayUrl, setNewRelayUrl] = useState("")

  useEffect(() => {
    const updateRelays = () => {
      setNdkRelays(new Map(ndk.pool.relays))
    }
    updateRelays()
    const interval = setInterval(updateRelays, 1000)
    return () => clearInterval(interval)
  }, [])

  const addRelay = (e: FormEvent) => {
    e.preventDefault()
    let url = newRelayUrl.trim()
    if (!url) return
    if (!url.startsWith("wss://") && !url.startsWith("ws://")) {
      url = `wss://${url}`
    }
    const newRelays = [...(connectToRelayUrls || []), url]
    setConnectToRelayUrls(newRelays)
    setRelays(newRelays)
    setNewRelayUrl("")
  }

  const removeRelay = (url: string) => {
    const newRelays = (connectToRelayUrls || Array.from(ndkRelays.keys())).filter(
      (u) => u !== url
    )
    setConnectToRelayUrls(newRelays)
    setRelays(newRelays)
  }

  const resetDefaults = () => {
    setConnectToRelayUrls(DEFAULT_RELAYS)
    setRelays(DEFAULT_RELAYS)
  }

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc")
    } else {
      setSortField(field)
      setSortDirection(field === "status" ? "desc" : "asc")
    }
  }

  const sortedRelayUrls = useMemo(() => {
    if (!connectToRelayUrls) return []

    return [...connectToRelayUrls].sort((a, b) => {
      const relayA = ndkRelays.get(a)
      const relayB = ndkRelays.get(b)

      if (sortField === "status") {
        const connectedA = relayA?.connected ? 1 : 0
        const connectedB = relayB?.connected ? 1 : 0
        const statusDiff = connectedB - connectedA

        if (statusDiff !== 0) {
          return sortDirection === "desc" ? statusDiff : -statusDiff
        }
        // Secondary sort by URL
        return a.localeCompare(b)
      } else {
        // Sort by URL
        const urlDiff = a.localeCompare(b)
        return sortDirection === "desc" ? -urlDiff : urlDiff
      }
    })
  }, [connectToRelayUrls, ndkRelays, sortField, sortDirection])

  const hasDefaultRelays = useMemo(
    () =>
      connectToRelayUrls?.every((url) => DEFAULT_RELAYS.includes(url)) &&
      connectToRelayUrls?.length === DEFAULT_RELAYS.length,
    [connectToRelayUrls]
  )

  return (
    <div>
      <h2 className="text-2xl mb-4">Network</h2>

      {/* Column Headers */}
      <div className="flex justify-between items-center py-2 border-b border-base-300 mb-2">
        <button
          onClick={() => handleSort("url")}
          className="flex items-center gap-1 text-sm font-medium text-base-content/70 hover:text-base-content cursor-pointer"
        >
          URL
          {sortField === "url" &&
            (sortDirection === "asc" ? (
              <RiArrowUpSLine className="w-4 h-4" />
            ) : (
              <RiArrowDownSLine className="w-4 h-4" />
            ))}
        </button>
        <button
          onClick={() => handleSort("status")}
          className="flex items-center gap-1 text-sm font-medium text-base-content/70 hover:text-base-content cursor-pointer"
        >
          Status
          {sortField === "status" &&
            (sortDirection === "asc" ? (
              <RiArrowUpSLine className="w-4 h-4" />
            ) : (
              <RiArrowDownSLine className="w-4 h-4" />
            ))}
        </button>
      </div>

      <div className="divide-y divide-base-300">
        {sortedRelayUrls.map((url) => {
          const relay = ndkRelays.get(url)
          return (
            <div key={url} className="py-2 flex justify-between items-center">
              <Link
                to={`/relay/${url.replace("wss://", "").replace("ws://", "").replace(/\/$/, "")}`}
                className="text-lg font-medium text-primary hover:underline"
              >
                {url.replace("wss://", "").replace(/\/$/, "")}
              </Link>
              <div className="flex items-center gap-4">
                <RiDeleteBinLine
                  className="cursor-pointer"
                  onClick={() => removeRelay(url)}
                />
                <span
                  className={`badge ${relay?.connected ? "badge-success" : "badge-error"}`}
                ></span>
              </div>
            </div>
          )
        })}
      </div>
      <div className="mt-4">
        <form onSubmit={addRelay}>
          <input
            type="text"
            placeholder="Add relay"
            className="input input-bordered w-full max-w-xs"
            value={newRelayUrl}
            onChange={(e) => setNewRelayUrl(e.target.value)}
          />
          <button className="btn btn-primary ml-2">Add Relay</button>
        </form>
      </div>
      {!hasDefaultRelays && (
        <div className="mt-4">
          <button className="btn btn-secondary" onClick={resetDefaults}>
            Reset to defaults
          </button>
        </div>
      )}
    </div>
  )
}
