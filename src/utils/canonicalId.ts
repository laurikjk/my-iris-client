/**
 * Calculate a canonical ID for a message that is consistent across all sessions.
 * This allows reactions to reference messages correctly even when each session
 * has different encrypted message IDs.
 *
 * @param event The event to calculate canonical ID for
 */
export async function calculateCanonicalId(event: {
  pubkey: string
  created_at: number
  kind: number
  tags: string[][]
  content: string
}): Promise<string> {
  // Create a deterministic object with consistent property ordering
  // Use identity pubkey if provided (to normalize across different session pubkeys)
  // Otherwise exclude pubkey entirely from the hash to ensure consistency
  const eventForHash = {
    // Don't include pubkey in hash since it varies by session
    // The identity is already known from the chat context
    created_at: event.created_at,
    kind: event.kind,
    tags: event.tags,
    content: event.content,
  }

  const hashInput = JSON.stringify(eventForHash)
  const hashBuffer = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(hashInput)
  )
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}
