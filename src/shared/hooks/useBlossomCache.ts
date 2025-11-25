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
    if (!peer.blobChannel || peer.blobChannel.readyState !== "open") {
      return null
    }

    try {
      return await peer.requestBlob(hash)
    } catch (error) {
      return null
    }
  })

  const results = await Promise.all(promises)
  return results.find((r) => r !== null) || null
}

/**
 * Try to fetch blob from local cache first, then WebRTC peers
 */
async function fetchBlobP2P(
  hash: string,
  mimeType?: string,
  authorPubkey?: string
): Promise<Blob | null> {
  try {
    // Check local cache first
    const storage = getBlobStorage()
    const cached = await storage.get(hash)
    if (cached) {
      storage.incrementLocalRequests(hash)
      return new Blob([cached.data], {type: cached.mimeType})
    }

    // Try peers
    const data = await fetchFromPeers(hash)
    if (data) {
      await storage.save(hash, data, mimeType, authorPubkey)
      return new Blob([data], {type: mimeType})
    }

    return null
  } catch (error) {
    return null
  }
}

/**
 * Fetch blob from HTTP, verify hash, and save locally if valid
 */
async function fetchAndVerifyHTTP(
  url: string,
  expectedHash: string,
  mimeType?: string,
  authorPubkey?: string
): Promise<Blob | null> {
  try {
    const response = await fetch(url)
    if (!response.ok) {
      return null
    }

    const arrayBuffer = await response.arrayBuffer()

    // Verify hash
    const {sha256} = await import("@noble/hashes/sha256")
    const {bytesToHex} = await import("@noble/hashes/utils")
    const actualHash = bytesToHex(sha256(new Uint8Array(arrayBuffer)))

    if (actualHash !== expectedHash) {
      return null
    }

    // Save to local storage for future p2p sharing
    const storage = getBlobStorage()
    await storage.save(
      expectedHash,
      arrayBuffer,
      mimeType || response.headers.get("content-type") || undefined,
      authorPubkey
    )

    return new Blob([arrayBuffer], {
      type: mimeType || response.headers.get("content-type") || undefined,
    })
  } catch (error) {
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

    if (!extracted || attempted) {
      setResolvedUrl(url)
      return
    }

    // Check trust - only fetch blobs from trusted authors (distance <= 2)
    const followDistance = authorPubkey
      ? socialGraph().getFollowDistance(authorPubkey)
      : 999
    const isTrusted = followDistance <= 2

    if (!isTrusted) {
      setResolvedUrl(url)
      return
    }

    setAttempted(true)

    // Try p2p fetch
    fetchBlobP2P(extracted.hash, extracted.mimeType, authorPubkey).then(async (blob) => {
      if (blob) {
        // Create object URL for the blob
        const objectUrl = URL.createObjectURL(blob)
        setResolvedUrl(objectUrl)

        // Cleanup on unmount
        return () => URL.revokeObjectURL(objectUrl)
      }

      // P2P failed - try HTTP with verification
      const verifiedBlob = await fetchAndVerifyHTTP(
        url,
        extracted.hash,
        extracted.mimeType,
        authorPubkey
      )

      if (verifiedBlob) {
        const objectUrl = URL.createObjectURL(verifiedBlob)
        setResolvedUrl(objectUrl)
        return () => URL.revokeObjectURL(objectUrl)
      } else {
        // Verification failed, use original URL (ProxyImg will handle via proxy)
        setResolvedUrl(url)
      }
    })
  }, [url, authorPubkey, attempted])

  return resolvedUrl
}
