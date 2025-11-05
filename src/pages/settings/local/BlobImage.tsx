import {useState, useEffect} from "react"
import {getBlobStorage} from "@/utils/chat/webrtc/blobManager"

export default function BlobImage({hash, mimeType}: {hash: string; mimeType?: string}) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null)

  useEffect(() => {
    let url: string | null = null

    getBlobStorage()
      .get(hash)
      .then((blob) => {
        if (blob) {
          url = URL.createObjectURL(new Blob([blob.data], {type: mimeType}))
          setBlobUrl(url)
        }
      })

    return () => {
      if (url) URL.revokeObjectURL(url)
    }
  }, [hash, mimeType])

  if (!blobUrl) return <div className="text-xs">Loading...</div>

  return (
    <img
      src={blobUrl}
      alt={hash.slice(0, 8)}
      className="max-w-full max-h-64 rounded object-contain"
    />
  )
}
