import {useState, useEffect} from "react"
import type {Manager} from "@/lib/cashu/core/index"
import Modal from "@/shared/components/ui/Modal"
import {usePublicKey} from "@/stores/user"
import {getLightningAddress, getNPubCashInfo} from "@/lib/npubcash"
import {truncateMiddle} from "@/utils/utils"
import {RiFileCopyLine, RiCheckLine, RiQrCodeLine} from "@remixicon/react"
import CopyButton from "@/shared/components/button/CopyButton"
import {decode} from "light-bolt11-decoder"
import {
  PaymentRequest,
  PaymentRequestTransport,
  PaymentRequestTransportType,
} from "@cashu/cashu-ts"
import {useAnimatedQR} from "@/hooks/useAnimatedQR"
import {RequestQRDisplay} from "./RequestQRDisplay"
import {ndk} from "@/utils/ndk"

interface ReceiveDialogProps {
  isOpen: boolean
  onClose: () => void
  manager: Manager | null
  mintUrl: string
  onSuccess: () => void
  initialToken?: string
  initialInvoice?: string
  balance?: number
  onScanRequest?: () => void
}

export default function ReceiveDialog({
  isOpen,
  onClose,
  manager,
  mintUrl,
  onSuccess,
  initialToken,
  initialInvoice,
  onScanRequest,
}: ReceiveDialogProps) {
  const myPubKey = usePublicKey()
  const [receiveMode, setReceiveMode] = useState<
    "select" | "ecash-menu" | "ecash-paste" | "lightning" | "request"
  >("select")
  const [tokenInput, setTokenInput] = useState<string>("")
  const [error, setError] = useState<string>("")
  const [receiveNote, setReceiveNote] = useState<string>("")
  const [lightningAmount, setLightningAmount] = useState<number>(100)
  const [lightningDescription, setLightningDescription] = useState<string>("")
  const [invoice, setInvoice] = useState<string>("")
  const [lightningAddressQR, setLightningAddressQR] = useState<string>("")
  const [receiving, setReceiving] = useState(false)
  const [addressCopied, setAddressCopied] = useState(false)
  const [requestAmount, setRequestAmount] = useState<number | undefined>(undefined)
  const [requestDescription, setRequestDescription] = useState<string>("")
  const [paymentRequestString, setPaymentRequestString] = useState<string>("")
  const [requestCopied, setRequestCopied] = useState(false)
  const [hasMintConfigured, setHasMintConfigured] = useState<boolean>(false)
  const [checkingMint, setCheckingMint] = useState<boolean>(false)
  const [previewAmount, setPreviewAmount] = useState<number | null>(null)
  const [previewMemo, setPreviewMemo] = useState<string>("")
  const [previewMint, setPreviewMint] = useState<string>("")

  const {currentFragment: requestFragment, isAnimated: isRequestAnimated} =
    useAnimatedQR(paymentRequestString)

  // Handle initial token (from QR scan) and extract memo
  useEffect(() => {
    const handleInitialToken = async () => {
      if (!initialToken || !isOpen) return

      setTokenInput(initialToken)
      setReceiveMode("ecash-paste")

      // Try to extract memo from token
      try {
        const {getDecodedToken} = await import("@cashu/cashu-ts")
        const decoded = getDecodedToken(initialToken.trim())
        if (decoded.memo) {
          setReceiveNote(decoded.memo)
        }
      } catch (err) {
        console.warn("Failed to decode token for memo:", err)
      }
    }

    handleInitialToken()
  }, [initialToken, isOpen])

  // Handle initial invoice (from pending mint entry)
  useEffect(() => {
    const loadInitialInvoice = async () => {
      if (!initialInvoice || !isOpen) return

      setInvoice(initialInvoice)
      setReceiveMode("lightning")

      // Decode invoice to extract amount and description
      try {
        const decoded = decode(initialInvoice)
        const amountSection = decoded.sections.find((s) => s.name === "amount")
        const descSection = decoded.sections.find((s) => s.name === "description")

        if (amountSection && "value" in amountSection && amountSection.value) {
          // Amount is in millisats, convert to sats
          setLightningAmount(Math.floor(Number(amountSection.value) / 1000))
        }
        if (descSection && "value" in descSection && descSection.value) {
          setLightningDescription(String(descSection.value))
        }
      } catch (err) {
        console.warn("Failed to decode invoice:", err)
      }
    }

    loadInitialInvoice()
  }, [initialInvoice, isOpen])

  // Live preview of pasted token
  useEffect(() => {
    const decodeTokenPreview = async () => {
      const trimmed = tokenInput.trim()
      if (!trimmed || !trimmed.startsWith("cashu")) {
        setPreviewAmount(null)
        setPreviewMemo("")
        setPreviewMint("")
        return
      }

      try {
        const {getDecodedToken} = await import("@cashu/cashu-ts")
        const decoded = getDecodedToken(trimmed)

        // Calculate amount
        let total = 0
        if (decoded.proofs && Array.isArray(decoded.proofs)) {
          for (const proof of decoded.proofs) {
            total += proof.amount || 0
          }
        } else if (decoded.token && Array.isArray(decoded.token)) {
          for (const tokenEntry of decoded.token) {
            if (tokenEntry.proofs && Array.isArray(tokenEntry.proofs)) {
              for (const proof of tokenEntry.proofs) {
                total += proof.amount || 0
              }
            }
          }
        }

        setPreviewAmount(total)
        setPreviewMemo(decoded.memo || "")
        setPreviewMint(decoded.mint || "")

        // Auto-fill note from memo if not already set
        if (decoded.memo && !receiveNote) {
          setReceiveNote(decoded.memo)
        }
      } catch (err) {
        // Invalid token, clear preview
        setPreviewAmount(null)
        setPreviewMemo("")
        setPreviewMint("")
      }
    }

    decodeTokenPreview()
  }, [tokenInput, receiveNote])

  // Check if mint is configured and ensure npub.cash default mint exists
  useEffect(() => {
    const checkMint = async () => {
      if (!manager || !myPubKey || receiveMode !== "lightning") {
        setHasMintConfigured(false)
        return
      }

      setCheckingMint(true)
      try {
        // Check if any mint exists
        const balances = await manager.wallet.getBalances()
        const hasMint = Object.keys(balances).length > 0

        if (!hasMint) {
          // Try to get default mint from npub.cash
          const signer = ndk().signer
          if (signer) {
            const info = await getNPubCashInfo(signer)
            if (info?.mintUrl) {
              console.log(`Adding default npub.cash mint: ${info.mintUrl}`)
              try {
                await manager.mint.addMint(info.mintUrl)
                setHasMintConfigured(true)
              } catch (error) {
                console.error("Failed to add default mint:", error)
                setHasMintConfigured(false)
              }
            } else {
              setHasMintConfigured(false)
            }
          } else {
            setHasMintConfigured(false)
          }
        } else {
          setHasMintConfigured(true)
        }
      } catch (error) {
        console.error("Error checking mint:", error)
        setHasMintConfigured(false)
      } finally {
        setCheckingMint(false)
      }
    }

    checkMint()
  }, [manager, myPubKey, receiveMode])

  // Generate QR code for Lightning address
  useEffect(() => {
    const generateQR = async () => {
      if (!myPubKey || receiveMode !== "lightning" || invoice || !hasMintConfigured) {
        setLightningAddressQR("")
        return
      }

      try {
        const QRCode = await import("qrcode")
        const address = getLightningAddress(myPubKey)
        const url = await new Promise<string>((resolve, reject) => {
          QRCode.toDataURL(
            `lightning:${address}`,
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
        setLightningAddressQR(url)
      } catch (error) {
        console.error("Error generating QR code:", error)
      }
    }
    generateQR()
  }, [myPubKey, receiveMode, invoice, hasMintConfigured])

  const handleClose = () => {
    onClose()
    setReceiveMode("select")
    setTokenInput("")
    setInvoice("")
    setError("")
    setReceiveNote("")
    setPaymentRequestString("")
    setRequestAmount(undefined)
    setRequestDescription("")
  }

  const receiveEcash = async () => {
    if (!manager || !tokenInput.trim()) return
    setReceiving(true)
    setError("")
    try {
      const {getDecodedToken} = await import("@cashu/cashu-ts")
      const decoded = getDecodedToken(tokenInput.trim())

      const mintUrl = decoded.mint
      if (mintUrl) {
        const isKnown = await manager.mint.isKnownMint(mintUrl)
        if (!isKnown) {
          await manager.mint.addMint(mintUrl)
        }
      }

      // Check if we have send metadata for this token (means we sent it originally)
      const {getPaymentMetadata, savePaymentMetadata} = await import(
        "@/stores/paymentMetadata"
      )
      const trimmedToken = tokenInput.trim()
      const existingMetadata = await getPaymentMetadata(trimmedToken)

      // Use receiveNote or fall back to token memo
      const noteToSave = receiveNote.trim() || decoded.memo || undefined

      // If we sent this token and are now redeeming it ourselves,
      // save metadata marking ourselves as the sender
      if (existingMetadata?.recipient && myPubKey) {
        await savePaymentMetadata(
          trimmedToken,
          "other",
          undefined,
          undefined,
          noteToSave,
          undefined,
          myPubKey
        )
      } else if (noteToSave) {
        // Save note even if no existing metadata
        await savePaymentMetadata(trimmedToken, "other", undefined, undefined, noteToSave)
      }

      await manager.wallet.receive(trimmedToken)
      setTokenInput("")
      handleClose()
      onSuccess()
    } catch (error) {
      console.error("Failed to receive token:", error)
      setError(
        "Failed to receive token: " +
          (error instanceof Error ? error.message : "Unknown error")
      )
    } finally {
      setReceiving(false)
    }
  }

  const createLightningInvoice = async () => {
    if (!manager || !mintUrl || !lightningAmount) return
    setReceiving(true)
    setError("")
    try {
      const quote = await manager.quotes.createMintQuote(
        mintUrl,
        lightningAmount,
        lightningDescription.trim() || undefined
      )
      setInvoice(quote.request)
    } catch (error) {
      console.error("Failed to create mint quote:", error)
      setError(
        "Failed to create invoice: " +
          (error instanceof Error ? error.message : "Unknown error")
      )
    } finally {
      setReceiving(false)
    }
  }

  const createPaymentRequest = async () => {
    if (!manager || !mintUrl || !myPubKey) return
    setReceiving(true)
    setError("")
    try {
      // Create transport using nostr pubkey with NIP-117 (double ratchet DM)
      const transport: PaymentRequestTransport[] = [
        {
          type: PaymentRequestTransportType.NOSTR,
          target: myPubKey,
          tags: [["n", "117"]],
        },
      ]

      // Generate random ID
      const requestId = Math.random().toString(36).substring(2, 10)

      // Create payment request with description
      const paymentRequest = new PaymentRequest(
        transport,
        requestId,
        requestAmount,
        "sat", // unit
        [mintUrl], // mints array
        requestDescription.trim() || undefined // description/memo
      )

      const encoded = paymentRequest.toEncodedRequest()
      setPaymentRequestString(encoded)
    } catch (error) {
      console.error("Failed to create payment request:", error)
      setError(
        "Failed to create payment request: " +
          (error instanceof Error ? error.message : "Unknown error")
      )
    } finally {
      setReceiving(false)
    }
  }

  if (!isOpen) return null

  const getTitle = () => {
    if (receiveMode === "ecash-menu") return "Receive Ecash"
    if (receiveMode === "ecash-paste") return "Receive Ecash"
    if (receiveMode === "request") return "Create Payment Request"
    if (receiveMode === "lightning") return "Receive Lightning"
    return "Receive"
  }

  const handleBack = () => {
    if (receiveMode === "ecash-menu") {
      setReceiveMode("select")
    } else if (receiveMode === "ecash-paste" || receiveMode === "request") {
      setReceiveMode("ecash-menu")
    } else if (receiveMode === "lightning") {
      setReceiveMode("select")
    } else {
      handleClose()
    }
  }

  const showBackButton = receiveMode !== "select"

  return (
    <Modal onClose={handleClose}>
      <div className="p-4">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2">
            {showBackButton && (
              <button onClick={handleBack} className="btn btn-ghost btn-sm btn-circle">
                ←
              </button>
            )}
            <div>
              <h3 className="font-bold text-lg">{getTitle()}</h3>
              <div className="text-xs opacity-60 mt-1">
                {mintUrl.replace(/^https?:\/\//, "")}
              </div>
            </div>
          </div>
        </div>

        {receiveMode === "select" && (
          <div className="space-y-4">
            <button
              className="btn btn-outline w-full justify-start"
              onClick={() => setReceiveMode("ecash-menu")}
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
              onClick={() => setReceiveMode("lightning")}
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

        {receiveMode === "ecash-menu" && (
          <div className="space-y-4">
            <button
              className="btn btn-outline w-full justify-start"
              onClick={() => setReceiveMode("ecash-paste")}
            >
              <RiFileCopyLine className="w-5 h-5 mr-2" />
              PASTE
            </button>

            <button
              className="btn btn-outline w-full justify-start"
              onClick={() => {
                onClose()
                onScanRequest?.()
              }}
            >
              <RiQrCodeLine className="w-5 h-5 mr-2" />
              SCAN
            </button>

            <button
              className="btn btn-outline w-full justify-start"
              onClick={() => setReceiveMode("request")}
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
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              REQUEST
            </button>
          </div>
        )}

        {receiveMode === "ecash-paste" && (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              receiveEcash()
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
                <span className="label-text">Paste Cashu token</span>
              </label>
              <textarea
                className="textarea textarea-bordered h-24"
                placeholder="cashuA..."
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
              />
              {previewAmount !== null && (
                <div className="mt-2 p-3 bg-base-300 rounded-lg space-y-1">
                  <div className="font-semibold text-success">{previewAmount} bits</div>
                  {previewMemo && (
                    <div className="text-sm text-base-content/70">{previewMemo}</div>
                  )}
                  {previewMint && (
                    <div className="text-xs text-base-content/60">
                      {previewMint.replace(/^https?:\/\//, "")}
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="form-control">
              <label className="label">
                <span className="label-text">Note (optional)</span>
              </label>
              <input
                type="text"
                className="input input-bordered"
                placeholder="Add a note..."
                value={receiveNote}
                onChange={(e) => setReceiveNote(e.target.value)}
                maxLength={200}
              />
              <label className="label">
                <span className="label-text-alt text-base-content/60">
                  Pre-filled from token memo, can be edited
                </span>
              </label>
            </div>
            <button
              type="submit"
              className="btn btn-primary w-full"
              disabled={!tokenInput.trim() || receiving}
            >
              {receiving ? "Receiving..." : "Receive"}
            </button>
          </form>
        )}

        {receiveMode === "request" && (
          <div className="space-y-4">
            {error && (
              <div className="alert alert-error">
                <span>{error}</span>
              </div>
            )}
            {!paymentRequestString ? (
              <>
                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Amount (bits) - optional</span>
                  </label>
                  <input
                    type="number"
                    className="input input-bordered"
                    placeholder="Leave empty for any amount"
                    value={requestAmount || ""}
                    onChange={(e) =>
                      setRequestAmount(
                        e.target.value ? Number(e.target.value) : undefined
                      )
                    }
                  />
                </div>
                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Description (optional)</span>
                  </label>
                  <input
                    type="text"
                    className="input input-bordered"
                    placeholder="What is this payment for?"
                    value={requestDescription}
                    onChange={(e) => setRequestDescription(e.target.value)}
                    maxLength={200}
                  />
                </div>
                <button
                  className="btn btn-primary w-full"
                  onClick={createPaymentRequest}
                  disabled={receiving}
                >
                  {receiving ? "Creating..." : "Create Payment Request"}
                </button>
              </>
            ) : (
              <div className="space-y-4">
                <div className="alert alert-info">
                  <span className="font-bold">Payment request created!</span>
                </div>
                {(requestAmount || requestDescription) && (
                  <div className="bg-base-200 rounded-lg p-4 space-y-2">
                    {requestAmount && (
                      <div className="text-center">
                        <div className="text-2xl font-bold">{requestAmount} bit</div>
                      </div>
                    )}
                    {requestDescription && (
                      <div className="text-sm text-base-content/70 text-center">
                        {requestDescription}
                      </div>
                    )}
                  </div>
                )}
                <RequestQRDisplay
                  data={paymentRequestString}
                  fragment={requestFragment}
                  isAnimated={isRequestAnimated}
                />
                <div
                  className="flex items-center justify-center gap-2 bg-base-200 rounded-lg p-3 cursor-pointer hover:bg-base-300 transition-colors"
                  onClick={() => {
                    navigator.clipboard.writeText(paymentRequestString)
                    setRequestCopied(true)
                    setTimeout(() => setRequestCopied(false), 2000)
                  }}
                >
                  <span className="text-xs font-mono break-all">
                    {truncateMiddle(paymentRequestString, 20)}
                  </span>
                  {requestCopied ? (
                    <RiCheckLine className="w-5 h-5 text-success" />
                  ) : (
                    <RiFileCopyLine className="w-5 h-5 opacity-60" />
                  )}
                </div>
                <button
                  className="btn btn-ghost w-full"
                  onClick={() => {
                    setPaymentRequestString("")
                    setReceiveMode("select")
                  }}
                >
                  Done
                </button>
              </div>
            )}
          </div>
        )}

        {receiveMode === "lightning" && (
          <div className="space-y-4">
            {error && (
              <div className="alert alert-error">
                <span>{error}</span>
              </div>
            )}
            {!invoice && (
              <>
                {checkingMint && (
                  <div className="flex justify-center p-8">
                    <div className="text-base-content/60">Setting up mint...</div>
                  </div>
                )}
                {!checkingMint && !hasMintConfigured && (
                  <div className="alert alert-warning">
                    <div className="flex flex-col gap-2">
                      <div className="font-semibold">No mint configured</div>
                      <div className="text-sm">
                        Please add a mint in the Mints tab before using Lightning
                        payments. Payments to your npub.cash address will be automatically
                        received once a mint is configured.
                      </div>
                      <button
                        className="btn btn-sm btn-primary mt-2"
                        onClick={() => {
                          handleClose()
                          // The user can navigate to mints tab manually
                        }}
                      >
                        Go to Wallet
                      </button>
                    </div>
                  </div>
                )}
                {!checkingMint && hasMintConfigured && (
                  <>
                    {/* Lightning Address */}
                    {myPubKey && lightningAddressQR && (
                      <div className="space-y-4">
                        <div className="flex justify-center">
                          <div className="bg-white rounded-lg p-4">
                            <img
                              src={lightningAddressQR}
                              alt="Lightning Address QR Code"
                              className="w-64 h-64"
                            />
                          </div>
                        </div>
                        <div
                          className="flex items-center justify-center gap-2 bg-base-200 rounded-lg p-3 cursor-pointer hover:bg-base-300 transition-colors"
                          onClick={() => {
                            const address = getLightningAddress(myPubKey)
                            navigator.clipboard.writeText(address)
                            setAddressCopied(true)
                            setTimeout(() => setAddressCopied(false), 2000)
                          }}
                        >
                          <span className="text-sm font-mono">
                            {truncateMiddle(getLightningAddress(myPubKey))}
                          </span>
                          {addressCopied ? (
                            <RiCheckLine className="w-5 h-5 text-success" />
                          ) : (
                            <RiFileCopyLine className="w-5 h-5 opacity-60" />
                          )}
                        </div>
                        <div className="divider">OR</div>
                      </div>
                    )}
                    <div className="form-control">
                      <label className="label">
                        <span className="label-text">
                          Create invoice for specific amount (bits)
                        </span>
                      </label>
                      <input
                        type="number"
                        className="input input-bordered"
                        placeholder="100"
                        value={lightningAmount}
                        onChange={(e) => setLightningAmount(Number(e.target.value))}
                      />
                    </div>
                    <div className="form-control">
                      <label className="label">
                        <span className="label-text">Description (optional)</span>
                      </label>
                      <input
                        type="text"
                        className="input input-bordered"
                        placeholder="What is this payment for?"
                        value={lightningDescription}
                        onChange={(e) => setLightningDescription(e.target.value)}
                        maxLength={200}
                      />
                    </div>
                    <button
                      className="btn btn-primary w-full"
                      onClick={createLightningInvoice}
                      disabled={!lightningAmount || receiving}
                    >
                      {receiving ? "Creating..." : "Create Invoice"}
                    </button>
                  </>
                )}
              </>
            )}
            {invoice && (
              <div className="space-y-4">
                {lightningAmount > 0 && (
                  <div className="text-center">
                    <div className="text-3xl font-bold">{lightningAmount} bit</div>
                    {lightningDescription && (
                      <div className="text-sm text-base-content/70 mt-1">
                        {lightningDescription}
                      </div>
                    )}
                  </div>
                )}

                <RequestQRDisplay
                  data={`lightning:${invoice}`}
                  fragment={`lightning:${invoice}`}
                  isAnimated={false}
                />

                <CopyButton
                  copyStr={invoice}
                  text="Copy Invoice"
                  className="btn btn-primary w-full"
                />

                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Lightning Invoice</span>
                  </label>
                  <textarea
                    className="textarea textarea-bordered h-24 font-mono text-xs resize-none"
                    value={invoice}
                    readOnly
                  />
                </div>

                <button
                  className="btn btn-ghost w-full"
                  onClick={() => {
                    setInvoice("")
                    setLightningAmount(100)
                    setLightningDescription("")
                    setReceiveMode("select")
                  }}
                >
                  Done
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  )
}
