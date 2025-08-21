import type {EncryptionMeta} from "@/types/global"

export type MediaServerProtocol = "blossom" | "nip96"

export interface MediaServer {
  url: string
  protocol: MediaServerProtocol
  isDefault?: boolean
}

export interface UploadResult {
  url: string
  encryptionMeta?: EncryptionMeta
}
