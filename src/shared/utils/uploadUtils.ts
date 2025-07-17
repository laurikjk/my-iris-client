import {bytesToHex} from "@noble/hashes/utils"

// Fallback random generator for non-secure contexts
function getRandomValuesFallback(array: Uint8Array): Uint8Array {
  for (let i = 0; i < array.length; i++) {
    array[i] = Math.floor(Math.random() * 256)
  }
  return array
}

// Safe wrapper for crypto.getRandomValues
function getRandomValues(array: Uint8Array): Uint8Array {
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    try {
      return crypto.getRandomValues(array)
    } catch (e) {
      // Fallback if crypto API is not available (e.g., HTTP context)
      return getRandomValuesFallback(array)
    }
  }
  return getRandomValuesFallback(array)
}

export async function calculateSHA256(file: File): Promise<string> {
  const buffer = await file.arrayBuffer()
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("")
}

export async function encryptFileWithAesGcm(
  file: File
): Promise<{encryptedFile: File; key: string; iv: string}> {
  const key = getRandomValues(new Uint8Array(32)) // 256-bit key
  const iv = getRandomValues(new Uint8Array(12)) // 96-bit IV
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
