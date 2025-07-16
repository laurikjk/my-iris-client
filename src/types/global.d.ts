declare global {
  interface Window {
    cf_turnstile_callback?: (token: string) => void
    webln?: WebLNProvider
  }
}

export interface WebLNProvider {
  isEnabled: () => Promise<boolean>
  sendPayment: (pr: string) => Promise<void>
  getBalance: () => Promise<{balance: number}>
  on: (eventName: "accountChanged", listener: () => void) => void
  off: (eventName: "accountChanged", listener: () => void) => void
}

export interface EncryptionMeta {
  decryptionKey: string // hex string
  fileName: string // original file name
  fileSize: number // original file size in bytes
  algorithm?: string // e.g., 'AES-GCM'
}

export {}
