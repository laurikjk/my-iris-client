import {useState, useEffect, useMemo} from "react"
import type {Manager} from "@/lib/cashu/core/index"
import type {Token, PaymentRequest} from "@cashu/cashu-ts"
import Modal from "@/shared/components/ui/Modal"
import {decode} from "light-bolt11-decoder"
import {savePaymentMetadata} from "@/stores/paymentMetadata"
import {getLNURLInvoice} from "@/utils/zapUtils"
import {RiFileCopyLine, RiShare2Line} from "@remixicon/react"
import {DoubleRatchetUserSearch} from "@/pages/chats/components/DoubleRatchetUserSearch"
import {LightningUserSearch} from "./LightningUserSearch"
import {getSessionManager} from "@/shared/services/PrivateChats"
import type {DoubleRatchetUser} from "@/pages/chats/utils/doubleRatchetUsers"
import {useNavigate} from "@/navigation"
import {usePrivateMessagesStore} from "@/stores/privateMessages"
import {useUserStore} from "@/stores/user"
import {useAnimatedQR} from "@/hooks/useAnimatedQR"

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
  const navigate = useNavigate()
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
  const [sendingDm, setSendingDm] = useState(false)
  const [selectedUserPubkey, setSelectedUserPubkey] = useState<string | null>(null)
  const [dmMessage, setDmMessage] = useState<string>("")
  const [sendNote, setSendNote] = useState<string>("")
  const [, setPaymentRequest] = useState<PaymentRequest | null>(null)

  // Handle initial token (from history)
  useEffect(() => {
    const loadInitialToken = async () => {
      if (!initialToken || !isOpen) return
      try {
        const {getEncodedToken} = await import("@cashu/cashu-ts")
        const encoded = getEncodedToken(initialToken)
        setGeneratedToken(encoded)
        setSendMode("ecash")

        // Load existing metadata and suggest as default DM message
        const {getPaymentMetadata} = await import("@/stores/paymentMetadata")
        const metadata = await getPaymentMetadata(encoded)
        if (metadata?.message) {
          setDmMessage(metadata.message)
        }
      } catch (error) {
        console.error("Failed to encode initial token:", error)
      }
    }
    loadInitialToken()
  }, [initialToken, isOpen])

  // Handle initial invoice (from QR scan)
  useEffect(() => {
    const handleInitialInvoice = async () => {
      if (!initialInvoice || !isOpen) return

      // Check if it's a payment request
      if (initialInvoice.startsWith("creq")) {
        try {
          const {decodePaymentRequest} = await import("@cashu/cashu-ts")
          const decodedRequest = decodePaymentRequest(initialInvoice)

          // Store the payment request
          setPaymentRequest(decodedRequest)

          // Set amount and description from payment request
          if (decodedRequest.amount) {
            setSendAmount(decodedRequest.amount)
          }
          if (decodedRequest.description) {
            setInvoiceDescription(decodedRequest.description)
          }

          // Check if it's a NIP-117 (double ratchet DM) transport
          const hasNip117Transport = decodedRequest.transport?.some(
            (t) =>
              t.type === "nostr" &&
              t.tags?.some((tag: string[]) => tag[0] === "n" && tag[1] === "117")
          )

          if (hasNip117Transport && decodedRequest.transport?.[0]?.target) {
            // Auto-select the recipient for double ratchet DM
            setSelectedUserPubkey(decodedRequest.transport[0].target)
          }

          setSendMode("ecash")
          return
        } catch (error) {
          console.error("Failed to decode payment request:", error)
        }
      }

      // Otherwise treat as lightning invoice
      setSendInvoice(initialInvoice)
      setSendMode("lightning")
    }
    handleInitialInvoice()
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

  const {currentFragment, isAnimated} = useAnimatedQR(generatedToken)

  // Parse token to extract amount and memo
  const tokenData = useMemo(() => {
    // If we have initialToken (Token object from history), use it directly
    if (initialToken) {
      let total = 0
      const token = initialToken as any

      // Handle v3 tokens (token array format)
      if (token.token && Array.isArray(token.token)) {
        for (const entry of token.token) {
          if (entry.proofs && Array.isArray(entry.proofs)) {
            for (const proof of entry.proofs) {
              total += proof.amount || 0
            }
          }
        }
      }
      // Handle v4 tokens (direct proofs array)
      else if (token.proofs && Array.isArray(token.proofs)) {
        for (const proof of token.proofs) {
          total += proof.amount || 0
        }
      }

      return {
        amount: total,
        memo: token.memo || ""
      }
    }

    // Otherwise decode from generated token string
    if (!generatedToken) return {amount: 0, memo: ""}
    try {
      const {getDecodedToken} = require("@cashu/cashu-ts")
      const decoded = getDecodedToken(generatedToken)
      let total = 0

      // Handle v3 tokens (token array format)
      if (decoded.token && Array.isArray(decoded.token)) {
        for (const entry of decoded.token) {
          if (entry.proofs && Array.isArray(entry.proofs)) {
            for (const proof of entry.proofs) {
              total += proof.amount || 0
            }
          }
        }
      }
      // Handle v4 tokens (direct proofs array)
      else if (decoded.proofs && Array.isArray(decoded.proofs)) {
        for (const proof of decoded.proofs) {
          total += proof.amount || 0
        }
      }

      return {
        amount: total,
        memo: decoded.memo || sendNote
      }
    } catch (error) {
      console.error("Failed to decode token:", error)
      return {amount: 0, memo: sendNote}
    }
  }, [initialToken, generatedToken, sendNote])

  useEffect(() => {
    const generateQR = async () => {
      const dataToEncode = isAnimated ? currentFragment : generatedToken
      if (!dataToEncode) {
        setQrCodeUrl("")
        return
      }
      try {
        const QRCode = await import("qrcode")
        const url = await new Promise<string>((resolve, reject) => {
          QRCode.toDataURL(
            dataToEncode,
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
  }, [generatedToken, currentFragment, isAnimated])

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
    setSendingDm(false)
    setSelectedUserPubkey(null)
    setDmMessage("")
    setSendNote("")
  }

  const handleSendTokenDm = async (user: DoubleRatchetUser) => {
    if (!generatedToken) return

    setSendingDm(true)
    setError("")
    try {
      const sessionManager = getSessionManager()
      if (!sessionManager) {
        throw new Error("Session manager not available")
      }

      const myPubKey = useUserStore.getState().publicKey
      if (!myPubKey) {
        throw new Error("User not logged in")
      }

      // Send the message with optional note
      const messageContent = dmMessage.trim()
        ? `${generatedToken} ${dmMessage.trim()}`
        : generatedToken
      const sentMessage = await sessionManager.sendMessage(user.pubkey, messageContent)

      // Update local store
      await usePrivateMessagesStore.getState().upsert(user.pubkey, myPubKey, sentMessage)

      // Save payment metadata (will overwrite recipient if token was previously created)
      try {
        await savePaymentMetadata(
          generatedToken,
          "dm",
          user.pubkey,
          undefined,
          dmMessage.trim() || undefined
        )
      } catch (err) {
        console.warn("Failed to save payment metadata:", err)
      }

      // Navigate to chat
      handleClose()
      navigate("/chats/chat", {
        state: {id: user.pubkey},
      })
    } catch (error) {
      console.error("Failed to send token via DM:", error)
      setError(
        "Failed to send DM: " + (error instanceof Error ? error.message : "Unknown error")
      )
    } finally {
      setSendingDm(false)
    }
  }

  const handleSelectLightningUser = (pubkey: string, lud16: string) => {
    setSendInvoice(lud16)
    setSelectedUserPubkey(pubkey)
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
      // Pass memo to wallet.send() so it's included in history
      const token = await manager.wallet.send(
        mintUrl,
        sendAmount,
        sendNote.trim() || undefined
      )

      const {getEncodedToken} = await import("@cashu/cashu-ts")
      const encoded = getEncodedToken(token)

      setGeneratedToken(encoded)

      // Save note to paymentMetadata (for enrichment lookups by encoded token)
      if (sendNote.trim()) {
        const {savePaymentMetadata} = await import("@/stores/paymentMetadata")
        try {
          await savePaymentMetadata(
            encoded,
            "other",
            undefined,
            undefined,
            sendNote.trim()
          )
        } catch (err) {
          console.warn("Failed to save send note:", err)
        }
      }

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
            selectedUserPubkey || undefined,
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
          await savePaymentMetadata(invoice, "other", selectedUserPubkey || undefined)
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
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  sendEcash()
                }}
              >
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
                    <span className="label-text">Note (optional)</span>
                  </label>
                  <input
                    type="text"
                    className="input input-bordered"
                    placeholder="What's this for?"
                    value={sendNote}
                    onChange={(e) => setSendNote(e.target.value)}
                    maxLength={200}
                  />
                </div>
                <button
                  type="submit"
                  className="btn btn-primary w-full"
                  disabled={
                    !sendAmount ||
                    sending ||
                    (balance !== undefined && sendAmount > balance)
                  }
                >
                  {sending ? "Creating..." : "Create Token"}
                </button>
              </form>
            ) : (
              <div className="space-y-4">
                <div className="alert alert-success">
                  <div className="flex flex-col gap-1">
                    <div className="font-bold text-lg">{tokenData.amount} bit</div>
                    {tokenData.memo && <div className="text-sm opacity-80">{tokenData.memo}</div>}
                  </div>
                </div>
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
                <div className="divider">DM</div>
                <div className="form-control">
                  <DoubleRatchetUserSearch
                    placeholder="Search secure messaging users..."
                    onUserSelect={handleSendTokenDm}
                    maxResults={5}
                    showCount={false}
                  />
                  {sendingDm && (
                    <div className="alert alert-info mt-2">
                      <span>Sending DM...</span>
                    </div>
                  )}
                </div>
                <div className="divider">QR</div>
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
                <button className="btn btn-ghost w-full" onClick={handleClose}>
                  Done
                </button>
              </div>
            )}
          </div>
        )}

        {sendMode === "lightning" && (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              sendLightning()
            }}
            className="space-y-4"
          >
            {error && (
              <div className="alert alert-error">
                <span>{error}</span>
              </div>
            )}
            <div className="form-control">
              <label className="label">
                <span className="label-text">Search users</span>
              </label>
              <LightningUserSearch
                placeholder="Search users with lightning..."
                onUserSelect={handleSelectLightningUser}
                maxResults={5}
              />
            </div>
            <div className="divider">OR</div>
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
              type="submit"
              className="btn btn-primary w-full"
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
          </form>
        )}
      </div>
    </Modal>
  )
}
