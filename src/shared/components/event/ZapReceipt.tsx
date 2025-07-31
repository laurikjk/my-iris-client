import {NDKEvent} from "@nostr-dev-kit/ndk"
import {UserRow} from "../user/UserRow"
import {useEffect, useState} from "react"
import {decode} from "light-bolt11-decoder"
import {RiFlashlightFill} from "@remixicon/react"
import {formatAmount} from "@/utils/utils"

interface ZapReceiptProps {
  event: NDKEvent
}

function ZapReceipt({event}: ZapReceiptProps) {
  const [zappedAmount, setZappedAmount] = useState<number>()

  // Extract zap amount from bolt11 invoice
  useEffect(() => {
    const invoice = event.tagValue("bolt11")
    if (invoice) {
      const decodedInvoice = decode(invoice)
      const amountSection = decodedInvoice.sections.find(
        (section) => section.name === "amount"
      )
      if (amountSection && "value" in amountSection) {
        setZappedAmount(Math.floor(parseInt(amountSection.value) / 1000))
      }
    }
  }, [event])

  const zapRecipient = event.tagValue("P") || event.tagValue("p")

  return (
    <div className="px-4">
      <div className="flex justify-between items-center gap-2 mb-2 flex-wrap">
        <div className="flex items-center gap-1 flex-wrap">
          <RiFlashlightFill className="w-4 h-4 text-yellow-500" />
          <span className="text-base-content/70">zapped</span>
          <span className="text-yellow-600 font-semibold">
            {formatAmount(zappedAmount || 0)} sats
          </span>
          <span className="text-base-content/70">to</span>
          {zapRecipient && (
            <UserRow pubKey={zapRecipient} avatarWidth={20} showHoverCard={true} />
          )}
        </div>
        <div className="flex items-center gap-1">
          <span className="text-base-content/50 text-sm">verified by</span>
          <UserRow pubKey={event.pubkey} avatarWidth={20} />
        </div>
      </div>
      {event.content && (
        <div className="mt-2 text-base-content/70">
          <p>{event.content}</p>
        </div>
      )}
    </div>
  )
}

export default ZapReceipt
