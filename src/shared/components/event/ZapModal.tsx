import {
  ChangeEvent,
  Dispatch,
  FormEvent,
  SetStateAction,
  useEffect,
  useState,
} from "react"
import {LnPayCb, NDKEvent, zapInvoiceFromEvent, NDKUserProfile} from "@nostr-dev-kit/ndk"
import {RiCheckLine, RiFileCopyLine} from "@remixicon/react"

import {Avatar} from "@/shared/components/user/Avatar"
import Modal from "@/shared/components/ui/Modal.tsx"
import {Name} from "@/shared/components/user/Name"
import {useUserStore} from "@/stores/user"
import {useWalletProviderStore} from "@/stores/walletProvider"
import {ndk} from "@/utils/ndk"
import {getZapAmount} from "@/utils/nostr"
import {KIND_ZAP_RECEIPT} from "@/utils/constants"

interface ZapModalProps {
  onClose: () => void
  event: NDKEvent
  profile: NDKUserProfile | null
  setZapped: Dispatch<SetStateAction<boolean>>
  initialInvoice?: string
  initialAmount?: string
  paymentFailed?: boolean
}

function ZapModal({
  onClose,
  event,
  profile,
  setZapped,
  initialInvoice,
  initialAmount,
  paymentFailed,
}: ZapModalProps) {
  const {defaultZapAmount, setDefaultZapAmount, defaultZapComment, setDefaultZapComment} = useUserStore()
  const {activeProviderType, sendPayment: walletProviderSendPayment} =
    useWalletProviderStore()

  // Check if we have any wallet available
  const hasWallet = activeProviderType !== "disabled" && activeProviderType !== undefined
  const [copiedPaymentRequest, setCopiedPaymentRequest] = useState(false)
  const [noAddress, setNoAddress] = useState(false)
  const [showQRCode, setShowQRCode] = useState(!!initialInvoice)
  const [bolt11Invoice, setBolt11Invoice] = useState<string>(initialInvoice || "")
  const [zapAmount, setZapAmount] = useState<string>(
    initialAmount || (defaultZapAmount > 0 ? defaultZapAmount.toString() : "21")
  )
  const [customAmount, setCustomAmount] = useState<string>("")
  const [zapMessage, setZapMessage] = useState<string>(defaultZapComment || "")
  const [shouldSetDefault, setShouldSetDefault] = useState(false)
  const [shouldSetDefaultComment, setShouldSetDefaultComment] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string>("")
  const [qrCodeUrl, setQrCodeUrl] = useState<string>("")
  const [zapRefresh, setZapRefresh] = useState(false)
  const amounts: Record<string, string> = {
    ...(defaultZapAmount > 0 ? {[defaultZapAmount.toString()]: ""} : {}),
    "1": "⚡",
    "21": "👍",
    "42": "🤙",
    "69": "😏",
    "100": "💯",
    "1000": "🔥",
    "10000": "🚀",
    "100000": "🤯",
  }

  const handleZapAmountChange = (amount: string) => {
    setZapAmount(amount)
    setCustomAmount("")
  }

  const handleConfirmCustomAmount = () => {
    setZapAmount(customAmount)
  }

  const handleCustomAmountChange = (event: ChangeEvent<HTMLInputElement>) => {
    setCustomAmount(event.target.value)
  }

  const handleZapMessageChange = (event: ChangeEvent<HTMLInputElement>) => {
    setZapMessage(event.target.value)
  }

  const handleSetDefaultAmount = (e: ChangeEvent<HTMLInputElement>) => {
    setShouldSetDefault(e.target.checked)
  }

  const handleSetDefaultComment = (e: ChangeEvent<HTMLInputElement>) => {
    setShouldSetDefaultComment(e.target.checked)
  }

  const handleCopyPaymentRequest = () => {
    navigator.clipboard.writeText(bolt11Invoice)
    setCopiedPaymentRequest(true)
    setTimeout(() => {
      setCopiedPaymentRequest(false)
    }, 3000)
  }

  const handleZap = async () => {
    setNoAddress(false)
    setError("")
    setIsProcessing(true)
    try {
      if (Number(zapAmount) < 1) {
        setError("Zap amount must be greater than 0")
        setIsProcessing(false)
        return
      }
    } catch (error) {
      setError("Zap amount must be a valid number")
      console.warn("Zap amount must be a number: ", error)
      setIsProcessing(false)
      return
    }
    const amount = Number(zapAmount) * 1000

    try {
      if (shouldSetDefault) {
        setDefaultZapAmount(Number(zapAmount))
      }
      if (shouldSetDefaultComment && zapMessage.trim()) {
        setDefaultZapComment(zapMessage.trim())
      }

      const lnPay: LnPayCb = async ({pr}) => {
        // Always set the invoice for QR code display
        setBolt11Invoice(pr)
        setShowQRCode(true)

        if (hasWallet) {
          // Attempt wallet payment in background (fire-and-forget)
          setTimeout(() => {
            walletProviderSendPayment(pr)
              .then(() => {
                setZapped(true)
                setZapRefresh(!zapRefresh)
                onClose()
              })
              .catch((error: Error) => {
                console.warn("Wallet payment failed, user can use QR code:", error)
                setError("Wallet payment failed. Please use the QR code below.")
              })
          }, 100) // Small delay to let QR code render first
        }

        // Always return undefined to let NDK know we're handling payment via QR
        return undefined
      }

      // Check if we have a lightning address from the passed profile
      if (!profile?.lud16 && !profile?.lud06) {
        setNoAddress(true)
        setIsProcessing(false)
        return
      }

      // Create zap invoice manually
      const {createZapInvoice} = await import("@/utils/nostr")
      const ndkInstance = ndk()
      const signer = ndkInstance.signer
      if (!signer) {
        throw new Error("No signer available")
      }

      const invoice = await createZapInvoice(
        event,
        amount,
        zapMessage || "",
        profile.lud16!, // We already checked it exists above
        signer
      )

      // Call the lnPay callback with the invoice
      await lnPay({
        pr: invoice,
        target: event,
        recipientPubkey: event.pubkey,
        amount,
        unit: "msat",
      })
    } catch (error) {
      console.warn("Zap failed: ", error)
      if (error instanceof Error) {
        if (error.message.includes("No zap endpoint found")) {
          setNoAddress(true)
        } else {
          setError(error.message || "Failed to process zap. Please try again.")
        }
      }
    } finally {
      setIsProcessing(false)
    }
  }

  const fetchZapReceipt = () => {
    const filter = {
      kinds: [KIND_ZAP_RECEIPT],
      ["#e"]: [event.id],
    }
    try {
      const sub = ndk().subscribe(filter)

      sub?.on("event", async (zapEvent: NDKEvent) => {
        sub.stop()
        const receiptInvoice = zapEvent.tagValue("bolt11")
        if (receiptInvoice) {
          const amountPaid = await getZapAmount(zapEvent)
          const zapRequest = zapInvoiceFromEvent(zapEvent)
          const amountRequested = zapRequest?.amount ? zapRequest.amount / 1000 : -1

          if (bolt11Invoice === receiptInvoice && amountPaid === amountRequested) {
            setZapped(true)
            onClose()
          }
        }
      })
    } catch (error) {
      console.warn("Unable to fetch zap receipt", error)
    }
  }

  useEffect(() => {
    const timer = setInterval(() => {
      fetchZapReceipt()
    }, 2500)

    return () => {
      clearInterval(timer)
    }
  }, [showQRCode])

  useEffect(() => {
    if (showQRCode && bolt11Invoice) {
      const generateQRCode = async () => {
        try {
          const QRCode = await import("qrcode")
          QRCode.toDataURL(`lightning:${bolt11Invoice}`, function (error, url) {
            if (error) {
              setError("Failed to generate QR code")
              console.error("Error generating QR code:", error)
            } else {
              setQrCodeUrl(url)
            }
          })
        } catch (error) {
          setError("Failed to generate QR code")
          console.error("Error importing QRCode:", error)
        }
      }
      generateQRCode()
    }
  }, [showQRCode, bolt11Invoice])

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    handleZap()
  }

  return (
    <Modal onClose={onClose} hasBackground={true}>
      <div className="flex flex-col items-center justify-center p-4 gap-6">
        <div className="flex flex-col items-center gap-4">
          <div className="flex items-center gap-3">
            <Avatar pubKey={event.pubkey} width={40} showBadge={false} />
            <div className="flex flex-col">
              <span className="text-sm opacity-70">Send zap to</span>
              <Name pubKey={event.pubkey} className="font-semibold" />
            </div>
          </div>
          <h3 className="font-semibold uppercase">Zap amount in sats</h3>
        </div>

        <div className="grid grid-cols-4 gap-2 w-full">
          {Object.entries(amounts).map(([amount, emoji]) => (
            <button
              key={amount}
              type="button"
              onClick={() => handleZapAmountChange(amount)}
              className={`btn ${
                zapAmount === amount ? "btn-primary" : "btn-neutral"
              } w-full`}
            >
              {emoji} {parseInt(amount) >= 1000 ? `${parseInt(amount) / 1000}K` : amount}
            </button>
          ))}
        </div>

        {showQRCode ? (
          <div className="flex flex-col items-center gap-4">
            {hasWallet && !error && !paymentFailed && (
              <div className="alert alert-info">
                <div className="loading loading-spinner loading-sm"></div>
                <span>Attempting to pay with your wallet...</span>
              </div>
            )}
            {error && (
              <div className="alert alert-warning">
                <span>{error}</span>
              </div>
            )}
            <p className="text-center">
              {hasWallet ? "Or scan" : "Scan"} the QR code to zap <b>{zapAmount} sats</b>
              {zapMessage && (
                <>
                  <br />
                  <span className="text-sm opacity-70">"{zapMessage}"</span>
                </>
              )}
            </p>
            <div className="w-40 h-40">
              {qrCodeUrl && <img id="qr-image" className="w-40 h-40" src={qrCodeUrl} />}
            </div>
            <a href={`lightning:${bolt11Invoice}`} className="btn btn-primary w-full">
              Open in Wallet
            </a>
            <button
              className="btn btn-neutral gap-2 w-full"
              onClick={handleCopyPaymentRequest}
            >
              {!copiedPaymentRequest ? <RiFileCopyLine /> : <RiCheckLine />}
              Copy Lightning Invoice
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4 w-full">
            {noAddress && (
              <span className="text-red-500">The user has no lightning address.</span>
            )}
            {error && <span className="text-red-500">{error}</span>}

            <div className="flex gap-2">
              <input
                type="number"
                className="input input-bordered grow"
                value={customAmount}
                onChange={handleCustomAmountChange}
                placeholder="Custom amount"
              />
              <button
                type="button"
                className="btn btn-neutral"
                onClick={handleConfirmCustomAmount}
                disabled={
                  !customAmount || Number(customAmount) <= 0 || customAmount === zapAmount
                }
              >
                Confirm
              </button>
            </div>

            <input
              type="text"
              className="input input-bordered w-full"
              value={zapMessage}
              onChange={handleZapMessageChange}
              placeholder="Comment (optional)"
            />

            <label className="label cursor-pointer justify-start gap-2">
              <input
                type="checkbox"
                className="checkbox"
                checked={shouldSetDefault}
                onChange={handleSetDefaultAmount}
              />
              <span className="label-text">Set as default zap amount</span>
            </label>

            <label className="label cursor-pointer justify-start gap-2">
              <input
                type="checkbox"
                className="checkbox"
                checked={shouldSetDefaultComment}
                onChange={handleSetDefaultComment}
                disabled={!zapMessage.trim() || zapMessage.trim() === defaultZapComment}
              />
              <span className="label-text">Save comment as default</span>
            </label>

            <button
              type="submit"
              className="btn btn-primary w-full"
              disabled={isProcessing}
            >
              {isProcessing ? (
                <div className="loading loading-spinner loading-sm" />
              ) : (
                `Zap ${zapAmount} sats`
              )}
            </button>
          </form>
        )}
      </div>
    </Modal>
  )
}

export default ZapModal
