import {LnPayCb, NDKEvent, NDKZapper} from "@nostr-dev-kit/ndk"
import {useLocalState} from "irisdb-hooks/src/useLocalState"
import {shouldHideEvent} from "@/utils/socialGraph.ts"
import useProfile from "@/shared/hooks/useProfile.ts"
import {getZappingUser} from "@/utils/nostr.ts"
import {LRUCache} from "typescript-lru-cache"
import {formatAmount} from "@/utils/utils.ts"
import {useEffect, useState} from "react"
import Icon from "../../Icons/Icon.tsx"
import ZapModal from "../ZapModal.tsx"
import debounce from "lodash/debounce"
import {localState} from "irisdb/src"
import {ndk} from "@/utils/ndk"

const zapsByEventCache = new LRUCache<string, Map<string, NDKEvent[]>>({
  maxSize: 100,
})

interface FeedItemZapProps {
  event: NDKEvent
}

// TODO fix useLocalState so initial state is properly set from memory, so we can use it instead of this
let myPubKey = ""
localState.get("user/publicKey").on((k) => (myPubKey = k as string))

function FeedItemZap({event}: FeedItemZapProps) {
  const [isWalletConnect] = useLocalState("user/walletConnect", false)
  const [defaultZapAmount] = useLocalState("user/defaultZapAmount", undefined)

  const profile = useProfile(event.pubkey)

  const [showZapModal, setShowZapModal] = useState(false)

  const [zapsByAuthor, setZapsByAuthor] = useState<Map<string, NDKEvent[]>>(
    zapsByEventCache.get(event.id) || new Map()
  )

  const calculateZappedAmount = async (
    zaps: Map<string, NDKEvent[]>
  ): Promise<number> => {
    const bolt11 = await import("bolt11")
    return Array.from(zaps.values())
      .flat()
      .reduce((sum, zap) => {
        const invoice = zap.tagValue("bolt11")
        if (invoice) {
          const decodedInvoice = bolt11.decode(invoice)
          return sum + (decodedInvoice.satoshis || 0)
        }
        return sum
      }, 0)
  }

  const [zappedAmount, setZappedAmount] = useState<number>(0)

  const handleZapClick = async () => {
    if (isWalletConnect && !!defaultZapAmount) {
      handleOneClickZap()
    } else {
      setShowZapModal(true)
    }
  }

  const handleOneClickZap = async () => {
    try {
      const amount = Number(defaultZapAmount) * 1000

      const lnPay: LnPayCb = async ({pr}) => {
        if (isWalletConnect) {
          const {requestProvider} = await import("@getalby/bitcoin-connect")
          const provider = await requestProvider()
          const confirmation = await provider.sendPayment(pr)
          return confirmation
        }
        return undefined
      }

      const zapper = new NDKZapper(event, amount, "msat", {
        comment: "",
        ndk: ndk(),
        lnPay,
        tags: [["e", event.id]],
      })

      await zapper.zap()
    } catch (error) {
      console.warn("Unable to one-click zap:", error)
    }
  }

  useEffect(() => {
    const filter = {
      kinds: [9735],
      ["#e"]: [event.id],
    }

    try {
      const sub = ndk().subscribe(filter)
      const debouncedUpdateAmount = debounce(async (zapsByAuthor) => {
        const amount = await calculateZappedAmount(zapsByAuthor)
        setZappedAmount(amount)
      }, 300)

      sub?.on("event", async (zapEvent: NDKEvent) => {
        if (shouldHideEvent(zapEvent)) return
        const invoice = zapEvent.tagValue("bolt11")
        if (invoice) {
          const bolt11 = await import("bolt11")
          const decodedInvoice = bolt11.decode(invoice)
          if (decodedInvoice.complete && decodedInvoice.satoshis) {
            setZapsByAuthor((prev) => {
              const zappingUser = getZappingUser(zapEvent)
              const newMap = new Map(prev)
              const authorZaps = newMap.get(zappingUser) ?? []
              if (!authorZaps.some((e) => e.id === zapEvent.id)) {
                authorZaps.push(zapEvent)
              }
              newMap.set(zappingUser, authorZaps)
              zapsByEventCache.set(event.id, newMap)
              debouncedUpdateAmount(newMap)
              return newMap
            })
          }
        }
      })

      return () => {
        debouncedUpdateAmount.cancel()
        sub.stop()
      }
    } catch (error) {
      console.warn(error)
    }
  }, [])

  useEffect(() => {
    calculateZappedAmount(zapsByAuthor).then(setZappedAmount)
  }, [])

  const zapped = zapsByAuthor.has(myPubKey)

  if (!(profile?.lud16 || profile?.lud06)) {
    return null
  }

  return (
    <>
      {showZapModal && (
        <ZapModal
          onClose={() => setShowZapModal(false)}
          event={event}
          zapped={zapped}
          setZapped={() => {}}
        />
      )}
      <div
        title="Zap"
        className={`${
          zapped ? "cursor-pointer text-accent" : "cursor-pointer hover:text-accent"
        } flex flex-row items-center gap-1 transition duration-200 ease-in-out min-w-[50px] md:min-w-[80px]`}
        onClick={handleZapClick}
      >
        <Icon name={zapped ? "zap-solid" : "zap"} size={16} />
        <span>{formatAmount(zappedAmount)}</span>
      </div>
    </>
  )
}

export default FeedItemZap
