import {useState, useEffect} from "react"
import type {Manager} from "@/lib/cashu/core/index"
import type {Token} from "@cashu/cashu-ts"
import Modal from "@/shared/components/ui/Modal"
import {decode} from "light-bolt11-decoder"

interface SendDialogProps {
  isOpen: boolean
  onClose: () => void
  manager: Manager | null
  mintUrl: string
  onSuccess: () => void
  initialToken?: Token
  initialInvoice?: string
}

export default function SendDialog({
  isOpen,
  onClose,
  manager,
  mintUrl,
  onSuccess,
  initialToken,
  initialInvoice,
}: SendDialogProps) {
  const [sendMode, setSendMode] = useState<"select" | "ecash" | "lightning">("select")
  const [sendAmount, setSendAmount] = useState<number>(100)
  const [sendInvoice, setSendInvoice] = useState<string>("")
  const [invoiceAmount, setInvoiceAmount] = useState<number | null>(null)
  const [generatedToken, setGeneratedToken] = useState<string>("")
  const [qrCodeUrl, setQrCodeUrl] = useState<string>("")
  const [sending, setSending] = useState(false)

  // Handle initial token (from history)
  useEffect(() => {
    const loadInitialToken = async () => {
      if (!initialToken || !isOpen) return
      try {
        const {getEncodedToken} = await import("@cashu/cashu-ts")
        const encoded = getEncodedToken(initialToken)
        setGeneratedToken(encoded)
        setSendMode("ecash")
      } catch (error) {
        console.error("Failed to encode initial token:", error)
      }
    }
    loadInitialToken()
  }, [initialToken, isOpen])

  // Handle initial invoice (from QR scan)
  useEffect(() => {
    if (initialInvoice && isOpen) {
      setSendInvoice(initialInvoice)
      setSendMode("lightning")
    }
  }, [initialInvoice, isOpen])

  // Decode Lightning invoice to get amount
  useEffect(() => {
    if (!sendInvoice.trim()) {
      setInvoiceAmount(null)
      return
    }

    try {
      const decodedInvoice = decode(sendInvoice.trim())
      const amountSection = decodedInvoice.sections.find(
        (section) => section.name === "amount"
      )
      if (amountSection && "value" in amountSection) {
        // Convert millisatoshis to bits
        const bits = Math.floor(parseInt(amountSection.value) / 1000)
        setInvoiceAmount(bits)
      } else {
        setInvoiceAmount(null)
      }
    } catch (error) {
      console.warn("Failed to decode invoice:", error)
      setInvoiceAmount(null)
    }
  }, [sendInvoice])

  useEffect(() => {
    const generateQR = async () => {
      if (!generatedToken) {
        setQrCodeUrl("")
        return
      }
      try {
        const QRCode = await import("qrcode")
        const url = await new Promise<string>((resolve, reject) => {
          QRCode.toDataURL(
            generatedToken,
            {
              errorCorrectionLevel: "H",
              margin: 1,
              width: 256,
              color: {
                dark: "#000000",
                light: "#FFFFFF",
              },
            },
            (error, url) => {
              if (error) reject(error)
              else resolve(url)
            }
          )
        })
        setQrCodeUrl(url)
      } catch (error) {
        console.error("Error generating QR code:", error)
      }
    }
    generateQR()
  }, [generatedToken])

  const handleClose = () => {
    onClose()
    setSendMode("select")
    setSendAmount(100)
    setSendInvoice("")
    setGeneratedToken("")
    setQrCodeUrl("")
  }

  const sendEcash = async () => {
    if (!manager || !sendAmount) return
    setSending(true)
    try {
      const token = await manager.wallet.send(mintUrl, sendAmount)
      const {getEncodedToken} = await import("@cashu/cashu-ts")
      const encoded = getEncodedToken(token)
      setGeneratedToken(encoded)
      onSuccess()
    } catch (error) {
      console.error("Failed to create ecash token:", error)
      alert(
        "Failed to create token: " +
          (error instanceof Error ? error.message : "Unknown error")
      )
    } finally {
      setSending(false)
    }
  }

  const sendLightning = async () => {
    if (!manager || !sendInvoice.trim()) return
    setSending(true)
    try {
      // Create melt quote
      const quote = await manager.quotes.createMeltQuote(mintUrl, sendInvoice.trim())

      // Pay the quote
      await manager.quotes.payMeltQuote(mintUrl, quote.quote)

      setSendInvoice("")
      handleClose()
      onSuccess()
    } catch (error) {
      console.error("Failed to pay lightning invoice:", error)
      alert(
        "Failed to pay invoice: " +
          (error instanceof Error ? error.message : "Unknown error")
      )
    } finally {
      setSending(false)
    }
  }

  if (!isOpen) return null

  return (
    <Modal onClose={handleClose}>
      <div className="p-4">
        <h3 className="font-bold text-lg mb-4">Send</h3>

        {sendMode === "select" && (
          <div className="space-y-4">
            <button
              className="btn btn-outline w-full justify-start"
              onClick={() => setSendMode("ecash")}
            >
              <svg
                className="w-5 h-5 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              Ecash
            </button>

            <button
              className="btn btn-outline w-full justify-start"
              onClick={() => setSendMode("lightning")}
            >
              <svg
                className="w-5 h-5 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
              Lightning
            </button>
          </div>
        )}

        {sendMode === "ecash" && (
          <div className="space-y-4">
            {!generatedToken ? (
              <>
                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Amount (bits)</span>
                  </label>
                  <input
                    type="number"
                    className="input input-bordered"
                    placeholder="100"
                    value={sendAmount}
                    onChange={(e) => setSendAmount(Number(e.target.value))}
                  />
                </div>
                <button
                  className="btn btn-primary w-full"
                  onClick={sendEcash}
                  disabled={!sendAmount || sending}
                >
                  {sending ? "Creating..." : "Create Token"}
                </button>
              </>
            ) : (
              <div className="space-y-4">
                {qrCodeUrl && (
                  <div className="flex justify-center">
                    <div className="bg-white rounded-lg p-4">
                      <img
                        src={qrCodeUrl}
                        alt="Cashu Token QR Code"
                        className="w-64 h-64"
                      />
                    </div>
                  </div>
                )}
                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Cashu Token</span>
                  </label>
                  <textarea
                    className="textarea textarea-bordered h-32 font-mono text-xs resize-none"
                    value={generatedToken}
                    readOnly
                  />
                </div>
                <button
                  className="btn btn-primary w-full"
                  onClick={() => {
                    navigator.clipboard.writeText(generatedToken)
                  }}
                >
                  Copy Token
                </button>
                <button className="btn btn-ghost w-full" onClick={handleClose}>
                  Done
                </button>
              </div>
            )}
          </div>
        )}

        {sendMode === "lightning" && (
          <div className="space-y-4">
            <div className="form-control">
              <label className="label">
                <span className="label-text">Lightning Invoice</span>
              </label>
              <textarea
                className="textarea textarea-bordered h-24"
                placeholder="lnbc..."
                value={sendInvoice}
                onChange={(e) => setSendInvoice(e.target.value)}
              />
            </div>
            {invoiceAmount !== null && (
              <div className="alert alert-info">
                <div className="flex flex-col">
                  <span className="font-bold">Amount</span>
                  <span className="text-lg">{invoiceAmount.toLocaleString()} bits</span>
                </div>
              </div>
            )}
            <button
              className="btn btn-primary w-full"
              onClick={sendLightning}
              disabled={!sendInvoice.trim() || sending}
            >
              {sending ? "Paying..." : "Pay Invoice"}
            </button>
          </div>
        )}
      </div>
    </Modal>
  )
}
