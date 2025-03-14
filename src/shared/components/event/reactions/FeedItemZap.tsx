import {LnPayCb, NDKEvent, NDKZapper} from "@nostr-dev-kit/ndk"
import {useOnlineStatus} from "@/shared/hooks/useOnlineStatus"
import {useLocalState} from "irisdb-hooks/src/useLocalState"
import {RefObject, useEffect, useState, useRef} from "react"
import useProfile from "@/shared/hooks/useProfile.ts"
import {getZappingUser} from "@/utils/nostr.ts"
import {LRUCache} from "typescript-lru-cache"
import {formatAmount} from "@/utils/utils.ts"
import {decode} from "light-bolt11-decoder"
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
  feedItemRef: RefObject<HTMLDivElement | null>
}

// TODO fix useLocalState so initial state is properly set from memory, so we can use it instead of this
let myPubKey = ""
localState.get("user/publicKey").on((k) => (myPubKey = k as string))

function FeedItemZap({event, feedItemRef}: FeedItemZapProps) {
  const [isWalletConnect] = useLocalState("user/walletConnect", false)
  const [defaultZapAmount] = useLocalState("user/defaultZapAmount", undefined)
  const [isZapping, setIsZapping] = useState(false)
  const longPressTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const [isLongPress, setIsLongPress] = useState(false)

  const profile = useProfile(event.pubkey)

  const [showZapModal, setShowZapModal] = useState(false)

  const [zapsByAuthor, setZapsByAuthor] = useState<Map<string, NDKEvent[]>>(
    zapsByEventCache.get(event.id) || new Map()
  )

  const calculateZappedAmount = async (
    zaps: Map<string, NDKEvent[]>
  ): Promise<number> => {
    return Array.from(zaps.values())
      .flat()
      .reduce((sum, zap) => {
        const invoice = zap.tagValue("bolt11")
        if (invoice) {
          const decodedInvoice = decode(invoice)
          const amountSection = decodedInvoice.sections.find(
            (section) => section.name === "amount"
          )
          if (amountSection && "value" in amountSection) {
            return sum + Math.floor(parseInt(amountSection.value) / 1000)
          }
        }
        return sum
      }, 0)
  }

  const [zappedAmount, setZappedAmount] = useState<number>(0)

  const flashElement = () => {
    if (feedItemRef.current) {
      // Quick flash in
      feedItemRef.current.style.transition = "background-color 0.05s ease-in"
      feedItemRef.current.style.backgroundColor = "rgba(234, 88, 12, 0.3)" // slightly more intense orange
      setTimeout(() => {
        if (feedItemRef.current) {
          // Slower fade out
          feedItemRef.current.style.transition = "background-color 1.5s ease-out"
          feedItemRef.current.style.backgroundColor = ""
        }
      }, 800) // Let it linger a bit longer
    }
  }

  const handleZapClick = async () => {
    if (isWalletConnect && !!defaultZapAmount) {
      await handleOneClickZap()
    } else {
      setShowZapModal(true)
    }
  }

  const handleOneClickZap = async () => {
    try {
      setIsZapping(true)
      flashElement()
      const amount = Number(defaultZapAmount) * 1000

      const lnPay: LnPayCb = async ({pr}) => {
        if (isWalletConnect) {
          const {requestProvider} = await import("@getalby/bitcoin-connect")
          const provider = await requestProvider()
          const confirmation = await provider.sendPayment(pr)
          setShowZapModal(false)
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
    } finally {
      setIsZapping(false)
    }
  }

  const handleMouseDown = () => {
    setIsLongPress(false)
    longPressTimeout.current = setTimeout(() => {
      setIsLongPress(true)
      setShowZapModal(true)
    }, 500)
  }

  const handleMouseUp = () => {
    if (longPressTimeout.current) {
      clearTimeout(longPressTimeout.current)
    }
  }

  const handleClick = () => {
    if (!isLongPress) {
      handleZapClick()
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
        // if (shouldHideEvent(zapEvent)) return // blah. disabling this check enables fake receipts but what can we do
        const invoice = zapEvent.tagValue("bolt11")
        if (invoice) {
          const decodedInvoice = decode(invoice)
          const amountSection = decodedInvoice.sections.find(
            (section) => section.name === "amount"
          )
          if (amountSection && "value" in amountSection) {
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

  const isOnline = useOnlineStatus()

  if (!(profile?.lud16 || profile?.lud06) || !isOnline) {
    return null
  }

  return (
    <>
      {showZapModal && (
        <ZapModal
          onClose={() => setShowZapModal(false)}
          event={event}
          setZapped={() => {
            flashElement()
          }}
        />
      )}
      <div
        title="Zap"
        className={`${
          zapped ? "cursor-pointer text-accent" : "cursor-pointer hover:text-accent"
        } flex flex-row items-center gap-1 transition duration-200 ease-in-out min-w-[50px] md:min-w-[80px]`}
        onClick={handleClick}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleMouseDown}
        onTouchEnd={handleMouseUp}
      >
        {isZapping ? (
          <div className="loading loading-spinner loading-xs" />
        ) : (
          <Icon name={zapped ? "zap-solid" : "zap"} size={16} />
        )}
        <span>{formatAmount(zappedAmount)}</span>
      </div>
    </>
  )
}

export default FeedItemZap
