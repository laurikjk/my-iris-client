// Regular expressions for validation
export const NIP05_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
export const NOSTR_REGEX = /(npub|note|nevent|naddr|nprofile)1[a-zA-Z0-9]{58,300}/gi
export const HEX_REGEX = /[0-9a-fA-F]{64}/gi
export const NSEC_NPUB_REGEX = /(nsec1|npub1)[a-zA-Z0-9]{20,65}/gi
export const EMOJI_REGEX = /^[\p{Extended_Pictographic}\p{Emoji_Presentation}]+$/u
