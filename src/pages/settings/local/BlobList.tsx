import {SettingsGroup} from "@/shared/components/settings/SettingsGroup"
import {SettingsGroupItem} from "@/shared/components/settings/SettingsGroupItem"
import {SettingsButton} from "@/shared/components/settings/SettingsButton"
import {useState, useEffect} from "react"
import {getBlobStorage} from "@/utils/chat/webrtc/blobManager"
import {db} from "@/lib/ndk-cache/db"
import {confirm} from "@/utils/utils"
import BlobImage from "./BlobImage"
import {nip19} from "nostr-tools"
import {UserRow} from "@/shared/components/user/UserRow"

export function BlobList() {
  const [blobs, setBlobs] = useState<
    {
      hash: string
      size: number
      mimeType?: string
      stored_at: number
      first_author?: string
      times_requested_locally: number
      times_requested_by_peers: number
      last_requested: number
    }[]
  >([])
  const [blobCount, setBlobCount] = useState(0)
  const [blobTotalSize, setBlobTotalSize] = useState(0)
  const [blobOffset, setBlobOffset] = useState(0)
  const [loadingBlobs, setLoadingBlobs] = useState(false)
  const [expandedBlobs, setExpandedBlobs] = useState<Set<string>>(new Set())
  const [isClearingBlobs, setIsClearingBlobs] = useState(false)
  const [blobUsages, setBlobUsages] = useState<Map<string, string[]>>(new Map())

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes"
    const k = 1024
    const sizes = ["Bytes", "KB", "MB", "GB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i]
  }

  const loadBlobs = async (reset = false) => {
    try {
      setLoadingBlobs(true)
      const storage = getBlobStorage()
      await storage.initialize()

      const newOffset = reset ? 0 : blobOffset
      const newBlobs = await storage.list(newOffset, 20)

      // Sort: 1) total requests DESC, 2) stored_at DESC
      newBlobs.sort((a, b) => {
        const aRequests = a.times_requested_locally + a.times_requested_by_peers
        const bRequests = b.times_requested_locally + b.times_requested_by_peers
        if (aRequests !== bRequests) return bRequests - aRequests
        return b.stored_at - a.stored_at
      })

      if (reset) {
        setBlobs(newBlobs)
        setBlobOffset(newBlobs.length)
      } else {
        setBlobs([...blobs, ...newBlobs])
        setBlobOffset(blobOffset + newBlobs.length)
      }

      const count = await storage.count()
      setBlobCount(count)

      // Calculate total size
      if (reset) {
        const totalSize = newBlobs.reduce((sum, blob) => sum + blob.size, 0)
        setBlobTotalSize(totalSize)
      } else {
        const addedSize = newBlobs.reduce((sum, blob) => sum + blob.size, 0)
        setBlobTotalSize(blobTotalSize + addedSize)
      }
    } catch (error) {
      console.error("Error loading blobs:", error)
    } finally {
      setLoadingBlobs(false)
    }
  }

  const findBlobUsages = async (hash: string) => {
    try {
      // Search serialized event string directly, get IDs
      const events = await db.events
        .filter((e) => e.event.includes(hash))
        .limit(20)
        .toArray()

      const eventIds = events.map((e) => e.id)
      setBlobUsages(new Map(blobUsages.set(hash, eventIds)))
      return eventIds
    } catch (error) {
      console.error("Error finding blob usages:", error)
      return []
    }
  }

  const handleClearBlobs = async () => {
    const confirmed = await confirm(
      "This will delete all locally stored blobs. They can be re-downloaded via p2p or HTTP as needed.",
      "Clear local blobs?"
    )

    if (!confirmed) return

    setIsClearingBlobs(true)

    try {
      const storage = getBlobStorage()
      await storage.clear()
      console.log("Cleared blob storage")

      // Reload blobs
      await loadBlobs(true)
    } catch (err) {
      console.error("Error clearing blobs:", err)
    } finally {
      setIsClearingBlobs(false)
    }
  }

  useEffect(() => {
    loadBlobs(true)
  }, [])

  return (
    <SettingsGroup title="Local Blobs (P2P Storage)">
      <SettingsGroupItem>
        <div className="flex justify-between items-center">
          <span>Total blobs</span>
          <span className="text-base-content/70">{blobCount.toLocaleString()}</span>
        </div>
      </SettingsGroupItem>

      <SettingsGroupItem>
        <div className="flex justify-between items-center">
          <span>Storage used</span>
          <span className="text-base-content/70">{formatBytes(blobTotalSize)}</span>
        </div>
      </SettingsGroupItem>

      {blobs.length > 0 && (
        <SettingsGroupItem>
          <div className="flex flex-col gap-2 max-h-96 overflow-y-auto">
            {blobs.map((blob) => {
              const isExpanded = expandedBlobs.has(blob.hash)
              const isImage = blob.mimeType?.startsWith("image/")

              return (
                <div
                  key={blob.hash}
                  className="flex flex-col gap-2 p-2 bg-base-200 rounded"
                >
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex-1 min-w-0">
                      {blob.first_author && (
                        <div className="mb-1 text-xs">
                          <UserRow pubKey={blob.first_author} avatarWidth={24} />
                        </div>
                      )}
                      <div className="font-mono text-xs break-all">{blob.hash}</div>
                      <div className="text-xs text-base-content/50">
                        {blob.mimeType || "unknown"} · {formatBytes(blob.size)}
                      </div>
                      <div className="text-xs text-base-content/50">
                        Stored: {new Date(blob.stored_at).toLocaleString()}
                      </div>
                      <div className="text-xs text-base-content/50">
                        Last requested: {new Date(blob.last_requested).toLocaleString()}
                      </div>
                      <div className="text-xs text-base-content/50">
                        Requests: {blob.times_requested_locally} local,{" "}
                        {blob.times_requested_by_peers} peers
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => findBlobUsages(blob.hash)}
                        className="btn btn-xs"
                      >
                        {blobUsages.has(blob.hash)
                          ? `${blobUsages.get(blob.hash)?.length || 0} uses`
                          : "Find uses"}
                      </button>
                      {isImage && (
                        <button
                          onClick={() => {
                            const newExpanded = new Set(expandedBlobs)
                            if (isExpanded) {
                              newExpanded.delete(blob.hash)
                            } else {
                              newExpanded.add(blob.hash)
                            }
                            setExpandedBlobs(newExpanded)
                          }}
                          className="btn btn-xs"
                        >
                          {isExpanded ? "Hide" : "Show"}
                        </button>
                      )}
                    </div>
                  </div>

                  {isExpanded && isImage && (
                    <BlobImage hash={blob.hash} mimeType={blob.mimeType} />
                  )}

                  {blobUsages.has(blob.hash) && blobUsages.get(blob.hash)!.length > 0 && (
                    <div className="text-xs text-base-content/70">
                      Used in {blobUsages.get(blob.hash)!.length} events:{" "}
                      {blobUsages
                        .get(blob.hash)!
                        .slice(0, 3)
                        .map((id, i) => {
                          const note1 = nip19.noteEncode(id)
                          return (
                            <span key={id}>
                              {i > 0 && ", "}
                              <a href={`/${note1}`} className="link">
                                {note1.slice(0, 12)}
                              </a>
                            </span>
                          )
                        })}
                      {blobUsages.get(blob.hash)!.length > 3 && "..."}
                    </div>
                  )}
                </div>
              )
            })}

            {blobOffset < blobCount && (
              <button
                onClick={() => loadBlobs(false)}
                disabled={loadingBlobs}
                className="btn btn-sm btn-primary"
              >
                {loadingBlobs
                  ? "Loading..."
                  : `Load more (${blobCount - blobOffset} remaining)`}
              </button>
            )}
          </div>
        </SettingsGroupItem>
      )}

      {blobCount > 0 && (
        <SettingsButton
          label={isClearingBlobs ? "Clearing..." : "Clear all blobs"}
          onClick={handleClearBlobs}
          variant="destructive"
          isLast
          disabled={isClearingBlobs || loadingBlobs}
        />
      )}
    </SettingsGroup>
  )
}
