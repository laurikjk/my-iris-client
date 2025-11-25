import {SimpleBlobStorage} from "./simpleBlobStorage"
import {ndk} from "@/utils/ndk"
import {createDebugLogger} from "@/utils/createDebugLogger"
import {DEBUG_NAMESPACES} from "@/utils/constants"

const {error} = createDebugLogger(DEBUG_NAMESPACES.WEBRTC_PEER)

let blobStorageInstance: SimpleBlobStorage | null = null

export function getBlobStorage(): SimpleBlobStorage {
  if (!blobStorageInstance) {
    const cache = ndk().cacheAdapter
    if (!cache) {
      throw new Error("NDK cache adapter not initialized")
    }
    blobStorageInstance = new SimpleBlobStorage()
    // Initialize async
    blobStorageInstance.initialize().catch((err) => {
      error("Failed to initialize blob storage:", err)
    })
  }
  return blobStorageInstance
}

export function resetBlobStorage() {
  blobStorageInstance = null
}
