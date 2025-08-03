import {hexToBytes} from "@noble/hashes/utils"

// Helper to get a decrypt function or key bytes based on the availability of a private key.
// If a hex‐encoded private key is provided we return the raw key bytes which nip44 can consume directly.
// Otherwise we fall back to using window.nostr nip44 implementation at runtime.
export const getDecryptFunction = (
  hexPrivKey?: string
): ((cipherText: string, pubkey: string) => Promise<string>) | Uint8Array => {
  if (hexPrivKey) {
    return hexToBytes(hexPrivKey)
  }
  return async (cipherText: string, pubkey: string) => {
    if (window.nostr?.nip44) {
      return window.nostr.nip44.decrypt(pubkey, cipherText)
    }
    throw new Error("No nostr extension or private key available for decryption")
  }
}

// Helper to get an encrypt function or key bytes analogous to getDecryptFunction.
export const getEncryptFunction = (
  hexPrivKey?: string
): ((plaintext: string, pubkey: string) => Promise<string>) | Uint8Array => {
  if (hexPrivKey) {
    return hexToBytes(hexPrivKey)
  }
  return async (plaintext: string, pubkey: string) => {
    if (window.nostr?.nip44) {
      return window.nostr.nip44.encrypt(pubkey, plaintext)
    }
    throw new Error("No nostr extension or private key available for encryption")
  }
}
