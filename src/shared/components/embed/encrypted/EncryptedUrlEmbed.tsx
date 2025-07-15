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
  const [loading, setLoading] = useState(true)
  const meta = parseHashMeta(url)

  useEffect(() => {
    let revoked = false
    if (!meta) {
      setError("Invalid encrypted URL metadata")
      setLoading(false)
      return
    }
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

  if (loading) return <div className="p-2 text-sm text-gray-500">Decrypting...</div>
  if (error) return <div className="p-2 text-sm text-error">{error}</div>
  if (!meta) return null
  if (!blobUrl) return null

  if (isImage(meta.n)) {
    return (
      <img
        src={blobUrl}
        alt={meta.n}
        style={{maxWidth: "100%", maxHeight: 400, borderRadius: 8}}
      />
    )
  }
  return (
    <a
      href={blobUrl}
      download={meta.n}
      className="inline-flex items-center gap-2 px-3 py-2 bg-base-200 rounded hover:bg-base-300 border border-base-300"
    >
      <span>Download {meta.n}</span>
    </a>
  )
}

export default EncryptedUrlEmbed
