import {formatSize} from "@/shared/utils/formatSize"
import {RiDownload2Line} from "@remixicon/react"
import {useEffect, useState} from "react"

interface EncryptedUrlEmbedProps {
  url: string
}

function parseHashMeta(url: string) {
  try {
    const hash = url.split("#")[1]
    if (!hash) return null
    const decoded = decodeURIComponent(hash)
    const meta = JSON.parse(decoded)
    if (meta.k && meta.n && meta.s) return meta
  } catch (e) {
    /* ignore */
  }
  return null
}

async function decryptAesGcm(
  encrypted: ArrayBuffer,
  keyHex: string
): Promise<ArrayBuffer> {
  const keyBytes = new Uint8Array(keyHex.match(/.{1,2}/g)!.map((b) => parseInt(b, 16)))
  const iv = new Uint8Array(encrypted.slice(0, 12))
  const data = encrypted.slice(12)
  const cryptoKey = await window.crypto.subtle.importKey(
    "raw",
    keyBytes,
    {name: "AES-GCM"},
    false,
    ["decrypt"]
  )
  return await window.crypto.subtle.decrypt({name: "AES-GCM", iv}, cryptoKey, data)
}

const isImage = (filename: string) => /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(filename)

function EncryptedUrlEmbed({url}: EncryptedUrlEmbedProps) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState<number | null>(null)
  const meta = parseHashMeta(url)

  // For images: decrypt and display immediately
  useEffect(() => {
    if (!meta || !isImage(meta.n)) return
    let revoked = false
    setLoading(true)
    setError(null)
    setBlobUrl(null)
    fetch(url.split("#")[0])
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch encrypted file")
        return res.arrayBuffer()
      })
      .then((encrypted) => decryptAesGcm(encrypted, meta.k))
      .then((decrypted) => {
        if (revoked) return
        const blob = new Blob([decrypted])
        const url = URL.createObjectURL(blob)
        setBlobUrl(url)
        setLoading(false)
      })
      .catch((e) => {
        setError(e.message || "Failed to decrypt file")
        setLoading(false)
      })
    return () => {
      revoked = true
      if (blobUrl) URL.revokeObjectURL(blobUrl)
    }
  }, [url])

  // For non-images: only decrypt on button click
  const handleDownload = async () => {
    if (!meta) return
    setLoading(true)
    setError(null)
    setProgress(0)
    try {
      const fileUrl = url.split("#")[0]
      const resp = await fetchWithProgress(fileUrl, (p) => setProgress(p))
      if (!resp.ok) throw new Error("Failed to fetch encrypted file")
      const encrypted = await resp.arrayBuffer()
      const decrypted = await decryptAesGcm(encrypted, meta.k)
      const blob = new Blob([decrypted])
      const blobUrl = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = blobUrl
      a.download = meta.n
      document.body.appendChild(a)
      a.click()
      setTimeout(() => {
        URL.revokeObjectURL(blobUrl)
        document.body.removeChild(a)
      }, 1000)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e) || "Failed to decrypt file")
    } finally {
      setLoading(false)
      setProgress(null)
    }
  }

  // Helper for fetch with progress
  async function fetchWithProgress(url: string, onProgress: (percent: number) => void) {
    const resp = await fetch(url)
    if (!resp.body || !resp.ok) return resp
    const contentLength = Number(resp.headers.get("content-length"))
    if (!contentLength) return resp
    const reader = resp.body.getReader()
    let received = 0
    const chunks = []
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const {done, value} = await reader.read()
      if (done) break
      if (value) {
        chunks.push(value)
        received += value.length
        onProgress(Math.round((received / contentLength) * 100))
      }
    }
    const blob = new Blob(chunks)
    const arrayBuffer = await blob.arrayBuffer()
    // Assign a custom arrayBuffer method to the response object
    const respAny = resp as unknown as {arrayBuffer?: () => Promise<ArrayBuffer>}
    respAny.arrayBuffer = () => Promise.resolve(arrayBuffer)
    return resp
  }

  if (!meta) return <span className="text-error">Invalid encrypted URL</span>

  if (isImage(meta.n)) {
    if (loading) return <div className="p-2 text-sm text-gray-500">Decrypting...</div>
    if (error) return <div className="p-2 text-sm text-error">{error}</div>
    if (blobUrl) {
      return (
        <img
          src={blobUrl}
          alt={meta.n}
          style={{maxWidth: "100%", maxHeight: 400, borderRadius: 8}}
        />
      )
    }
    return null
  }

  // Non-image: show download button and progress
  return (
    <div className="inline-flex flex-col items-start gap-1 w-full max-w-xs">
      <div className="flex items-center gap-2">
        <button
          className="btn btn-sm flex items-center gap-1"
          disabled={loading}
          onClick={handleDownload}
        >
          <RiDownload2Line size={16} />
          {loading ? "Decrypting..." : `Download ${meta.n}`}
        </button>
        <span className="text-xs">{formatSize(meta.s)}</span>
      </div>
      {loading && progress !== null && (
        <div className="w-full bg-base-200 rounded h-2 mt-1">
          <div className="bg-primary h-2 rounded" style={{width: `${progress}%`}}></div>
          <div className="text-xs mt-1">{progress}%</div>
        </div>
      )}
      {error && <span className="text-error text-xs">{error}</span>}
    </div>
  )
}

export default EncryptedUrlEmbed
