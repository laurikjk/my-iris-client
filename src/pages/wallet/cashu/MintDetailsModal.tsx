import {useState, useEffect} from "react"
import Modal from "@/shared/components/ui/Modal"
import type {Manager} from "@/lib/cashu/core/index"
import {RiDeleteBinLine, RiFileCopyLine, RiRefreshLine} from "@remixicon/react"
import {confirm} from "@/utils/utils"
import {useCashuWalletStore} from "@/stores/cashuWallet"

interface MintInfo {
  name?: string
  pubkey?: string
  version?: string
  description?: string
  description_long?: string
  contact?: Array<Array<string>> | {[key: string]: string}
  nuts?: {[key: string]: unknown}
  motd?: string
}

interface MintDetailsModalProps {
  isOpen: boolean
  onClose: () => void
  mintUrl: string
  manager: Manager | null
  onMintDeleted: () => void
  activeMint: string | null
  onSetActive: (mintUrl: string) => void
  balance?: number
}

export default function MintDetailsModal({
  isOpen,
  onClose,
  mintUrl,
  manager,
  onMintDeleted,
  activeMint,
  onSetActive,
  balance,
}: MintDetailsModalProps) {
  const {getCachedMintInfo, setCachedMintInfo, clearMintInfoCache} = useCashuWalletStore()
  const [mintInfo, setMintInfo] = useState<MintInfo | null>(null)
  const [qrCodeUrl, setQrCodeUrl] = useState<string>("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>("")
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    if (!isOpen || !mintUrl) return

    const fetchMintInfo = async () => {
      setLoading(true)
      try {
        // Check cache first
        const cached = getCachedMintInfo(mintUrl)
        if (cached) {
          setMintInfo(cached as unknown as MintInfo)
          setLoading(false)
          return
        }

        // Fetch from network
        const response = await fetch(`${mintUrl}/v1/info`)
        const data = await response.json()
        setMintInfo(data)
        setCachedMintInfo(mintUrl, data)
      } catch (error) {
        console.error("Failed to fetch mint info:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchMintInfo()

    // Generate QR code
    const generateQR = async () => {
      try {
        const QRCode = await import("qrcode")
        const url = await new Promise<string>((resolve, reject) => {
          QRCode.toDataURL(
            mintUrl,
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
  }, [isOpen, mintUrl, getCachedMintInfo, setCachedMintInfo])

  const handleRefreshMetadata = async () => {
    setRefreshing(true)
    try {
      // Clear cache and fetch fresh data
      clearMintInfoCache(mintUrl)
      const response = await fetch(`${mintUrl}/v1/info`)
      const data = await response.json()
      setMintInfo(data)
      setCachedMintInfo(mintUrl, data)
    } catch (error) {
      console.error("Failed to refresh mint info:", error)
      setError("Failed to refresh metadata")
    } finally {
      setRefreshing(false)
    }
  }

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(mintUrl)
  }

  const handleDelete = async () => {
    if (!manager) return
    if (!(await confirm("Are you sure you want to delete this mint?"))) return

    setError("")
    try {
      // Note: We need to add a deleteMint method to the manager
      // For now, just close and notify parent
      onMintDeleted()
      onClose()
    } catch (error) {
      console.error("Failed to delete mint:", error)
      setError(
        "Failed to delete mint: " +
          (error instanceof Error ? error.message : "Unknown error")
      )
    }
  }

  const getContactValue = (type: string): string | null => {
    if (!mintInfo?.contact) return null

    try {
      // Handle both array and object formats
      if (Array.isArray(mintInfo.contact)) {
        const contact = mintInfo.contact.find(([t]) => t === type)
        return contact ? contact[1] : null
      }

      // If it's an object, access directly
      if (typeof mintInfo.contact === "object") {
        return (mintInfo.contact as Record<string, string>)[type] || null
      }
    } catch (error) {
      console.error("Error parsing contact:", error, mintInfo.contact)
    }

    return null
  }

  if (!isOpen) return null

  return (
    <Modal onClose={onClose}>
      <div className="p-4">
        {loading ? (
          <div className="text-center py-8">Loading mint details...</div>
        ) : (
          <div className="space-y-6">
            {error && (
              <div className="alert alert-error">
                <span>{error}</span>
              </div>
            )}
            {/* Mint Header */}
            <div className="text-center">
              <h2 className="text-2xl font-bold mb-2">
                {mintInfo?.name || "Unknown Mint"}
              </h2>
              {balance !== undefined && (
                <div className="text-xl text-base-content/70 mb-4">{balance} bit</div>
              )}
              {qrCodeUrl && (
                <div className="flex justify-center my-4">
                  <div className="bg-white rounded-lg p-4">
                    <img src={qrCodeUrl} alt="Mint URL QR Code" className="w-32 h-32" />
                  </div>
                </div>
              )}
            </div>

            {/* Message */}
            {mintInfo?.motd && (
              <div className="alert alert-warning">
                <div>
                  <div className="font-bold">Mint Message</div>
                  <div className="text-sm">{mintInfo.motd}</div>
                </div>
              </div>
            )}

            {/* Description */}
            {mintInfo?.description_long && (
              <div className="text-sm text-base-content/80">
                {mintInfo.description_long}
              </div>
            )}

            {/* Contact */}
            {mintInfo?.contact && (
              <div>
                <h3 className="font-bold mb-2">CONTACT</h3>
                <div className="space-y-2">
                  {getContactValue("email") && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm">📧 {getContactValue("email")}</span>
                      <button
                        onClick={() =>
                          navigator.clipboard.writeText(getContactValue("email")!)
                        }
                        className="btn btn-ghost btn-xs"
                      >
                        <RiFileCopyLine className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                  {getContactValue("nostr") && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm truncate">
                        🔑 {getContactValue("nostr")}
                      </span>
                      <button
                        onClick={() =>
                          navigator.clipboard.writeText(getContactValue("nostr")!)
                        }
                        className="btn btn-ghost btn-xs"
                      >
                        <RiFileCopyLine className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Mint Details */}
            <div>
              <h3 className="font-bold mb-2">MINT DETAILS</h3>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-base-content/60">URL</span>
                  <span className="text-sm font-medium truncate ml-4">{mintUrl}</span>
                </div>
                {mintInfo?.nuts && (
                  <div className="flex justify-between">
                    <span className="text-sm text-base-content/60">Nuts</span>
                    <span className="text-sm font-medium">
                      {Object.keys(mintInfo.nuts).length} features
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-sm text-base-content/60">Currency</span>
                  <span className="text-sm font-medium">SAT</span>
                </div>
                {mintInfo?.version && (
                  <div className="flex justify-between">
                    <span className="text-sm text-base-content/60">Version</span>
                    <span className="text-sm font-medium">{mintInfo.version}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Actions */}
            <div>
              <h3 className="font-bold mb-2">ACTIONS</h3>
              <div className="space-y-2">
                {activeMint !== mintUrl && (
                  <button
                    onClick={() => onSetActive(mintUrl)}
                    className="btn btn-primary w-full justify-start"
                  >
                    Set as Active Mint
                  </button>
                )}
                <button
                  onClick={handleRefreshMetadata}
                  className="btn btn-ghost w-full justify-start"
                  disabled={refreshing}
                >
                  <RiRefreshLine className={`w-5 h-5 mr-2 ${refreshing ? "animate-spin" : ""}`} />
                  {refreshing ? "Refreshing..." : "Refresh metadata"}
                </button>
                <button
                  onClick={handleCopyUrl}
                  className="btn btn-ghost w-full justify-start"
                >
                  <RiFileCopyLine className="w-5 h-5 mr-2" />
                  Copy mint URL
                </button>
                <button
                  onClick={handleDelete}
                  className="btn btn-ghost text-error w-full justify-start"
                >
                  <RiDeleteBinLine className="w-5 h-5 mr-2" />
                  Delete mint
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}
