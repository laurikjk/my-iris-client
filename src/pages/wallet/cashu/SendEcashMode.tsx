import {useState, useMemo} from "react"
import type {Manager} from "@/lib/cashu/core/index"
import {getDecodedToken, type Token} from "@cashu/cashu-ts"
import {RiShare2Line} from "@remixicon/react"
import {DoubleRatchetUserSearch} from "@/pages/chats/components/DoubleRatchetUserSearch"
import type {DoubleRatchetUser} from "@/pages/chats/utils/doubleRatchetUsers"
import {useNavigate} from "@/navigation"
import {usePrivateMessagesStore} from "@/stores/privateMessages"
import {useUserStore} from "@/stores/user"
import {useAnimatedQR} from "@/hooks/useAnimatedQR"
import CopyButton from "@/shared/components/button/CopyButton"
import {getSessionManager} from "@/shared/services/PrivateChats"
import {savePaymentMetadata} from "@/stores/paymentMetadata"

interface SendEcashModeProps {
  manager: Manager | null
  mintUrl: string
  onSuccess: () => void
  onClose: () => void
  initialToken?: Token
  balance?: number
}

export default function SendEcashMode({
  manager,
  mintUrl,
  onSuccess,
  onClose,
  initialToken,
  balance,
}: SendEcashModeProps) {
  const navigate = useNavigate()
  const [sendAmount, setSendAmount] = useState<number>(0)
  const [sendNote, setSendNote] = useState<string>("")
  const [generatedToken, setGeneratedToken] = useState<string>("")
  const [qrCodeUrl, setQrCodeUrl] = useState<string>("")
  const [sending, setSending] = useState(false)
  const [sendingDm, setSendingDm] = useState(false)
  const [error, setError] = useState<string>("")
  const dmMessage = "" // Note: dmMessage input not implemented yet

  const {currentFragment, isAnimated} = useAnimatedQR(generatedToken)

  // Parse token to extract amount and memo
  const tokenData = useMemo(() => {
    // If we have initialToken (Token object from history), use it directly
    if (initialToken) {
      let total = 0
      const token = initialToken

      // Handle v3 tokens (token array format)
      if ("token" in token && Array.isArray(token.token)) {
        for (const entry of token.token) {
          if (entry.proofs && Array.isArray(entry.proofs)) {
            for (const proof of entry.proofs) {
              total += proof.amount || 0
            }
          }
        }
      }
      // Handle v4 tokens (direct proofs array)
      else if ("proofs" in token && Array.isArray(token.proofs)) {
        for (const proof of token.proofs) {
          total += proof.amount || 0
        }
      }

      return {
        amount: total,
        memo: token.memo || "",
      }
    }

    // Otherwise decode from generated token string
    if (!generatedToken) return {amount: 0, memo: ""}
    try {
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
        memo: decoded.memo || sendNote,
      }
    } catch (error) {
      console.error("Failed to decode token:", error)
      return {amount: 0, memo: sendNote}
    }
  }, [initialToken, generatedToken, sendNote])

  // Generate QR code
  useState(() => {
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
  })

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
      onClose()
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

  return (
    <div className="space-y-4">
      {error && (
        <div className="alert alert-error">
          <span>{error}</span>
        </div>
      )}
      {sendAmount > 0 &&
        balance !== undefined &&
        sendAmount > balance &&
        !generatedToken && (
          <div className="alert alert-error">
            <span>Amount exceeds balance ({balance} bit available)</span>
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
              !sendAmount || sending || (balance !== undefined && sendAmount > balance)
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
              {tokenData.memo && (
                <div className="text-sm opacity-80">{tokenData.memo}</div>
              )}
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
            <CopyButton
              copyStr={generatedToken}
              text="Copy"
              className="btn btn-primary flex-1 gap-2"
            />
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
                <img src={qrCodeUrl} alt="Cashu Token QR Code" className="w-64 h-64" />
              </div>
            </div>
          )}
          <button className="btn btn-ghost w-full" onClick={onClose}>
            Done
          </button>
        </div>
      )}
    </div>
  )
}
