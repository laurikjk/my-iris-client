import Dexie, {type Table} from "dexie"
import {decode} from "light-bolt11-decoder"

export type PaymentMetadata = {
  invoice: string
  type: "zap" | "dm" | "other"
  peerPubkey?: string // who we paid or who paid us
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
  }
}

const db = new PaymentMetadataDB()

function normalizeInvoice(invoice: string): string {
  // Remove lightning: prefix and convert to lowercase for consistent matching
  return invoice.replace(/^lightning:/i, "").toLowerCase()
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
  peerPubkey?: string,
  eventId?: string,
  message?: string,
  destination?: string
) {
  const normalized = normalizeInvoice(invoice)

  // If no message provided, try to extract from invoice
  const finalMessage = message || extractDescriptionFromInvoice(invoice)

  console.log("💾 Saving payment metadata:", {
    normalized,
    type,
    peerPubkey,
    eventId,
    message: finalMessage,
    destination,
  })
  await db.paymentMetadata.put({
    invoice: normalized,
    type,
    peerPubkey,
    eventId,
    message: finalMessage,
    destination,
    timestamp: Date.now(),
  })
}

export async function getPaymentMetadata(
  invoice: string
): Promise<PaymentMetadata | undefined> {
  const normalized = normalizeInvoice(invoice)
  const metadata = await db.paymentMetadata.get(normalized)
  console.log("🔍 Looking up payment metadata:", {normalized, found: !!metadata})
  return metadata
}

export async function clearOldPaymentMetadata() {
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000
  await db.paymentMetadata.where("timestamp").below(thirtyDaysAgo).delete()
}
