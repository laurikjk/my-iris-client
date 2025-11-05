import {useState, useEffect} from "react"
import {getAllConnections} from "@/utils/chat/webrtc/PeerConnection"
import {getBlobStorage} from "@/utils/chat/webrtc/blobManager"
import socialGraph from "@/utils/socialGraph"

const BLOSSOM_HASH_REGEX = /\/([a-f0-9]{64})\.(jpe?g|png|gif|webp|mp4|webm)/i

const EXT_TO_MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  mp4: "video/mp4",
  webm: "video/webm",
}

/**
 * Extract blossom hash and MIME type from URL
 */
function extractBlossomHash(url: string): {hash: string; mimeType?: string} | null {
  const match = url.match(BLOSSOM_HASH_REGEX)
  if (!match) return null

  const ext = match[2].toLowerCase()
  return {
    hash: match[1],
    mimeType: EXT_TO_MIME[ext],
  }
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
async function fetchBlobP2P(hash: string, mimeType?: string): Promise<Blob | null> {
  try {
    // Check local cache first
    const storage = getBlobStorage()
    const cached = await storage.get(hash)
    if (cached) {
      console.log(`Blob ${hash.slice(0, 8)} found in local cache`)
      return new Blob([cached.data], {type: cached.mimeType})
    }

    // Try peers
    const connections = getAllConnections()
    console.log(
      `Fetching blob ${hash.slice(0, 8)} from peers... (${connections.size} connections)`
    )

    const data = await fetchFromPeers(hash)
    if (data) {
      console.log(`Blob ${hash.slice(0, 8)} received from peer`)
      // Store in cache with MIME type
      await storage.save(hash, data, mimeType)
      return new Blob([data], {type: mimeType})
    }

    console.log(`Blob ${hash.slice(0, 8)} not found via p2p, falling back to HTTP`)
    return null
  } catch (error) {
    console.error(`Error fetching blob ${hash.slice(0, 8)} via p2p:`, error)
    return null
  }
}

/**
 * Fetch blob from HTTP, verify hash, and save locally if valid
 */
async function fetchAndVerifyHTTP(
  url: string,
  expectedHash: string,
  mimeType?: string
): Promise<Blob | null> {
  try {
    console.log(`Fetching ${expectedHash.slice(0, 8)} via HTTP...`)
    const response = await fetch(url)
    if (!response.ok) {
      console.warn(`HTTP fetch failed: ${response.status}`)
      return null
    }

    const arrayBuffer = await response.arrayBuffer()

    // Verify hash
    const {sha256} = await import("@noble/hashes/sha256")
    const {bytesToHex} = await import("@noble/hashes/utils")
    const actualHash = bytesToHex(sha256(new Uint8Array(arrayBuffer)))

    if (actualHash !== expectedHash) {
      console.error(
        `Hash mismatch! Expected ${expectedHash.slice(0, 8)}, got ${actualHash.slice(0, 8)}`
      )
      return null
    }

    console.log(`HTTP fetch verified, saving ${expectedHash.slice(0, 8)} locally`)

    // Save to local storage for future p2p sharing
    const storage = getBlobStorage()
    await storage.save(
      expectedHash,
      arrayBuffer,
      mimeType || response.headers.get("content-type") || undefined
    )

    return new Blob([arrayBuffer], {
      type: mimeType || response.headers.get("content-type") || undefined,
    })
  } catch (error) {
    console.error(`Error fetching blob via HTTP:`, error)
    return null
  }
}

/**
 * Hook to fetch blossom files from p2p network before falling back to HTTP
 * @param url - The blossom URL
 * @param authorPubkey - Optional pubkey of the post author (for WoT check on HTTP fallback)
 */
export function useBlossomCache(url: string, authorPubkey?: string): string {
  const [resolvedUrl, setResolvedUrl] = useState(url)
  const [attempted, setAttempted] = useState(false)

  useEffect(() => {
    const extracted = extractBlossomHash(url)
    console.log(
      `useBlossomCache: url=${url.slice(0, 60)}, hash=${extracted?.hash.slice(0, 8) || "none"}`
    )

    if (!extracted || attempted) {
      setResolvedUrl(url)
      return
    }

    setAttempted(true)
    console.log(`useBlossomCache: attempting p2p fetch for ${extracted.hash.slice(0, 8)}`)

    // Try p2p fetch
    fetchBlobP2P(extracted.hash, extracted.mimeType).then(async (blob) => {
      if (blob) {
        // Create object URL for the blob
        const objectUrl = URL.createObjectURL(blob)
        console.log(
          `useBlossomCache: p2p success, using blob: URL for ${extracted.hash.slice(0, 8)}`
        )
        setResolvedUrl(objectUrl)

        // Cleanup on unmount
        return () => URL.revokeObjectURL(objectUrl)
      }

      // P2P failed - check if we should use HTTP fallback with verification
      const isTrusted = authorPubkey
        ? socialGraph().getFollowDistance(authorPubkey) <= 1 ||
          socialGraph().getRoot() === authorPubkey
        : false

      if (!isTrusted) {
        console.log(
          `useBlossomCache: untrusted author, using proxied HTTP for ${extracted.hash.slice(0, 8)}`
        )
        setResolvedUrl(url)
        return
      }

      // Fetch via HTTP with verification
      console.log(
        `useBlossomCache: trusted author, verifying HTTP for ${extracted.hash.slice(0, 8)}`
      )
      const verifiedBlob = await fetchAndVerifyHTTP(
        url,
        extracted.hash,
        extracted.mimeType
      )

      if (verifiedBlob) {
        const objectUrl = URL.createObjectURL(verifiedBlob)
        console.log(
          `useBlossomCache: HTTP verified, using blob: URL for ${extracted.hash.slice(0, 8)}`
        )
        setResolvedUrl(objectUrl)
        return () => URL.revokeObjectURL(objectUrl)
      } else {
        // Verification failed, use original URL (ProxyImg will handle via proxy)
        console.log(
          `useBlossomCache: HTTP verification failed for ${extracted.hash.slice(0, 8)}`
        )
        setResolvedUrl(url)
      }
    })
  }, [url, authorPubkey, attempted])

  return resolvedUrl
}
