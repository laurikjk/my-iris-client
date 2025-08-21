import {bytesToHex} from "@noble/hashes/utils"

export async function calculateSHA256(file: File): Promise<string> {
  const buffer = await file.arrayBuffer()
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("")
}

export async function encryptFileWithAesGcm(
  file: File,
  keyOverride?: Uint8Array
): Promise<{encryptedFile: File; key: string; iv: string}> {
  const key = keyOverride || crypto.getRandomValues(new Uint8Array(32)) // 256-bit key
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
