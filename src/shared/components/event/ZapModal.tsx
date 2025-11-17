import {
  ChangeEvent,
  Dispatch,
  FormEvent,
  SetStateAction,
  useEffect,
  useState,
} from "react"
import {LnPayCb, NDKEvent, zapInvoiceFromEvent, NDKUserProfile} from "@/lib/ndk"
import {RiCheckLine, RiFileCopyLine} from "@remixicon/react"

import {Avatar} from "@/shared/components/user/Avatar"
import Modal from "@/shared/components/ui/Modal.tsx"
import {Name} from "@/shared/components/user/Name"
import {DonationCheckbox} from "./DonationCheckbox"
import {useDonationCalculation} from "./hooks/useDonationCalculation"
import {useUserStore} from "@/stores/user"
import {useWalletProviderStore} from "@/stores/walletProvider"
import {savePaymentMetadata} from "@/stores/paymentMetadata"
import {ndk} from "@/utils/ndk"
import {getZapAmount} from "@/utils/nostr"
import {KIND_ZAP_RECEIPT, DEBUG_NAMESPACES} from "@/utils/constants"
import {createDebugLogger} from "@/utils/createDebugLogger"

const {log, warn, error} = createDebugLogger(DEBUG_NAMESPACES.UTILS)

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
  const {
    defaultZapAmount,
    setDefaultZapAmount,
    defaultZapComment,
    setDefaultZapComment,
    zapDonationEnabled,
    setZapDonationEnabled,
    zapDonationRecipients,
    zapDonationMinAmount,
  } = useUserStore()
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
  const [errorMessage, setErrorMessage] = useState<string>("")
  const [qrCodeUrl, setQrCodeUrl] = useState<string>("")
  const [zapRefresh, setZapRefresh] = useState(false)

  // Calculate donation details
  const {donationPubkeys, totalDonationAmount, recipientNames, effectiveDonationAmount} =
    useDonationCalculation(
      zapDonationEnabled,
      zapDonationRecipients,
      zapDonationMinAmount,
      zapAmount
    )
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
    setErrorMessage("")
    setIsProcessing(true)
    try {
      if (Number(zapAmount) < 1) {
        setErrorMessage("Zap amount must be greater than 0")
        setIsProcessing(false)
        return
      }
    } catch (err) {
      setErrorMessage("Zap amount must be a valid number")
      warn("Zap amount must be a number: ", err)
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
        log("🎯 lnPay callback called, invoice:", pr.slice(0, 30) + "...")
        log("💳 hasWallet:", hasWallet, "activeProviderType:", activeProviderType)

        // Always set the invoice for QR code display
        setBolt11Invoice(pr)
        setShowQRCode(true)

        if (hasWallet) {
          // Save zap metadata
          log("💾 Saving zap metadata for invoice:", pr.slice(0, 30) + "...")
          try {
            await savePaymentMetadata(pr, "zap", event.pubkey, event.id)
            log("✅ Zap metadata saved successfully")
          } catch (err) {
            error("❌ Failed to save zap metadata:", err)
          }

          // Optimistic update: immediately close modal and show zapped state
          setZapped(true)
          setZapRefresh(!zapRefresh)
          onClose()

          // Attempt wallet payment in background
          setTimeout(() => {
            log("💸 Starting wallet payment...")
            walletProviderSendPayment(pr)
              .then(async () => {
                log("✅ Payment succeeded")

                // Send donation zaps if enabled
                if (zapDonationEnabled && zapDonationRecipients.length > 0) {
                  log("💝 Sending donation zaps...")
                  try {
                    const {calculateMultiRecipientDonations, sendDonationZaps} =
                      await import("@/utils/nostr")
                    const donations = calculateMultiRecipientDonations(
                      Number(zapAmount),
                      zapDonationRecipients,
                      zapDonationMinAmount
                    )

                    const ndkInstance = ndk()
                    const signer = ndkInstance.signer
                    if (signer) {
                      await sendDonationZaps(
                        donations,
                        signer,
                        event,
                        walletProviderSendPayment
                      )
                      log("✅ Donation zaps sent")
                    }
                  } catch (donationError) {
                    warn("Donation zaps failed (non-fatal):", donationError)
                  }
                }
              })
              .catch(async (caughtError: Error) => {
                warn("Wallet payment failed:", caughtError)
                // Revert optimistic update
                setZapped(false)
                setZapRefresh(!zapRefresh)
                // Show error toast with link to event
                const {useToastStore} = await import("@/stores/toast")
                const {nip19} = await import("nostr-tools")
                const errorMsg =
                  caughtError instanceof Error ? caughtError.message : "Payment failed"
                const noteId = nip19.noteEncode(event.id)
                const recipientName =
                  profile?.name || profile?.displayName || event.pubkey.slice(0, 8)
                const message = `Zap to ${recipientName} (${Number(zapAmount)} bits) failed. ${errorMsg}`
                useToastStore.getState().addToast(message, "error", 10000, `/${noteId}`)
              })
          }, 100)
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
    } catch (err) {
      warn("Zap failed: ", err)
      if (err instanceof Error) {
        if (err.message.includes("No zap endpoint found")) {
          setNoAddress(true)
        } else {
          setErrorMessage(err.message || "Failed to process zap. Please try again.")
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
      warn("Unable to fetch zap receipt", error)
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
          QRCode.toDataURL(`lightning:${bolt11Invoice}`, function (err, url) {
            if (err) {
              setErrorMessage("Failed to generate QR code")
              error("Error generating QR code:", err)
            } else {
              setQrCodeUrl(url)
            }
          })
        } catch (err) {
          setErrorMessage("Failed to generate QR code")
          error("Error importing QRCode:", err)
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
          <h3 className="font-semibold uppercase">Zap amount in bits</h3>
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
            {errorMessage && (
              <div className="alert alert-warning">
                <span>{errorMessage}</span>
              </div>
            )}
            <p className="text-center">
              {hasWallet ? "Or scan" : "Scan"} the QR code to zap <b>{zapAmount} bits</b>
              {zapMessage && (
                <>
                  <br />
                  <span className="text-sm opacity-70">&ldquo;{zapMessage}&rdquo;</span>
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
            {errorMessage && <span className="text-red-500">{errorMessage}</span>}

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

            <DonationCheckbox
              zapDonationEnabled={zapDonationEnabled}
              setZapDonationEnabled={setZapDonationEnabled}
              zapDonationRecipients={zapDonationRecipients}
              donationPubkeys={donationPubkeys}
              recipientNames={recipientNames}
              totalDonationAmount={totalDonationAmount}
            />

            <button
              type="submit"
              className="btn btn-primary w-full"
              disabled={isProcessing}
            >
              {(() => {
                if (isProcessing) {
                  return <div className="loading loading-spinner loading-sm" />
                }
                if (zapDonationEnabled && effectiveDonationAmount > 0) {
                  return `Zap ${Number(zapAmount) + effectiveDonationAmount} bits`
                }
                return `Zap ${zapAmount} bits`
              })()}
            </button>
          </form>
        )}
      </div>
    </Modal>
  )
}

export default ZapModal
