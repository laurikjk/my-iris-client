import Dexie, {type Table} from "dexie"

export type PaymentMetadata = {
  invoice: string
  type: "zap" | "dm" | "other"
  peerPubkey?: string // who we paid or who paid us
  eventId?: string // zapped event or dm event
  timestamp: number
}

class PaymentMetadataDB extends Dexie {
  paymentMetadata!: Table<PaymentMetadata, string>

  constructor() {
    super("PaymentMetadata")
    this.version(1).stores({
      paymentMetadata: "invoice, timestamp",
    })
  }
}

const db = new PaymentMetadataDB()

function normalizeInvoice(invoice: string): string {
  // Remove lightning: prefix and convert to lowercase for consistent matching
  return invoice.replace(/^lightning:/i, "").toLowerCase()
}

export async function savePaymentMetadata(
  invoice: string,
  type: PaymentMetadata["type"],
  peerPubkey?: string,
  eventId?: string
) {
  const normalized = normalizeInvoice(invoice)
  console.log("💾 Saving payment metadata:", {normalized, type, peerPubkey, eventId})
  await db.paymentMetadata.put({
    invoice: normalized,
    type,
    peerPubkey,
    eventId,
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
