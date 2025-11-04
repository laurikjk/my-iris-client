import {NDKEvent, NDKSigner} from "@nostr-dev-kit/ndk"
import {decode} from "light-bolt11-decoder"
import {nip19, type NostrEvent} from "nostr-tools"
import {makeZapRequest} from "nostr-tools/nip57"
import {ndk, DEFAULT_RELAYS} from "@/utils/ndk"
import {KIND_ZAP_RECEIPT} from "@/utils/constants"
import {bech32} from "@scure/base"

export function getZappingUser(event: NDKEvent, npub = true) {
  const description = event.tags?.find((t) => t[0] === "description")?.[1]
  if (!description) {
    return null
  }
  let obj
  try {
    obj = JSON.parse(description)
  } catch (e) {
    return null
  }
  if (npub) {
    nip19.npubEncode(obj.pubkey)
  }
  return obj.pubkey
}

export async function getZapAmount(event: NDKEvent) {
  const invoice = event.tagValue("bolt11")
  if (invoice) {
    const decodedInvoice = decode(invoice)
    const amountSection = decodedInvoice.sections.find(
      (section) => section.name === "amount"
    )
    if (amountSection && "value" in amountSection) {
      // Convert millisatoshis to bits
      return Math.floor(parseInt(amountSection.value) / 1000)
    }
  }
  return 0
}

export const fetchZappedAmount = async (event: NDKEvent): Promise<number> => {
  return new Promise((resolve) => {
    let zappedAmount = 0
    const filter = {
      kinds: [KIND_ZAP_RECEIPT],
      ["#e"]: [event.id],
    }
    try {
      const sub = ndk().subscribe(filter)

      sub?.on("event", async (event) => {
        const invoice = event.tagValue("bolt11")
        if (invoice) {
          const decodedInvoice = decode(invoice)
          const amountSection = decodedInvoice.sections.find(
            (section) => section.name === "amount"
          )
          if (amountSection && "value" in amountSection) {
            // Convert millisatoshis to bits
            zappedAmount = zappedAmount + Math.floor(parseInt(amountSection.value) / 1000)
          }
        }
      })
      sub?.on("eose", () => {
        sub?.stop()
        resolve(zappedAmount)
      })
    } catch (error) {
      console.warn(error)
    }
  })
}

/**
 * Creates a zap invoice manually by fetching LNURL data and creating a zap request
 * @param event - The event to zap
 * @param amountMsats - Amount in millisatoshis
 * @param comment - Optional zap comment
 * @param lud16 - Lightning address (e.g. user@domain.com)
 * @param signer - NDK signer to sign the zap request
 * @returns Lightning invoice string
 */
export async function createZapInvoice(
  event: NDKEvent,
  amountMsats: number,
  comment: string,
  lud16: string,
  signer: NDKSigner
): Promise<string> {
  // Fetch LNURL data
  const [name, domain] = lud16.split("@")
  const lnurlEndpoint = `https://${domain}/.well-known/lnurlp/${name}`

  const lnurlResponse = await fetch(lnurlEndpoint)
  if (!lnurlResponse.ok) {
    throw new Error(`Failed to fetch LNURL endpoint: ${lnurlResponse.status}`)
  }

  const lnurlData = await lnurlResponse.json()

  if (!lnurlData.allowsNostr) {
    throw new Error("This lightning address doesn't support Nostr zaps")
  }

  // Get relays from NDK pool or use defaults
  const ndkInstance = ndk()
  const connectedRelays = ndkInstance.pool?.connectedRelays()?.map((r) => r.url) || []
  const relaysToUse = connectedRelays.length > 0 ? connectedRelays : DEFAULT_RELAYS

  // Get the raw event which has all required properties
  const rawEvent = event.rawEvent ? event.rawEvent() : event

  // Create event zap request (not profile zap)
  const zapRequest = makeZapRequest({
    event: rawEvent as NostrEvent, // nostr-tools expects Event type
    amount: amountMsats, // nostr-tools expects number, not string
    comment: comment || "",
    relays: relaysToUse.slice(0, 4), // Use first 4 relays as per NIP-57
  })

  // Sign the zap request
  const zapRequestEvent = new NDKEvent(ndk(), zapRequest)
  await zapRequestEvent.sign(signer)

  // Get the invoice from the LNURL endpoint
  const invoiceUrl = new URL(lnurlData.callback)
  invoiceUrl.searchParams.append("amount", amountMsats.toString())
  invoiceUrl.searchParams.append("nostr", JSON.stringify(zapRequestEvent.rawEvent()))

  const invoiceResponse = await fetch(invoiceUrl.toString())
  if (!invoiceResponse.ok) {
    throw new Error(`Failed to fetch invoice: ${invoiceResponse.status}`)
  }

  const invoiceData = await invoiceResponse.json()
  const invoice = invoiceData.pr

  if (!invoice) {
    throw new Error("No invoice returned from LNURL endpoint")
  }

  return invoice
}

