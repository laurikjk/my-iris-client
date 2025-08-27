import {NDKEvent} from "@nostr-dev-kit/ndk"
import {useWalletProviderStore} from "@/stores/walletProvider"
import {useOnlineStatus} from "@/shared/hooks/useOnlineStatus"
import {RefObject, useEffect, useState} from "react"
import useProfile from "@/shared/hooks/useProfile.ts"
import {parseZapReceipt, calculateTotalZapAmount, type ZapInfo} from "@/utils/nostr.ts"
import {LRUCache} from "typescript-lru-cache"
import {formatAmount} from "@/utils/utils.ts"
import {usePublicKey, useUserStore} from "@/stores/user"
import {useScrollAwareLongPress} from "@/shared/hooks/useScrollAwareLongPress"
import Icon from "../../Icons/Icon.tsx"
import ZapModal from "../ZapModal.tsx"
import debounce from "lodash/debounce"
import {ndk} from "@/utils/ndk"
import {KIND_ZAP_RECEIPT} from "@/utils/constants"

const zapsByEventCache = new LRUCache<string, Map<string, ZapInfo[]>>({
  maxSize: 100,
})

interface FeedItemZapProps {
  event: NDKEvent
  feedItemRef: RefObject<HTMLDivElement | null>
  showReactionCounts?: boolean
}

