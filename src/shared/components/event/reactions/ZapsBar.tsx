import {NDKEvent} from "@nostr-dev-kit/ndk"
import {useEffect, useState} from "react"
import {formatAmount} from "@/utils/utils"
import {decode} from "light-bolt11-decoder"
import {getZappingUser} from "@/utils/nostr"
import {Name} from "@/shared/components/user/Name"
import {ndk} from "@/utils/ndk"
import {Link} from "@/navigation"
import {nip19} from "nostr-tools"

interface ZapInfo {
  amount: number
  pubkey: string
  comment: string
  event: NDKEvent
}

interface ZapsBarProps {
  event: NDKEvent
}

export default function ZapsBar({event}: ZapsBarProps) {
  const [zaps, setZaps] = useState<ZapInfo[]>([])

  useEffect(() => {
    const filter = {
      kinds: [9735],
      ["#e"]: [event.id],
    }

    const sub = ndk().subscribe(filter)

    sub?.on("event", (zapEvent: NDKEvent) => {
      const invoice = zapEvent.tagValue("bolt11")
      if (invoice) {
        const decodedInvoice = decode(invoice)
        const amountSection = decodedInvoice.sections.find(
          (section) => section.name === "amount"
        )
        if (amountSection && "value" in amountSection) {
          const amount = Math.floor(parseInt(amountSection.value) / 1000)
          const zappingUser = getZappingUser(zapEvent)
          const description = zapEvent.tagValue("description")
          let comment = ""

          if (description) {
            try {
              const descEvent = JSON.parse(description)
              comment = descEvent.content || ""
            } catch (e) {
              // Ignore parse errors
            }
          }

          const zapInfo: ZapInfo = {
            amount,
            pubkey: zappingUser,
            comment: comment.slice(0, 50), // Limit to 50 chars as requested
            event: zapEvent,
          }

          setZaps((prev) => {
            const exists = prev.some((z) => z.event.id === zapEvent.id)
            if (exists) return prev

            const newZaps = [...prev, zapInfo]
            // Sort by amount descending
            return newZaps.sort((a, b) => b.amount - a.amount)
          })
        }
      }
    })

    return () => {
      sub.stop()
    }
  }, [event.id])

  return (
    <div className="flex gap-2 overflow-x-auto py-2 scrollbar-thin min-h-[38px]">
      {zaps.length === 0 ? (
        // Invisible placeholder with same height as actual elements
        <div className="flex-shrink-0 px-3 py-1.5 opacity-0">
          <span className="text-sm">⚡ 0</span>
        </div>
      ) : (
        zaps.map((zap) => (
          <div
            key={zap.event.id}
            className="flex-shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-full bg-orange-500/10 border border-orange-500/20 text-sm"
          >
            <span className="text-orange-500 font-semibold">
              ⚡ {formatAmount(zap.amount)}
            </span>
            <Link
              to={`/${nip19.npubEncode(zap.pubkey)}`}
              onClick={(e) => e.stopPropagation()}
              className="hover:underline truncate max-w-[120px]"
            >
              <Name pubKey={zap.pubkey} displayNameOnly />
            </Link>
            {zap.comment && (
              <span className="text-base-content/50 text-xs max-w-[150px] truncate">
                &ldquo;{zap.comment}&rdquo;
              </span>
            )}
          </div>
        ))
      )}
    </div>
  )
}
