import {describe, expect, it} from "vitest"
import {encryptFileWithAesGcm} from "./utils"

// Helper function to decrypt (adapted from EncryptedUrlEmbed.tsx)
async function decryptAesGcm(
  encrypted: ArrayBuffer,
  keyHex: string
): Promise<ArrayBuffer> {
  const keyBytes = new Uint8Array(keyHex.match(/.{1,2}/g)!.map((b) => parseInt(b, 16)))
  const iv = new Uint8Array(encrypted.slice(0, 12))
  const data = encrypted.slice(12)
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    {name: "AES-GCM"},
    false,
    ["decrypt"]
  )
  return await crypto.subtle.decrypt({name: "AES-GCM", iv}, cryptoKey, data)
}

describe("Upload Encryption", () => {
  it("should encrypt file content so plaintext is not present", async () => {
    const plaintextContent = "SECRET_PLAINTEXT_CONTENT_12345"
    const file = new File([plaintextContent], "test.txt", {type: "text/plain"})

    const {encryptedFile, key} = await encryptFileWithAesGcm(file)
    
    // Get encrypted content as text to check for plaintext
    const encryptedText = await encryptedFile.text()
    
    // Verify plaintext is not present in encrypted output
    expect(encryptedText).not.toContain(plaintextContent)
    expect(encryptedText).not.toContain("SECRET")
    expect(encryptedText).not.toContain("PLAINTEXT")
    expect(encryptedText).not.toContain("12345")
    
    // Verify we got a key
    expect(key).toMatch(/^[0-9a-f]{64}$/) // 32 bytes = 64 hex chars
  })

  it("should encrypt and decrypt file content correctly", async () => {
    const plaintextContent = "This is secret test content that should be encrypted!"
    const file = new File([plaintextContent], "test.txt", {type: "text/plain"})

    // Encrypt the file
    const {encryptedFile, key} = await encryptFileWithAesGcm(file)
    
    // Get encrypted data
    const encryptedData = await encryptedFile.arrayBuffer()
    
    // Decrypt the data
    const decryptedData = await decryptAesGcm(encryptedData, key)
    const decryptedText = new TextDecoder().decode(decryptedData)
    
    // Verify decryption worked
    expect(decryptedText).toBe(plaintextContent)
  })

  it("should produce different encrypted output for same plaintext (random IV)", async () => {
    const plaintextContent = "Same content"
    const file1 = new File([plaintextContent], "test1.txt", {type: "text/plain"})
    const file2 = new File([plaintextContent], "test2.txt", {type: "text/plain"})

    const {encryptedFile: encrypted1, key: key1} = await encryptFileWithAesGcm(file1)
    const {encryptedFile: encrypted2, key: key2} = await encryptFileWithAesGcm(file2)
    
    const data1 = await encrypted1.arrayBuffer()
    const data2 = await encrypted2.arrayBuffer()
    
    // Different keys should be generated
    expect(key1).not.toBe(key2)
    
    // Encrypted data should be different (due to random IV)
    expect(new Uint8Array(data1)).not.toEqual(new Uint8Array(data2))
    
    // But both should decrypt to same plaintext
    const decrypted1 = await decryptAesGcm(data1, key1)
    const decrypted2 = await decryptAesGcm(data2, key2)
    
    expect(new TextDecoder().decode(decrypted1)).toBe(plaintextContent)
    expect(new TextDecoder().decode(decrypted2)).toBe(plaintextContent)
  })

  it("should use provided key when keyOverride is specified", async () => {
    const plaintextContent = "Test with fixed key"
    const file = new File([plaintextContent], "test.txt", {type: "text/plain"})
    const fixedKey = new Uint8Array(32).fill(42) // All bytes = 42

    const {encryptedFile, key} = await encryptFileWithAesGcm(file, fixedKey)
    
    // Should return the fixed key in hex
    const expectedKeyHex = Array.from(fixedKey)
      .map(b => b.toString(16).padStart(2, "0"))
      .join("")
    expect(key).toBe(expectedKeyHex)
    
    // Should still decrypt correctly
    const encryptedData = await encryptedFile.arrayBuffer()
    const decryptedData = await decryptAesGcm(encryptedData, key)
    const decryptedText = new TextDecoder().decode(decryptedData)
    
    expect(decryptedText).toBe(plaintextContent)
  })
})