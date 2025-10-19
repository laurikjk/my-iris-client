import {useState, useEffect} from "react"
import type {Manager} from "@/lib/cashu/core/index"
import type {Token} from "@cashu/cashu-ts"
import Modal from "@/shared/components/ui/Modal"
import {decode} from "light-bolt11-decoder"
import {savePaymentMetadata} from "@/stores/paymentMetadata"
import {getLNURLInvoice} from "@/utils/zapUtils"
import {RiFileCopyLine, RiShare2Line} from "@remixicon/react"

interface SendDialogProps {
  isOpen: boolean
  onClose: () => void
  manager: Manager | null
  mintUrl: string
  onSuccess: () => void
  initialToken?: Token
  initialInvoice?: string
  balance?: number
}

export default function SendDialog({
  isOpen,
  onClose,
  manager,
  mintUrl,
  onSuccess,
  initialToken,
  initialInvoice,
  balance,
}: SendDialogProps) {
  const [sendMode, setSendMode] = useState<"select" | "ecash" | "lightning">("select")
  const [sendAmount, setSendAmount] = useState<number>(0)
  const [sendInvoice, setSendInvoice] = useState<string>("")
  const [invoiceAmount, setInvoiceAmount] = useState<number | null>(null)
  const [invoiceDescription, setInvoiceDescription] = useState<string>("")
  const [generatedToken, setGeneratedToken] = useState<string>("")
  const [qrCodeUrl, setQrCodeUrl] = useState<string>("")
  const [sending, setSending] = useState(false)
  const [isLightningAddress, setIsLightningAddress] = useState(false)
  const [lnurlComment, setLnurlComment] = useState<string>("")
  const [error, setError] = useState<string>("")

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

  // Detect lightning address and decode invoice amount and description
  useEffect(() => {
    if (!sendInvoice.trim()) {
      setInvoiceAmount(null)
      setInvoiceDescription("")
      setIsLightningAddress(false)
      return
    }

    const trimmed = sendInvoice.trim()

    // Check if it's a lightning address or LNURL
    if (
      (trimmed.includes("@") && !trimmed.toLowerCase().startsWith("lnbc")) ||
      trimmed.toLowerCase().startsWith("lnurl")
    ) {
      setIsLightningAddress(true)
      setInvoiceAmount(null)
      setInvoiceDescription("")
      return
    }

    setIsLightningAddress(false)

    try {
      const decodedInvoice = decode(trimmed)
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

      // Extract description
      const descSection = decodedInvoice.sections.find(
        (section) => section.name === "description"
      )
      if (descSection && "value" in descSection) {
        setInvoiceDescription(descSection.value as string)
      } else {
        setInvoiceDescription("")
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
    setSendAmount(0)
    setSendInvoice("")
    setGeneratedToken("")
    setQrCodeUrl("")
    setIsLightningAddress(false)
    setLnurlComment("")
    setError("")
  }

  const sendEcash = async () => {
    if (!manager) return

    if (!sendAmount || sendAmount <= 0) {
      setError("Please enter a valid amount")
      return
    }

    // Validate balance
    if (balance !== undefined && sendAmount > balance) {
      setError(`Insufficient balance. You have ${balance} bit`)
      return
    }

    setSending(true)
    setError("")
    try {
      const token = await manager.wallet.send(mintUrl, sendAmount)
      const {getEncodedToken} = await import("@cashu/cashu-ts")
      const encoded = getEncodedToken(token)
      setGeneratedToken(encoded)
      onSuccess()
    } catch (error) {
      console.error("Failed to create ecash token:", error)
      setError(
        "Failed to create token: " +
          (error instanceof Error ? error.message : "Unknown error")
      )
    } finally {
      setSending(false)
    }
  }

  const sendLightning = async () => {
    if (!manager || !sendInvoice.trim()) return

    if (isLightningAddress && (!sendAmount || sendAmount <= 0)) {
      setError("Please enter a valid amount")
      return
    }

    // Validate balance for lightning address payments
    if (isLightningAddress && balance !== undefined && sendAmount > balance) {
      setError(`Insufficient balance. You have ${balance} bit`)
      return
    }

    // Validate balance for invoice payments
    if (
      !isLightningAddress &&
      invoiceAmount &&
      balance !== undefined &&
      invoiceAmount > balance
    ) {
      setError(`Insufficient balance. You have ${balance} bit`)
      return
    }

    setSending(true)
    setError("")
    try {
      let invoice = sendInvoice.trim()

      // If it's a lightning address, fetch invoice with comment
      if (isLightningAddress) {
        const originalDestination = invoice
        invoice = await getLNURLInvoice(invoice, sendAmount, lnurlComment || undefined)

        // Save metadata with custom comment and destination for LNURL payments
        try {
          await savePaymentMetadata(
            invoice,
            "other",
            undefined,
            undefined,
            lnurlComment || undefined,
            originalDestination
          )
        } catch (err) {
          console.warn("Failed to save payment metadata:", err)
        }
      } else {
        // Save payment metadata (description auto-extracted from invoice)
        try {
          await savePaymentMetadata(invoice, "other")
        } catch (err) {
          console.warn("Failed to save payment metadata:", err)
        }
      }

      // Create melt quote
      const quote = await manager.quotes.createMeltQuote(mintUrl, invoice)

      // Pay the quote
      await manager.quotes.payMeltQuote(mintUrl, quote.quote)

      setSendInvoice("")
      setLnurlComment("")
      onSuccess()
      handleClose()
    } catch (error) {
      console.error("Failed to pay lightning invoice:", error)
      setError(
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
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold text-lg">Send</h3>
          {balance !== undefined && (
            <div className="text-sm opacity-70">Balance: {balance} bit</div>
          )}
        </div>

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
            {error && (
              <div className="alert alert-error">
                <span>{error}</span>
              </div>
            )}
            {!generatedToken ? (
              <>
                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Amount (bits)</span>
                  </label>
                  <input
                    type="number"
                    className={`input input-bordered ${
                      sendAmount > 0 && balance !== undefined && sendAmount > balance
                        ? "input-error"
                        : ""
                    }`}
                    placeholder="Amount in bits"
                    value={sendAmount || ""}
                    onChange={(e) => setSendAmount(Number(e.target.value))}
                    max={balance}
                  />
                  {sendAmount > 0 && balance !== undefined && sendAmount > balance && (
                    <label className="label">
                      <span className="label-text-alt text-error">
                        Exceeds balance ({balance} bit)
                      </span>
                    </label>
                  )}
                </div>
                <button
                  className="btn btn-primary w-full"
                  onClick={sendEcash}
                  disabled={
                    !sendAmount ||
                    sending ||
                    (balance !== undefined && sendAmount > balance)
                  }
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
                <div className="flex gap-2">
                  <button
                    className="btn btn-primary flex-1 gap-2"
                    onClick={() => {
                      navigator.clipboard.writeText(generatedToken)
                    }}
                  >
                    <RiFileCopyLine className="w-5 h-5" />
                    Copy
                  </button>
                  {navigator.share && (
                    <button
                      className="btn btn-primary flex-1 gap-2"
                      onClick={async () => {
                        try {
                          await navigator.share({
                            text: generatedToken,
                            title: "Cashu Token",
                          })
                        } catch (err) {
                          console.warn("Share failed:", err)
                        }
                      }}
                    >
                      <RiShare2Line className="w-5 h-5" />
                      Share
                    </button>
                  )}
                </div>
                <button className="btn btn-ghost w-full" onClick={handleClose}>
                  Done
                </button>
              </div>
            )}
          </div>
        )}

        {sendMode === "lightning" && (
          <div className="space-y-4">
            {error && (
              <div className="alert alert-error">
                <span>{error}</span>
              </div>
            )}
            <div className="form-control">
              <label className="label">
                <span className="label-text">
                  {isLightningAddress ? "Lightning Address / LNURL" : "Lightning Invoice"}
                </span>
              </label>
              <textarea
                className="textarea textarea-bordered h-24"
                placeholder="lnbc..., user@domain.com, or lnurl..."
                value={sendInvoice}
                onChange={(e) => setSendInvoice(e.target.value)}
              />
            </div>

            {isLightningAddress && (
              <>
                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Amount (bits)</span>
                  </label>
                  <input
                    type="number"
                    className={`input input-bordered ${
                      sendAmount > 0 && balance !== undefined && sendAmount > balance
                        ? "input-error"
                        : ""
                    }`}
                    placeholder="Amount in bits"
                    value={sendAmount || ""}
                    onChange={(e) => setSendAmount(Number(e.target.value))}
                    max={balance}
                  />
                  {sendAmount > 0 && balance !== undefined && sendAmount > balance && (
                    <label className="label">
                      <span className="label-text-alt text-error">
                        Exceeds balance ({balance} bit)
                      </span>
                    </label>
                  )}
                </div>
                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Comment (optional)</span>
                  </label>
                  <input
                    type="text"
                    className="input input-bordered"
                    placeholder="What's this payment for?"
                    value={lnurlComment}
                    onChange={(e) => setLnurlComment(e.target.value)}
                    maxLength={500}
                  />
                </div>
              </>
            )}

            {!isLightningAddress && invoiceAmount !== null && (
              <div
                className={`alert ${
                  balance !== undefined && invoiceAmount > balance
                    ? "alert-error"
                    : "alert-info"
                }`}
              >
                <div className="flex flex-col gap-2">
                  <div>
                    <span className="font-bold">Amount</span>
                    <div className="text-lg">{invoiceAmount.toLocaleString()} bits</div>
                    {balance !== undefined && invoiceAmount > balance && (
                      <div className="text-sm text-error">
                        Exceeds balance ({balance} bit)
                      </div>
                    )}
                  </div>
                  {invoiceDescription && (
                    <div>
                      <span className="font-bold">Description</span>
                      <div className="text-sm text-base-content/70 break-words">
                        {invoiceDescription}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            <button
              className="btn btn-primary w-full"
              onClick={sendLightning}
              disabled={
                !sendInvoice.trim() ||
                sending ||
                (invoiceAmount !== null &&
                  balance !== undefined &&
                  invoiceAmount > balance)
              }
            >
              {sending ? "Paying..." : "Pay"}
            </button>
          </div>
        )}
      </div>
    </Modal>
  )
}
