import {useState, useEffect} from "react"
import type {Manager} from "@/lib/cashu/core/index"
import {getEncodedToken} from "@cashu/cashu-ts"
import {savePaymentMetadata} from "@/stores/paymentMetadata"
import {UserRow} from "@/shared/components/user/UserRow"

interface SendEcashFormProps {
  manager: Manager | null
  mintUrl: string
  balance?: number
  selectedUserPubkey: string | null
  requestedMint: string | null
  onTokenCreated: (token: string) => void
  initialAmount?: number
  initialNote?: string
}

export default function SendEcashForm({
  manager,
  mintUrl,
  balance,
  selectedUserPubkey,
  requestedMint,
  onTokenCreated,
  initialAmount = 0,
  initialNote = "",
}: SendEcashFormProps) {
  const [sendAmount, setSendAmount] = useState<number>(initialAmount)
  const [sendNote, setSendNote] = useState<string>(initialNote)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string>("")

  // Update state when initial values change (e.g., from payment request decode)
  useEffect(() => {
    if (initialAmount > 0) {
      setSendAmount(initialAmount)
    }
  }, [initialAmount])

  useEffect(() => {
    if (initialNote) {
      setSendNote(initialNote)
    }
  }, [initialNote])

  const sendEcash = async () => {
    if (!manager) return

    if (!sendAmount || sendAmount <= 0) {
      setError("Please enter a valid amount")
      return
    }

    setSending(true)
    setError("")
    try {
      // Determine which mint to use
      let useMint = mintUrl

      // If payment request specifies a mint, check if we have enough balance there
      if (requestedMint) {
        const balances = await manager.wallet.getBalances()
        const requestedBalance = balances[requestedMint] || 0

        if (requestedBalance >= sendAmount) {
          useMint = requestedMint
          console.log("✓ Using requested mint with sufficient balance:", requestedMint)
        } else {
          console.warn("⚠️ Insufficient balance on requested mint, using active mint:", {
            requested: requestedMint,
            requestedBalance,
            using: mintUrl,
          })
        }
      }

      const token = await manager.wallet.send(
        useMint,
        sendAmount,
        sendNote.trim() || undefined
      )
      const encoded = getEncodedToken(token)

      // Save note and recipient to paymentMetadata
      if (sendNote.trim() || selectedUserPubkey) {
        try {
          await savePaymentMetadata(
            encoded,
            "other",
            selectedUserPubkey || undefined,
            undefined,
            sendNote.trim() || undefined
          )
        } catch (err) {
          console.warn("Failed to save send note:", err)
        }
      }

      onTokenCreated(encoded)
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
      {selectedUserPubkey && (
        <div className="alert alert-info">
          <div className="flex flex-col gap-2 w-full">
            <div className="text-sm font-semibold">Payment Request From:</div>
            <UserRow pubKey={selectedUserPubkey} />
            {requestedMint && requestedMint !== mintUrl && (
              <div className="text-xs opacity-80 mt-1 bg-warning/20 p-2 rounded">
                ⚠️ Requested mint: {requestedMint.replace(/^https?:\/\//, "")}
                <br />
                Using: {mintUrl.replace(/^https?:\/\//, "")}
              </div>
            )}
            {requestedMint && requestedMint === mintUrl && (
              <div className="text-xs opacity-60 mt-1">
                ✓ Using requested mint: {mintUrl.replace(/^https?:\/\//, "")}
              </div>
            )}
          </div>
        </div>
      )}
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
    </div>
  )
}