/**
 * Create and publish a zap request, then get the invoice
 * This combines creating the zap with publishing it to relays
 */
export async function createAndPublishZapInvoice(
  event: NDKEvent,
  amountMsats: number,
  comment: string,
  lud16: string,
  signer: NDKSigner
): Promise<string> {
  // Parse lightning address
  const [name, domain] = lud16.split("@")
  if (!name || !domain) {
    throw new Error("Invalid lightning address format")
  }

  const lnurlEndpoint = `https://${domain}/.well-known/lnurlp/${name}`

  const lnurlResponse = await fetch(lnurlEndpoint)
  if (!lnurlResponse.ok) {
    throw new Error(`Failed to fetch LNURL endpoint: ${lnurlResponse.status}`)
  }

  const lnurlData = await lnurlResponse.json()

  if (!lnurlData.allowsNostr) {
    throw new Error("This lightning address doesn't support Nostr zaps")
  }

  // Get relays from NDK pool or use defaults
  const ndkInstance = ndk()
  const connectedRelays = ndkInstance.pool?.connectedRelays()?.map((r) => r.url) || []
  const relaysToUse = connectedRelays.length > 0 ? connectedRelays : DEFAULT_RELAYS

  // Get the raw event which has all required properties
  const rawEvent = event.rawEvent ? event.rawEvent() : event

  // Create event zap request (not profile zap)
  const zapRequest = makeZapRequest({
    event: rawEvent as NostrEvent, // nostr-tools expects Event type
    amount: amountMsats, // nostr-tools expects number, not string
    comment: comment || "",
    relays: relaysToUse.slice(0, 4), // Use first 4 relays as per NIP-57
  })

  // Sign and PUBLISH the zap request
  const zapRequestEvent = new NDKEvent(ndk(), zapRequest)
  await zapRequestEvent.sign(signer)
  await zapRequestEvent.publish() // This is the key difference - we publish it

  // Get the invoice from the LNURL endpoint
  const invoiceUrl = new URL(lnurlData.callback)
  invoiceUrl.searchParams.append("amount", amountMsats.toString())
  invoiceUrl.searchParams.append("nostr", JSON.stringify(zapRequestEvent.rawEvent()))

  const invoiceResponse = await fetch(invoiceUrl.toString())
  if (!invoiceResponse.ok) {
    throw new Error(`Failed to fetch invoice: ${invoiceResponse.status}`)
  }

  const invoiceData = await invoiceResponse.json()
  const invoice = invoiceData.pr

  if (!invoice) {
    throw new Error("No invoice returned from LNURL endpoint")
  }

  return invoice
}

export interface ZapInfo {
  id: string
  amount: number
  pubkey: string
  comment: string
  event: NDKEvent
  bolt11?: string // invoice for deduplication
}

/**
 * Parse a zap receipt event (kind 9735) into structured data
 */
export function parseZapReceipt(zapEvent: NDKEvent): ZapInfo | null {
  const invoice = zapEvent.tagValue("bolt11")
  if (!invoice) return null

  try {
    const decodedInvoice = decode(invoice)
    const amountSection = decodedInvoice.sections.find(
      (section) => section.name === "amount"
    )

    if (!amountSection || !("value" in amountSection)) return null

    const amount = Math.floor(parseInt(amountSection.value) / 1000)
    const zappingUser = getZappingUser(zapEvent)

    // Extract comment from description tag
    let comment = ""
    const description = zapEvent.tagValue("description")
    if (description) {
      try {
        const descEvent = JSON.parse(description)
        comment = descEvent.content || ""
      } catch {
        // Ignore parse errors
      }
    }

    return {
      id: zapEvent.id,
      amount,
      pubkey: zappingUser,
      comment,
      event: zapEvent,
      bolt11: invoice,
    }
  } catch (error) {
    console.warn("Failed to parse zap receipt:", error)
    return null
  }
}

