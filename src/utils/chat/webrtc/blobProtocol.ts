/**
 * WebRTC blob transfer protocol types and constants
 */

export const BLOB_CHUNK_SIZE = 16384 // 16 KiB chunks (BitTorrent v2 compatible)
export const BLOB_ACK_TIMEOUT = 30000 // 30 seconds
export const DEFAULT_SATS_PER_GB = 100

/**
 * Blob request message
 * ["BLOB_REQ", request_id, {hash, size?, payment}]
 */
export interface BlobRequest {
  hash: string // SHA-256 hex
  size?: number // if known from blossom metadata
  payment?: {
    mode?: "postpay" | "prepay"
    max_sats?: number
  }
}

/**
 * Blob response message
 * ["BLOB_RES", request_id, {size, chunks, payment}]
 */
export interface BlobResponse {
  size: number
  chunks: number
  payment?: {
    mode: "postpay" | "prepay"
    amount: number
    unit: "sat"
    pricing: {
      rate: number // sats per GB
      size_bytes: number
    }
    method: "ln" | "cashu" | "both"
    ln_invoice?: string
    cashu_mint?: string
    cashu_request?: string
  }
}

/**
 * Blob acknowledgment message
 * ["BLOB_ACK", request_id, {accept, payment_proof?}]
 */
export interface BlobAck {
  accept: boolean
  payment_proof?: string // preimage or cashu token
}

/**
 * Blob completion/verification message
 * ["BLOB_OK", request_id, {verified, hash}]
 */
export interface BlobOk {
  verified: boolean
  hash: string
  payment_token?: string // cashu token for postpay
}

/**
 * Binary chunk structure (sent on blob channel)
 * [4 bytes request_id][4 bytes chunk_index][data]
 */
export interface BlobChunkHeader {
  requestId: number // u32
  chunkIndex: number // u32
}

export const BLOB_CHUNK_HEADER_SIZE = 8 // 4 + 4 bytes

/**
 * Encode chunk header to binary
 */
export function encodeBlobChunkHeader(requestId: number, chunkIndex: number): Uint8Array {
  const buffer = new ArrayBuffer(BLOB_CHUNK_HEADER_SIZE)
  const view = new DataView(buffer)
  view.setUint32(0, requestId, false) // big-endian
  view.setUint32(4, chunkIndex, false)
  return new Uint8Array(buffer)
}

/**
 * Decode chunk header from binary
 */
export function decodeBlobChunkHeader(data: ArrayBuffer): BlobChunkHeader {
  const view = new DataView(data, 0, BLOB_CHUNK_HEADER_SIZE)
  return {
    requestId: view.getUint32(0, false),
    chunkIndex: view.getUint32(4, false),
  }
}

/**
 * Calculate price for bandwidth
 */
export function calculateBandwidthPrice(
  sizeBytes: number,
  satsPerGB = DEFAULT_SATS_PER_GB
): number {
  const GB = 1_073_741_824 // 1024^3
  return Math.max(1, Math.ceil((sizeBytes / GB) * satsPerGB))
}
