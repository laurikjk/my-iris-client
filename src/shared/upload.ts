import {
  calculateImageMetadata,
  calculateVideoMetadata,
} from "@/shared/components/embed/media/mediaUtils"
import type {EncryptionMeta} from "@/types/global"
import {bytesToHex} from "@noble/hashes/utils"
import {NDKEvent} from "@nostr-dev-kit/ndk"
import {useUserStore} from "@/stores/user"
import {ndk} from "@/utils/ndk"

type MediaServerProtocol = "blossom" | "nip96"

interface MediaServer {
  url: string
  protocol: MediaServerProtocol
  isDefault?: boolean
}

async function calculateSHA256(file: File): Promise<string> {
  const buffer = await file.arrayBuffer()
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("")
}

async function encryptFileWithAesGcm(
  file: File
): Promise<{encryptedFile: File; key: string; iv: string}> {
  const key = crypto.getRandomValues(new Uint8Array(32)) // 256-bit key
  const iv = crypto.getRandomValues(new Uint8Array(12)) // 96-bit IV
  const algo = {name: "AES-GCM", iv}
  const cryptoKey = await crypto.subtle.importKey("raw", key, algo, false, ["encrypt"])
  const data = await file.arrayBuffer()
  const encrypted = await crypto.subtle.encrypt(algo, cryptoKey, data)
  // Compose: [IV (12 bytes)] + [encrypted data]
  const encryptedBytes = new Uint8Array(iv.length + encrypted.byteLength)
  encryptedBytes.set(iv, 0)
  encryptedBytes.set(new Uint8Array(encrypted), iv.length)
  return {
    encryptedFile: new File([encryptedBytes], file.name, {
      type: "application/octet-stream",
    }),
    key: bytesToHex(key),
    iv: bytesToHex(iv),
  }
}

async function uploadToBlossom(
  file: File,
  server: MediaServer,
  onProgress?: (progress: number) => void
): Promise<string> {
  const sha256 = await calculateSHA256(file)
  const url = `${server.url}/upload`

  // Create a Nostr event for authentication
  const currentTime = Math.floor(Date.now() / 1000)
  const event = new NDKEvent(ndk(), {
    kind: 24242, // Blossom authorization event
    tags: [
      ["t", "upload"],
      ["x", sha256], // Required: SHA256 hash of the file
      ["expiration", (currentTime + 300).toString()], // Expires in 5 minutes
    ],
    content: file.name,
    created_at: currentTime,
  })
  await event.sign()
  const nostrEvent = await event.toNostrEvent()

  // Encode the event for the Authorization header
  const encodedEvent = btoa(JSON.stringify(nostrEvent))

  const headers = {
    accept: "application/json",
    authorization: `Nostr ${encodedEvent}`,
    "content-type": file.type,
    "content-length": file.size.toString(),
  }

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open("PUT", url)
    Object.entries(headers).forEach(([key, value]) => {
      xhr.setRequestHeader(key, value)
    })

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        const percentComplete = (event.loaded / event.total) * 100
        onProgress(percentComplete)
      }
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = JSON.parse(xhr.responseText)
          if (data.url) {
            resolve(data.url.replace("blossom.iris.to", "files.iris.to"))
          } else {
            reject(new Error(`URL not found in response from ${url}`))
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error)
          reject(new Error(`Failed to parse response from ${url}: ${errorMessage}`))
        }
      } else {
        reject(new Error(`Upload failed with status ${xhr.status}: ${xhr.responseText}`))
      }
    }

    xhr.onerror = () => reject(new Error(`Upload to ${url} failed`))
    xhr.send(file)
  })
}

