import {nip19} from "nostr-tools"
import {parseNostrIdentifier} from "./nostrIdentifier"

interface HandleIdentifierOptions {
  input: string
  navigate: (path: string) => void
  onTextSearch?: (query: string) => void
  clearInput?: () => void
}

export async function handleNostrIdentifier({
  input,
  navigate,
  onTextSearch,
  clearInput,
}: HandleIdentifierOptions): Promise<void> {
  const trimmed = input.trim()
  if (!trimmed) return

  const result = await parseNostrIdentifier(trimmed)

  // Clear input FIRST for all Nostr identifier types, before navigation
  // This ensures the input is cleared even if navigation happens quickly
  const shouldClear = result.type !== "text"
  if (shouldClear && clearInput) {
    clearInput()
    // Small delay to ensure state update happens before navigation
    await new Promise((resolve) => setTimeout(resolve, 0))
  }

  switch (result.type) {
    case "npub":
      navigate(`/${nip19.npubEncode(result.data)}`)
      break
    case "nprofile":
      navigate(`/${nip19.npubEncode(result.data.pubkey)}`)
      break
    case "hex":
      if (result.data.length === 64) {
        try {
          navigate(`/${nip19.npubEncode(result.data)}`)
        } catch {
          onTextSearch?.(trimmed)
        }
      } else {
        onTextSearch?.(trimmed)
      }
      break
    case "nip05":
      navigate(`/${nip19.npubEncode(result.data)}`)
      break
    case "note":
      navigate(`/note/${result.data}`)
      break
    case "nevent":
      navigate(`/note/${result.data.id}`)
      break
    case "naddr":
      navigate(`/${nip19.naddrEncode(result.data)}`)
      break
    case "text":
    default:
      onTextSearch?.(trimmed)
      break
  }
}
