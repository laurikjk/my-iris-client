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
  const [defaultZapAmount] = useLocalState("user/defaultZapAmount", 21)
  const [copiedPaymentRequest, setCopiedPaymentRequest] = useState(false)
  const [noAddress, setNoAddress] = useState(false)
  const [showQRCode, setShowQRCode] = useState(false)
  const [bolt11Invoice, setBolt11Invoice] = useState<string>("")
  const [zapAmount, setZapAmount] = useState<string>("21000")
  const [zapMessage, setZapMessage] = useState<string>("")

  const [isWalletConnect] = useLocalState("user/walletConnect", false)

  const [zapRefresh, setZapRefresh] = useState(false)

  const handleZapAmountChange = (event: ChangeEvent<HTMLInputElement>) => {
    setZapAmount(event.target.value)
  }

  const handleZapMessageChange = (event: ChangeEvent<HTMLInputElement>) => {
    setZapMessage(event.target.value)
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
    try {
      if (Number(zapAmount) < 1) return
    } catch (error) {
      console.warn("Zap amount must be a number: ", error)
    }
    try {
      const amount = Number(zapAmount) * 1000

      const lnPay: LnPayCb = async ({pr}) => {
        if (isWalletConnect) {
          const {requestProvider} = await import("@getalby/bitcoin-connect-react")
          const provider = await requestProvider()
          await provider.sendPayment(pr)
          setZapped(true)
          setZapRefresh(!zapRefresh)
          onClose()
          return provider.sendPayment(pr)
        } else {
          // no Nostr wallet connect set
          setBolt11Invoice(pr)
          const img = document.getElementById("qr-image") as HTMLImageElement

          const QRCode = await import("qrcode")
          QRCode.toDataURL(`lightning:${pr}`, function (error, url) {
            if (error) console.error("Error generating QR code:", error)
            else img.src = url
          })
          setShowQRCode(true)
          return undefined
        }
      }

      const zapper = new NDKZapper(event, amount, "msat", {
        comment: "",
        ndk: ndk(),
        lnPay,
        tags: [["e", event.id]],
      })

      zapper.zap()
    } catch (error) {
      console.warn("Zap failed: ", error)
      if (error instanceof Error && error.message.includes("No zap endpoint found")) {
        setNoAddress(true)
      }
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
              <h3>Choose the amount to zap</h3>
              {noAddress && (
                <span className="text-red-500">The user has no lightning address.</span>
              )}
              <div className="flex flex-col gap-2">
                <label>Amount (sats)</label>
                <input
                  type="text"
                  className="input input-bordered w-full"
                  value={zapAmount}
                  onChange={handleZapAmountChange}
                  placeholder="21000"
                />
                <input
                  type="text"
                  className="input input-bordered w-full"
                  value={zapMessage}
                  onChange={handleZapMessageChange}
                  placeholder="message (optional)"
                />
              </div>
              <button type="submit" className="btn btn-primary">
                Zap
              </button>
            </form>
          )}
        </div>
      </div>
    </Modal>
  )
}

export default ZapModal
