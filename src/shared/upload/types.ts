export type MediaServerProtocol = "blossom" | "nip96"

export interface MediaServer {
  url: string
  protocol: MediaServerProtocol
  isDefault?: boolean
}
