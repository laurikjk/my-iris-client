import socialGraph from "@/utils/socialGraph"
import {NDKEvent} from "@nostr-dev-kit/ndk"
import {useUserStore} from "@/stores/user"
import {ndk} from "@/utils/ndk"

function getBlossomServerUrl(): Promise<string> {
  return new Promise((resolve) => {
    const defaultBlossomServer = useUserStore.getState().defaultBlossomServer
    resolve(defaultBlossomServer || "https://nostr.build")
  })
}

async function calculateSHA256(file: File): Promise<string> {
  const buffer = await file.arrayBuffer()
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("")
}

export async function uploadFile(
  file: File,
  onProgress?: (progress: number) => void
): Promise<string> {
  // Calculate SHA256 hash of the file
  const sha256 = await calculateSHA256(file)

  // Get the Blossom server URL
  const baseUrl = await getBlossomServerUrl()
  const url = `${baseUrl}/upload`

  // Create a Nostr event for authentication
  const event = new NDKEvent(ndk(), {
    kind: 24242, // Blossom authorization event
    tags: [
      ["t", "upload"],
      ["x", sha256], // Required: SHA256 hash of the file
    ],
    content: file.name,
    created_at: Math.floor(Date.now() / 1000),
    pubkey: [...socialGraph().getUsersByFollowDistance(0)][0],
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
          // Blossom returns a Blob Descriptor with url field
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
    xhr.send(file) // Send the file directly, not as FormData
  })
}
