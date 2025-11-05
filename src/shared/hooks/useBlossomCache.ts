import {useState, useEffect} from "react"
import {getAllConnections} from "@/utils/chat/webrtc/PeerConnection"
import {getBlobStorage} from "@/utils/chat/webrtc/blobManager"

const BLOSSOM_HASH_REGEX = /\/([a-f0-9]{64})\.(jpe?g|png|gif|webp|mp4|webm)/i

/**
 * Extract blossom hash from URL if it matches the pattern
 */
function extractBlossomHash(url: string): string | null {
  const match = url.match(BLOSSOM_HASH_REGEX)
  return match ? match[1] : null
}

/**
 * Try to fetch blob from WebRTC peers
 */
async function fetchFromPeers(hash: string): Promise<ArrayBuffer | null> {
  const connections = getAllConnections()

  // Try each peer in parallel
  const promises = Array.from(connections.values()).map(async (peer) => {
    console.log(
      `Checking peer ${peer.peerId}: blobChannel=${!!peer.blobChannel}, state=${peer.blobChannel?.readyState}`
    )

    if (!peer.blobChannel || peer.blobChannel.readyState !== "open") {
      console.log(`Peer ${peer.peerId} blob channel not ready`)
      return null
    }

    try {
      console.log(`Requesting blob ${hash.slice(0, 8)} from peer ${peer.peerId}`)
      const result = await peer.requestBlob(hash)
      console.log(
        `Result from peer ${peer.peerId}:`,
        result ? `${result.byteLength} bytes` : "null"
      )
      return result
    } catch (error) {
      console.error(
        `Failed to fetch blob ${hash.slice(0, 8)} from peer ${peer.peerId}:`,
        error
      )
      return null
    }
  })

  const results = await Promise.all(promises)
  return results.find((r) => r !== null) || null
}

/**
 * Try to fetch blob from local cache first, then WebRTC peers
 */
async function fetchBlobP2P(hash: string): Promise<Blob | null> {
  try {
    // Check local cache first
    const storage = getBlobStorage()
    const cached = await storage.get(hash)
    if (cached) {
      console.log(`Blob ${hash.slice(0, 8)} found in local cache`)
      return new Blob([cached.data])
    }

    // Try peers
    const connections = getAllConnections()
    console.log(
      `Fetching blob ${hash.slice(0, 8)} from peers... (${connections.size} connections)`
    )

    const data = await fetchFromPeers(hash)
    if (data) {
      console.log(`Blob ${hash.slice(0, 8)} received from peer`)
      // Store in cache
      await storage.save(hash, data)
      return new Blob([data])
    }

    console.log(`Blob ${hash.slice(0, 8)} not found via p2p`)
    return null
  } catch (error) {
    console.error(`Error fetching blob ${hash.slice(0, 8)} via p2p:`, error)
    return null
  }
}

/**
 * Hook to fetch blossom files from p2p network before falling back to HTTP
 */
export function useBlossomCache(url: string): string {
  const [resolvedUrl, setResolvedUrl] = useState(url)
  const [attempted, setAttempted] = useState(false)

  useEffect(() => {
    const hash = extractBlossomHash(url)
    console.log(
      `useBlossomCache: url=${url.slice(0, 60)}, hash=${hash?.slice(0, 8) || "none"}`
    )

    if (!hash || attempted) {
      setResolvedUrl(url)
      return
    }

    setAttempted(true)
    console.log(`useBlossomCache: attempting p2p fetch for ${hash.slice(0, 8)}`)

    // Try p2p fetch
    fetchBlobP2P(hash).then((blob) => {
      if (blob) {
        // Create object URL for the blob
        const objectUrl = URL.createObjectURL(blob)
        console.log(
          `useBlossomCache: p2p success, using blob: URL for ${hash.slice(0, 8)}`
        )
        setResolvedUrl(objectUrl)

        // Cleanup on unmount
        return () => URL.revokeObjectURL(objectUrl)
      } else {
        // Fall back to original HTTP URL
        console.log(`useBlossomCache: p2p failed, using HTTP for ${hash.slice(0, 8)}`)
        setResolvedUrl(url)
      }
    })
  }, [url, attempted])

  return resolvedUrl
}
