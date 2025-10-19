import {useState, useEffect} from "react"
import type {Manager} from "@/lib/cashu/core/index"
import Modal from "@/shared/components/ui/Modal"
import {usePublicKey} from "@/stores/user"
import {getLightningAddress} from "@/lib/npubcash"
import {truncateMiddle} from "@/utils/utils"
import {RiFileCopyLine, RiCheckLine} from "@remixicon/react"

interface ReceiveDialogProps {
  isOpen: boolean
  onClose: () => void
  manager: Manager | null
  mintUrl: string
  onSuccess: () => void
  initialToken?: string
  balance?: number
}

export default function ReceiveDialog({
  isOpen,
  onClose,
  manager,
  mintUrl,
  onSuccess,
  initialToken,
  balance,
}: ReceiveDialogProps) {
  const myPubKey = usePublicKey()
  const [receiveMode, setReceiveMode] = useState<"select" | "ecash" | "lightning">(
    "select"
  )
  const [tokenInput, setTokenInput] = useState<string>("")
  const [error, setError] = useState<string>("")
  const [lightningAmount, setLightningAmount] = useState<number>(100)
  const [invoice, setInvoice] = useState<string>("")
  const [lightningAddressQR, setLightningAddressQR] = useState<string>("")
  const [receiving, setReceiving] = useState(false)
  const [addressCopied, setAddressCopied] = useState(false)

  // Handle initial token (from QR scan)
  useEffect(() => {
    if (initialToken && isOpen) {
      setTokenInput(initialToken)
      setReceiveMode("ecash")
    }
  }, [initialToken, isOpen])

  // Generate QR code for Lightning address
  useEffect(() => {
    const generateQR = async () => {
      if (!myPubKey || receiveMode !== "lightning" || invoice) {
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
  }, [myPubKey, receiveMode, invoice])

  const handleClose = () => {
    onClose()
    setReceiveMode("select")
    setTokenInput("")
    setInvoice("")
    setError("")
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

      await manager.wallet.receive(tokenInput.trim())
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
      const quote = await manager.quotes.createMintQuote(mintUrl, lightningAmount)
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

  if (!isOpen) return null

  return (
    <Modal onClose={handleClose}>
      <div className="p-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold text-lg">Receive</h3>
          {balance !== undefined && (
            <div className="text-sm opacity-70">Balance: {balance} bit</div>
          )}
        </div>

        {receiveMode === "select" && (
          <div className="space-y-4">
            <button
              className="btn btn-outline w-full justify-start"
              onClick={() => setReceiveMode("ecash")}
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

        {receiveMode === "ecash" && (
          <div className="space-y-4">
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
            </div>
            <button
              className="btn btn-primary w-full"
              onClick={receiveEcash}
              disabled={!tokenInput.trim() || receiving}
            >
              {receiving ? "Receiving..." : "Receive"}
            </button>
          </div>
        )}

        {receiveMode === "lightning" && (
          <div className="space-y-4">
            {error && (
              <div className="alert alert-error">
                <span>{error}</span>
              </div>
            )}
            {!invoice ? (
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
                <button
                  className="btn btn-primary w-full"
                  onClick={createLightningInvoice}
                  disabled={!lightningAmount || receiving}
                >
                  {receiving ? "Creating..." : "Create Invoice"}
                </button>
              </>
            ) : (
              <div className="space-y-4">
                <div className="alert alert-info">
                  <span className="font-bold">Invoice created!</span>
                </div>
                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Lightning Invoice</span>
                  </label>
                  <textarea
                    className="textarea textarea-bordered h-32 font-mono text-xs resize-none"
                    value={invoice}
                    readOnly
                  />
                </div>
                <button
                  className="btn btn-primary w-full"
                  onClick={() => {
                    navigator.clipboard.writeText(invoice)
                  }}
                >
                  Copy Invoice
                </button>
                <button
                  className="btn btn-ghost w-full"
                  onClick={() => {
                    setInvoice("")
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