/**
 * Calculate total zap amount from a map of zaps grouped by user
 */
export function calculateTotalZapAmount(zapsByUser: Map<string, ZapInfo[]>): number {
  let total = 0
  for (const userZaps of zapsByUser.values()) {
    for (const zap of userZaps) {
      total += zap.amount
    }
  }
  return total
}

/**
 * Group zaps by user and accumulate amounts
 */
export function groupZapsByUser(
  zaps: ZapInfo[]
): Map<string, {totalAmount: number; zaps: ZapInfo[]}> {
  const grouped = new Map<string, {totalAmount: number; zaps: ZapInfo[]}>()

  for (const zap of zaps) {
    const existing = grouped.get(zap.pubkey)
    if (existing) {
      existing.totalAmount += zap.amount
      existing.zaps.push(zap)
    } else {
      grouped.set(zap.pubkey, {
        totalAmount: zap.amount,
        zaps: [zap],
      })
    }
  }

  return grouped
}

/**
 * Decode bech32 LNURL to https URL
 */
function decodeLNURL(lnurl: string): string {
  const decoded = bech32.decodeToBytes(lnurl)
  return new TextDecoder().decode(decoded.bytes)
}

/**
 * Get invoice from lightning address or LNURL with optional comment
 */
export async function getLNURLInvoice(
  input: string,
  amountSats: number,
  comment?: string
): Promise<string> {
  let lnurlEndpoint: string

  // Check if it's a bech32 LNURL
  if (input.toLowerCase().startsWith("lnurl")) {
    lnurlEndpoint = decodeLNURL(input)
  } else {
    // Lightning address format
    const [name, domain] = input.split("@")
    if (!name || !domain) {
      throw new Error("Invalid lightning address format")
    }
    lnurlEndpoint = `https://${domain}/.well-known/lnurlp/${name}`
  }

  const lnurlResponse = await fetch(lnurlEndpoint)
  if (!lnurlResponse.ok) {
    throw new Error(`Failed to fetch LNURL endpoint: ${lnurlResponse.status}`)
  }

  const lnurlData = await lnurlResponse.json()

  const amountMsats = amountSats * 1000
  if (lnurlData.minSendable && amountMsats < lnurlData.minSendable) {
    throw new Error(
      `Amount ${amountSats} is below minimum ${lnurlData.minSendable / 1000} bits`
    )
  }
  if (lnurlData.maxSendable && amountMsats > lnurlData.maxSendable) {
    throw new Error(
      `Amount ${amountSats} exceeds maximum ${lnurlData.maxSendable / 1000} bits`
    )
  }

  const invoiceUrl = new URL(lnurlData.callback)
  invoiceUrl.searchParams.append("amount", amountMsats.toString())

  // Add comment if supported
  const maxCommentLength = lnurlData.commentAllowed || 0
  if (comment && maxCommentLength > 0) {
    const truncated = comment.slice(0, maxCommentLength)
    invoiceUrl.searchParams.append("comment", truncated)
    if (comment.length > maxCommentLength) {
      console.warn(
        `Comment truncated from ${comment.length} to ${maxCommentLength} chars`
      )
    }
  }

  const invoiceResponse = await fetch(invoiceUrl.toString())
  if (!invoiceResponse.ok) {
    throw new Error(`Failed to fetch invoice: ${invoiceResponse.status}`)
  }

  const invoiceData = await invoiceResponse.json()
  if (invoiceData.status === "ERROR") {
    throw new Error(invoiceData.reason || "LNURL server returned error")
  }

  if (!invoiceData.pr) {
    throw new Error("No invoice returned from LNURL endpoint")
  }

  return invoiceData.pr
}
