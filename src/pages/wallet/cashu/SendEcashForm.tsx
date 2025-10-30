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
  onTokenCreated: (token: string) => void
  initialAmount?: number
  initialNote?: string
}

export default function SendEcashForm({
  manager,
  mintUrl,
  balance,
  selectedUserPubkey,
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

    if (balance !== undefined && sendAmount > balance) {
      setError(`Insufficient balance. You have ${balance} bit`)
      return
    }

    setSending(true)
    setError("")
    try {
      const token = await manager.wallet.send(
        mintUrl,
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
      {sendAmount > 0 && balance !== undefined && sendAmount > balance && (
        <div className="alert alert-error">
          <span>Amount exceeds balance ({balance} bit available)</span>
        </div>
      )}
      {selectedUserPubkey && (
        <div className="alert alert-info">
          <div className="flex flex-col gap-2 w-full">
            <div className="text-sm font-semibold">Payment Request From:</div>
            <UserRow pubKey={selectedUserPubkey} />
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