function FeedItemZap({event, feedItemRef, showReactionCounts = true}: FeedItemZapProps) {
  const myPubKey = usePublicKey()
  const {defaultZapAmount} = useUserStore()
  const {activeProviderType, sendPayment: walletProviderSendPayment} =
    useWalletProviderStore()
  const [isZapping, setIsZapping] = useState(false)
  const {
    handleMouseDown: handleLongPressDown,
    handleMouseMove: handleLongPressMove,
    handleMouseUp: handleLongPressUp,
    isLongPress,
  } = useScrollAwareLongPress({
    onLongPress: () => setShowZapModal(true),
  })

  const profile = useProfile(event.pubkey)

  const [showZapModal, setShowZapModal] = useState(false)
  const [failedInvoice, setFailedInvoice] = useState<string>("")

  const [zapsByAuthor, setZapsByAuthor] = useState<Map<string, ZapInfo[]>>(
    zapsByEventCache.get(event.id) || new Map()
  )

  // Quick zap is only enabled if there's a default zap amount AND a wallet is available
  const hasWallet = activeProviderType !== "disabled" && activeProviderType !== undefined
  const canQuickZap = !!defaultZapAmount && defaultZapAmount > 0 && hasWallet

  const calculateZappedAmount = async (zaps: Map<string, ZapInfo[]>): Promise<number> => {
    const total = calculateTotalZapAmount(zaps)
    return total
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
    if (canQuickZap) {
      await handleOneClickZap()
    } else {
      // Clear any previous failed state when opening modal normally
      setFailedInvoice("")
      setShowZapModal(true)
    }
  }

  const handleOneClickZap = async () => {
    console.log("Quick zap: starting one-click zap", {
      defaultZapAmount,
      hasWallet,
      activeProviderType,
      canQuickZap,
    })
    try {
      setIsZapping(true)
      // Don't flash until payment succeeds
      const amount = Number(defaultZapAmount) * 1000
      console.log("Quick zap: amount in msats", amount)

      // Check if profile has lightning address
      if (!profile?.lud16 && !profile?.lud06) {
        console.warn("Quick zap: No lightning address found")
        setShowZapModal(true)
        return
      }

      const ndkInstance = ndk()
      const signer = ndkInstance.signer
      if (!signer) {
        console.warn("Quick zap: No signer available")
        setShowZapModal(true)
        return
      }

      console.log("Quick zap: creating and publishing zap request")

      // Use the shared function that publishes the zap request
      const {createAndPublishZapInvoice} = await import("@/utils/nostr")
      const invoice = await createAndPublishZapInvoice(
        event,
        amount,
        "", // No comment for quick zap
        profile.lud16 || profile.lud06!,
        signer
      )

      console.log("Quick zap: invoice created", invoice.substring(0, 50) + "...")

      // Try to pay with wallet
      try {
        await walletProviderSendPayment(invoice)
        console.log("Quick zap: payment succeeded")
        // Flash the element on success
        flashElement()
      } catch (error) {
        console.warn("Quick zap payment failed:", error)
        // Store the failed invoice for the modal
        setFailedInvoice(invoice)
        setShowZapModal(true)
      }
    } catch (error) {
      console.warn("Unable to one-click zap:", error)
      // Open zap modal on zap failure
      setFailedInvoice("")
      setShowZapModal(true)
    } finally {
      setIsZapping(false)
    }
  }

  const handleClick = () => {
    if (!isLongPress) {
      handleZapClick()
    }
  }

  useEffect(() => {
    if (!showReactionCounts) return

    const filter = {
      kinds: [KIND_ZAP_RECEIPT],
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
        const zapInfo = parseZapReceipt(zapEvent)
        if (zapInfo) {
          setZapsByAuthor((prev) => {
            const newMap = new Map(prev)
            const authorZaps = newMap.get(zapInfo.pubkey) ?? []
            if (!authorZaps.some((e) => e.id === zapEvent.id)) {
              console.log("Adding zap:", {
                eventId: zapEvent.id,
                user:
                  zapInfo.pubkey === myPubKey ? "you" : zapInfo.pubkey.substring(0, 8),
                amount: zapInfo.amount,
                totalZapsFromUser: authorZaps.length + 1,
              })
              authorZaps.push(zapInfo)
            } else {
              console.log("Duplicate zap event ignored:", zapEvent.id)
            }
            newMap.set(zapInfo.pubkey, authorZaps)
            zapsByEventCache.set(event.id, newMap)
            debouncedUpdateAmount(newMap)
            return newMap
          })
        }
      })

      return () => {
        debouncedUpdateAmount.cancel()
        sub.stop()
      }
    } catch (error) {
      console.warn(error)
    }
  }, [showReactionCounts])

  useEffect(() => {
    calculateZappedAmount(zapsByAuthor).then((amount) => {
      console.log("Initial zap amount calculation:", amount)
      setZappedAmount(amount)
    })
  }, [zapsByAuthor])

  const zapped = zapsByAuthor.has(myPubKey)

  const isOnline = useOnlineStatus()

  if (!(profile?.lud16 || profile?.lud06) || !isOnline) {
    return null
  }

  let iconName = ""
  if (canQuickZap) {
    iconName = "zapFast"
  } else if (zapped) {
    iconName = "zap-solid"
  } else {
    iconName = "zap"
  }

  return (
    <>
      {showZapModal && (
        <ZapModal
          onClose={() => {
            setShowZapModal(false)
            setFailedInvoice("")
          }}
          event={event}
          profile={profile}
          setZapped={() => {
            flashElement()
          }}
          initialInvoice={failedInvoice}
          initialAmount={failedInvoice ? defaultZapAmount.toString() : undefined}
          paymentFailed={!!failedInvoice}
        />
      )}
      <button
        title="Zap"
        className={`${
          zapped ? "cursor-pointer text-accent" : "cursor-pointer hover:text-accent"
        } flex flex-row items-center gap-1 transition duration-200 ease-in-out min-w-[50px] md:min-w-[80px]`}
        onClick={handleClick}
        onMouseDown={handleLongPressDown}
        onMouseMove={handleLongPressMove}
        onMouseUp={handleLongPressUp}
        onMouseLeave={handleLongPressUp}
        onTouchStart={handleLongPressDown}
        onTouchMove={handleLongPressMove}
        onTouchEnd={handleLongPressUp}
      >
        {isZapping ? (
          <div className="loading loading-spinner loading-xs" />
        ) : (
          <Icon name={iconName} size={16} />
        )}
        <span>{showReactionCounts ? formatAmount(zappedAmount) : ""}</span>
      </button>
    </>
  )
}

export default FeedItemZap
