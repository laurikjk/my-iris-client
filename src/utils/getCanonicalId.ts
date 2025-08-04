/**
 * Calculate a canonical ID for a message by hashing its content without the id.
 * This ensures messages are deduplicated properly across different sessions
 * where the same message might have different encrypted IDs.
 *
 * @param message The message to calculate canonical ID for
 * @returns The calculated canonical ID
 */
export async function getCanonicalId(message: {
  id?: string
  pubkey: string
  created_at: number
  kind: number
  tags: string[][]
  content: string
  [key: string]: unknown
}): Promise<string> {
  // Create a copy of the message without the id
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const {id, ...messageWithoutId} = message

  // Create a deterministic object with consistent property ordering
  const messageForHash = {
    pubkey: messageWithoutId.pubkey,
    created_at: messageWithoutId.created_at,
    kind: messageWithoutId.kind,
    tags: messageWithoutId.tags,
    content: messageWithoutId.content,
  }

  const hashInput = JSON.stringify(messageForHash)

  const hashBuffer = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(hashInput)
  )
  const canonicalId = Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")

  return canonicalId
}
