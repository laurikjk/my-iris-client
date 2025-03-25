import {
  ChangeEvent,
  Dispatch,
  SetStateAction,
  useEffect,
  useState,
  FormEvent,
} from "react"
import {LnPayCb, NDKEvent, zapInvoiceFromEvent, NDKZapper} from "@nostr-dev-kit/ndk"
import {RiCheckLine, RiFileCopyLine} from "@remixicon/react"
import {decode} from "light-bolt11-decoder"

import {useLocalState} from "irisdb-hooks/src/useLocalState"
import Modal from "@/shared/components/ui/Modal.tsx"
import {ndk} from "@/utils/ndk"

interface ZapModalProps {
  onClose: () => void
  event: NDKEvent
  setZapped: Dispatch<SetStateAction<boolean>>
}

function ZapModal({onClose, event, setZapped}: ZapModalProps) {
  const [defaultZapAmount, setDefaultZapAmount] = useLocalState(
    "user/defaultZapAmount",
    21
  )
  const [copiedPaymentRequest, setCopiedPaymentRequest] = useState(false)
  const [noAddress, setNoAddress] = useState(false)
  const [showQRCode, setShowQRCode] = useState(false)
  const [bolt11Invoice, setBolt11Invoice] = useState<string>("")
  const [zapAmount, setZapAmount] = useState<string>("21000")
  const [zapMessage, setZapMessage] = useState<string>("")
  const [shouldSetDefault, setShouldSetDefault] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string>("")

  const [isWalletConnect] = useLocalState("user/walletConnect", false)

  const [zapRefresh, setZapRefresh] = useState(false)

  const handleZapAmountChange = (event: ChangeEvent<HTMLInputElement>) => {
    setZapAmount(event.target.value)
  }

  const handleZapMessageChange = (event: ChangeEvent<HTMLInputElement>) => {
    setZapMessage(event.target.value)
  }

  const handleSetDefaultAmount = (e: ChangeEvent<HTMLInputElement>) => {
    setShouldSetDefault(e.target.checked)
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
        return
      }
    } catch (error) {
      setError("Zap amount must be a valid number")
      console.warn("Zap amount must be a number: ", error)
    }
    try {
      const amount = Number(zapAmount) * 1000

      if (shouldSetDefault) {
        setDefaultZapAmount(Number(zapAmount))
      }

      const lnPay: LnPayCb = async ({pr}) => {
        if (isWalletConnect) {
          try {
            const {requestProvider} = await import("@getalby/bitcoin-connect-react")
            const provider = await requestProvider()
            await provider.sendPayment(pr)
            setZapped(true)
            setZapRefresh(!zapRefresh)
            onClose()
            return provider.sendPayment(pr)
          } catch (error) {
            setError("Failed to connect to wallet. Please try again.")
            throw error
          }
        } else {
          // no Nostr wallet connect set
          setBolt11Invoice(pr)
          const img = document.getElementById("qr-image") as HTMLImageElement

          try {
            const QRCode = await import("qrcode")
            QRCode.toDataURL(`lightning:${pr}`, function (error, url) {
              if (error) {
                setError("Failed to generate QR code")
                console.error("Error generating QR code:", error)
              } else img.src = url
            })
            setShowQRCode(true)
            return undefined
          } catch (error) {
            setError("Failed to generate QR code")
            throw error
          }
        }
      }

      const zapper = new NDKZapper(event, amount, "msat", {
        comment: "",
        ndk: ndk(),
        lnPay,
        tags: [["e", event.id]],
      })

      await zapper.zap()
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
      kinds: [9735],
      ["#e"]: [event.id],
    }
    try {
      const sub = ndk().subscribe(filter)

      sub?.on("event", async (event: NDKEvent) => {
        sub.stop()
        const receiptInvoice = event.tagValue("bolt11")
        if (receiptInvoice) {
          const decodedInvoice = decode(receiptInvoice)
          const zapRequest = zapInvoiceFromEvent(event)

          const amountSection = decodedInvoice.sections.find(
            (section) => section.name === "amount"
          )
          const amountPaid =
            amountSection && "value" in amountSection
              ? Math.floor(parseInt(amountSection.value) / 1000)
              : 0
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

  // wait for defaultZapAmount to populate
  useEffect(() => {
    if (defaultZapAmount) setZapAmount(String(defaultZapAmount))
  }, [defaultZapAmount])

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    handleZap()
  }

  return (
    <Modal onClose={onClose} hasBackground={true}>
      <div className="flex flex-col items-center justify-center p-4">
        <div className="flex flex-col items-center gap-4">
          {showQRCode && (
            <p>
              Scan the QR code to zap <b>{zapAmount} sats</b>.
            </p>
          )}
          <img id="qr-image" className={showQRCode ? "w-40 h-40" : ""} />
          {showQRCode && (
            <>
              <a href={`lightning:${bolt11Invoice}`} className="btn btn-primary">
                Open in Wallet
              </a>
              <button
                className="btn btn-neutral gap-2"
                onClick={handleCopyPaymentRequest}
              >
                {!copiedPaymentRequest && <RiFileCopyLine />}
                {copiedPaymentRequest && <RiCheckLine />}
                Copy zap invoice
              </button>
            </>
          )}
          {!showQRCode && (
            <form onSubmit={handleSubmit} className="flex flex-col items-center gap-4">
              {noAddress && (
                <div className="alert alert-error">
                  <span>The user has no lightning address.</span>
                </div>
              )}
              {error && (
                <div className="alert alert-error">
                  <span>{error}</span>
                </div>
              )}
              <div className="flex flex-col gap-2">
                <label>Amount (sats)</label>
                <input
                  type="text"
                  className="input input-bordered w-full"
                  value={zapAmount}
                  onChange={handleZapAmountChange}
                  placeholder="amount"
                />
                <input
                  type="text"
                  className="input input-bordered w-full"
                  value={zapMessage}
                  onChange={handleZapMessageChange}
                  placeholder="message (optional)"
                />
                <label className="label cursor-pointer gap-2">
                  <span className="label-text">Set as default zap amount</span>
                  <input
                    type="checkbox"
                    className="checkbox"
                    checked={shouldSetDefault}
                    onChange={handleSetDefaultAmount}
                  />
                </label>
              </div>
              <button type="submit" className="btn btn-primary" disabled={isProcessing}>
                {isProcessing ? (
                  <div className="loading loading-spinner loading-sm" />
                ) : (
                  "Zap"
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </Modal>
  )
}

export default ZapModal
