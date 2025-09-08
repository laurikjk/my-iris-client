import {Name} from "@/shared/components/user/Name"
import {RiFlashlightFill} from "@remixicon/react"
import {NDKEvent} from "@nostr-dev-kit/ndk"
import {Link} from "@/navigation"
import {nip19} from "nostr-tools"
import {useEffect, useState} from "react"
import {decode} from "light-bolt11-decoder"
import {formatAmount} from "@/utils/utils"
import {getZappingUser} from "@/utils/nostr"

interface ZapReceiptHeaderProps {
  event: NDKEvent
}

function ZapReceiptHeader({event}: ZapReceiptHeaderProps) {
  const [zappedAmount, setZappedAmount] = useState<number>()
  const zappingUser = getZappingUser(event, false)

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

  // Don't render if we can't get the zapping user
  if (!zappingUser) {
    return null
  }

  const truncatedContent =
    event.content?.length > 50 ? event.content.slice(0, 50) + "..." : event.content

  return (
    <div className="flex justify-between items-start gap-4 flex-wrap w-full">
      <Link
        to={`/${nip19.npubEncode(zappingUser)}`}
        className="flex items-center font-bold text-sm text-base-content/50 hover:underline flex-shrink-0"
      >
        <Name pubKey={zappingUser} />
        <span className="mx-1">zapped</span>
        <span className="text-yellow-600 font-semibold">
          {formatAmount(zappedAmount || 0)}₿
        </span>
        <RiFlashlightFill className="w-4 h-4 text-yellow-500 ml-1" />
      </Link>
      {truncatedContent && (
        <div className="text-sm text-base-content/70 flex-shrink min-w-0 text-right">
          {truncatedContent}
        </div>
      )}
    </div>
  )
}

export default ZapReceiptHeader