async function uploadToNip96(
  file: File,
  server: MediaServer,
  onProgress?: (progress: number) => void
): Promise<string> {
  const url = server.url

  // Use FormData with 'fileToUpload' and 'submit'
  const fd = new FormData()
  fd.append("fileToUpload", file)
  fd.append("submit", "Upload Image")

  // Create a NIP-98 event for authentication
  const currentTime = Math.floor(Date.now() / 1000)
  const event = new NDKEvent(ndk(), {
    kind: 27235, // NIP-98 HTTP authentication
    tags: [
      ["u", url],
      ["method", "POST"],
    ],
    content: "",
    created_at: currentTime,
  })
  await event.sign()
  const nostrEvent = await event.toNostrEvent()
  const encodedEvent = btoa(JSON.stringify(nostrEvent))
  const headers = {
    accept: "application/json",
    authorization: `Nostr ${encodedEvent}`,
  }

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open("POST", url)
    Object.entries(headers).forEach(([key, value]) => {
      xhr.setRequestHeader(key, value)
    })

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        const percentComplete = (event.loaded / event.total) * 100
        onProgress(percentComplete)
      }
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = JSON.parse(xhr.responseText)
          // Try to find the URL in the response (may need to adjust if server format changes)
          let urlResult = null
          if (data.nip94_event && Array.isArray(data.nip94_event.tags)) {
            const urlTag = data.nip94_event.tags.find((tag: string[]) => tag[0] === "url")
            if (urlTag && urlTag[1]) {
              urlResult = urlTag[1]
            }
          }
          if (!urlResult && data.url) {
            urlResult = data.url
          }
          if (urlResult) {
            resolve(urlResult)
          } else {
            reject(new Error(`URL not found in response: ${xhr.responseText}`))
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error)
          reject(
            new Error(
              `Failed to parse response from ${url}: ${errorMessage} - Raw: ${xhr.responseText}`
            )
          )
        }
      } else {
        // Improved error logging for 401 and other errors
        let errorMsg = `Upload failed with status ${xhr.status} from ${url}`
        if (xhr.status === 401) {
          errorMsg +=
            " (Unauthorized). Check your authentication headers and Nostr event."
        }
        errorMsg += `\nResponse: ${xhr.responseText}`
        reject(new Error(errorMsg))
      }
    }

    xhr.onerror = () => reject(new Error(`Upload to ${url} failed`))
    xhr.send(fd)
  })
}

export async function uploadFile(
  file: File,
  onProgress?: (progress: number) => void,
  isSubscriber: boolean = false,
  encrypt: boolean = false
): Promise<{url: string; encryptionMeta?: EncryptionMeta}> {
  const realFilename = file.name
  const originalSize = file.size
  let encryptionMeta: EncryptionMeta | undefined = undefined
  if (encrypt) {
    const {encryptedFile, key} = await encryptFileWithAesGcm(file)
    // Hash the encrypted file for filename
    const hash = await calculateSHA256(encryptedFile)
    // Set filename to [hash].bin
    file = new File([encryptedFile], `${hash}.bin`, {type: "application/octet-stream"})
    encryptionMeta = {
      decryptionKey: key,
      fileName: realFilename,
      fileSize: originalSize,
      algorithm: "AES-GCM",
    }
  }
  const userStore = useUserStore.getState()
  let server = userStore.defaultMediaserver
  if (!server) {
    userStore.ensureDefaultMediaserver(isSubscriber)
    server = useUserStore.getState().defaultMediaserver
  }
  if (!server) throw new Error("No default media server configured")
  let url
  if (server.protocol === "blossom") {
    url = await uploadToBlossom(file, server, onProgress)
  } else if (server.protocol === "nip96") {
    url = await uploadToNip96(file, server, onProgress)
  } else {
    throw new Error(`Unsupported media server protocol: ${server.protocol}`)
  }
  return {url, encryptionMeta}
}

// --- Shared file processing logic ---

export const hasExifData = async (file: File): Promise<boolean> => {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const view = new DataView(e.target?.result as ArrayBuffer)
      // Check for JPEG signature
      if (view.getUint16(0, false) === 0xffd8) {
        const length = view.byteLength
        let offset = 2
        while (offset < length) {
          if (view.getUint16(offset, false) === 0xffe1) {
            resolve(true)
            return
          }
          offset += 2 + view.getUint16(offset + 2, false)
        }
      }
      resolve(false)
    }
    reader.readAsArrayBuffer(file)
  })
}

export const stripExifData = async (file: File): Promise<File> => {
  if (file.type !== "image/jpeg") return file
  const hasExif = await hasExifData(file)
  if (!hasExif) return file
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement("canvas")
      canvas.width = img.width
      canvas.height = img.height
      const ctx = canvas.getContext("2d")
      if (!ctx) return resolve(file)
      ctx.drawImage(img, 0, 0)
      canvas.toBlob((blob) => {
        if (blob) {
          const newFile = new File([blob], file.name, {
            type: file.type,
            lastModified: file.lastModified,
          })
          resolve(newFile)
        } else {
          resolve(file)
        }
      }, file.type)
    }
    img.onerror = () => resolve(file)
    img.src = URL.createObjectURL(file)
  })
}

export async function processFile(
  file: File,
  onProgress?: (progress: number) => void,
  encrypt: boolean = false
): Promise<{
  url: string
  metadata?: {width: number; height: number; blurhash: string}
  encryptionMeta?: EncryptionMeta
}> {
  // Strip EXIF data if it's a JPEG
  if (file.type === "image/jpeg") {
    file = await stripExifData(file)
  }
  // Calculate metadata based on file type
  let metadata
  if (file.type.startsWith("image/")) {
    metadata = await calculateImageMetadata(file)
  } else if (file.type.startsWith("video/")) {
    metadata = await calculateVideoMetadata(file)
  }
  const {url, encryptionMeta} = await uploadFile(file, onProgress, false, encrypt)
  return {url, metadata: metadata || undefined, encryptionMeta}
}
