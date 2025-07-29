// Regular expressions for validation
export const NIP05_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
export const NOSTR_REGEX = /(npub|note|nevent|naddr|nprofile)1[a-zA-Z0-9]{58,300}/gi
export const HEX_REGEX = /[0-9a-fA-F]{64}/gi
export const HEX_REGEX_STRICT = /^[0-9a-fA-F]{64}$/ // For exact 64-char hex strings
export const NSEC_NPUB_REGEX = /(nsec1|npub1)[a-zA-Z0-9]{20,65}/gi
export const EMOJI_REGEX = /^[\p{Extended_Pictographic}\p{Emoji_Presentation}]+$/u

// Validation functions
export const isValidNip05 = (nip05: string): boolean => {
  return NIP05_REGEX.test(nip05)
}

export const isValidNostrId = (id: string): boolean => {
  return NOSTR_REGEX.test(id)
}

export const isValidHexKey = (key: string): boolean => {
  return HEX_REGEX.test(key)
}

export const isStrictHexKey = (key: string): boolean => {
  return HEX_REGEX_STRICT.test(key)
}

export const isNostrKey = (key: string): boolean => {
  return NSEC_NPUB_REGEX.test(key)
}

export const isOnlyEmoji = (text: string): boolean => {
  return EMOJI_REGEX.test(text.trim())
}
