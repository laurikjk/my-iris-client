// Nostr Event Kinds Constants
// Based on NIPs (Nostr Implementation Possibilities)
// Only includes constants that are actually used in the codebase

// NIP-01: Basic protocol
export const KIND_METADATA = 0 // User profile metadata
export const KIND_TEXT_NOTE = 1 // Text note
export const KIND_CONTACTS = 3 // Contact list (follows)

// NIP-18: Reposts
export const KIND_REPOST = 6

// NIP-25: Reactions
export const KIND_REACTION = 7

// NIP-16: Event Treatment
export const KIND_EPHEMERAL = 20000 // Ephemeral events

// NIP-04: Encrypted Direct Messages
export const KIND_CHAT_MESSAGE = 14 // Encrypted direct message (double-ratchet)

// NIP-28: Public chat
export const KIND_CHANNEL_CREATE = 40 // Channel creation
export const KIND_CHANNEL_MESSAGE = 42 // Channel message

// NIP-57: Lightning zaps
export const KIND_ZAP_RECEIPT = 9735

// NIP-51: Lists
export const KIND_MUTE_LIST = 10000 // Mute list (deprecated, use 30000)

// NIP-78: App-specific data
export const KIND_APP_DATA = 30078

// Long-form content
export const KIND_LONG_FORM_CONTENT = 30023

// HTTP authentication
export const KIND_HTTP_AUTH = 27235

// Blossom authorization
export const KIND_BLOSSOM_AUTH = 24242

// Debug/development
export const KIND_DEBUG_DATA = 30000 // Used for encrypted debug key-value storage

// Classified listings
export const KIND_CLASSIFIED = 30402

// Highlights
export const KIND_HIGHLIGHT = 9802

// NIP-68: Picture-first feeds
export const KIND_PICTURE_FIRST = 20

// Additional kinds found in codebase
export const KIND_WALLET_CONNECT = 6927
