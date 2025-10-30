import Dexie, {type Table} from "dexie"
import {decode} from "light-bolt11-decoder"

export type PaymentMetadata = {
  invoice: string
  type: "zap" | "dm" | "other"
  recipient?: string // who we paid to (for send entries)
  sender?: string // who paid us (for receive entries)
  eventId?: string // zapped event or dm event
  message?: string // description from invoice
  destination?: string // lightning address or lnurl we paid to
  timestamp: number
}

class PaymentMetadataDB extends Dexie {
  paymentMetadata!: Table<PaymentMetadata, string>

  constructor() {
    super("PaymentMetadata")
    this.version(1).stores({
      paymentMetadata: "invoice, timestamp",
    })
    // Version 2: add message field
    this.version(2).stores({
      paymentMetadata: "invoice, timestamp",
    })
    // Version 3: add destination field
    this.version(3).stores({
      paymentMetadata: "invoice, timestamp",
    })
    // Version 4: rename peerPubkey to recipient
    this.version(4)
      .stores({
        paymentMetadata: "invoice, timestamp",
      })
      .upgrade((tx) => {
        return tx
          .table("paymentMetadata")
          .toCollection()
          .modify((metadata) => {
            if (metadata.peerPubkey) {
              metadata.recipient = metadata.peerPubkey
              delete metadata.peerPubkey
            }
          })
      })
  }
}

const db = new PaymentMetadataDB()

function normalizeInvoice(invoice: string): string {
  // Remove lightning: prefix
  const normalized = invoice.replace(/^lightning:/i, "")

  // Only lowercase for lightning invoices (lnbc, lnurl)
  // Cashu tokens are case-sensitive, so preserve case
  if (
    normalized.toLowerCase().startsWith("lnbc") ||
    normalized.toLowerCase().startsWith("lnurl")
  ) {
    return normalized.toLowerCase()
  }

  return normalized
}

function extractDescriptionFromInvoice(invoice: string): string | undefined {
  try {
    const decoded = decode(invoice)
    const descSection = decoded.sections.find((s) => s.name === "description")
    if (descSection && "value" in descSection) {
      return descSection.value as string
    }
  } catch (err) {
    console.warn("Failed to decode invoice for description:", err)
  }
  return undefined
}

export async function savePaymentMetadata(
  invoice: string,
  type: PaymentMetadata["type"],
  recipient?: string,
  eventId?: string,
  message?: string,
  destination?: string,
  sender?: string
) {
  const normalized = normalizeInvoice(invoice)

  // If no message provided, try to extract from invoice
  const finalMessage = message || extractDescriptionFromInvoice(invoice)

  // Get existing metadata to merge with
  const existing = await db.paymentMetadata.get(normalized)

  // Merge with existing data - only update fields that are explicitly provided
  const merged: PaymentMetadata = {
    invoice: normalized,
    type: existing?.type || type,
    recipient: existing?.recipient,
    sender: existing?.sender,
    eventId: existing?.eventId,
    message: existing?.message,
    destination: existing?.destination,
    timestamp: existing?.timestamp || Date.now(),
  }

  // Only override with new values if they are provided (not undefined)
  if (type) merged.type = type
  if (recipient) merged.recipient = recipient
  if (sender) merged.sender = sender
  if (eventId) merged.eventId = eventId
  if (finalMessage) merged.message = finalMessage
  if (destination) merged.destination = destination

  await db.paymentMetadata.put(merged)
}

export async function getPaymentMetadata(
  invoice: string
): Promise<PaymentMetadata | undefined> {
  const normalized = normalizeInvoice(invoice)
  return await db.paymentMetadata.get(normalized)
}
