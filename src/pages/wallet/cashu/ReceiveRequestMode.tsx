import {useState} from "react"
import type {Manager} from "@/lib/cashu/core/index"
import {usePublicKey} from "@/stores/user"
import {truncateMiddle} from "@/utils/utils"
import {RiFileCopyLine, RiCheckLine} from "@remixicon/react"
import {
  PaymentRequest,
  PaymentRequestTransport,
  PaymentRequestTransportType,
} from "@cashu/cashu-ts"
import {useAnimatedQR} from "@/hooks/useAnimatedQR"
import {RequestQRDisplay} from "./RequestQRDisplay"
import {UserRow} from "@/shared/components/user/UserRow"

interface ReceiveRequestModeProps {
  manager: Manager | null
  mintUrl: string
  onClose: () => void
}

export default function ReceiveRequestMode({
  manager,
  mintUrl,
  onClose,
}: ReceiveRequestModeProps) {
  const myPubKey = usePublicKey()
  const [requestAmount, setRequestAmount] = useState<number | undefined>(undefined)
  const [requestDescription, setRequestDescription] = useState<string>("")
  const [paymentRequestString, setPaymentRequestString] = useState<string>("")
  const [requestCopied, setRequestCopied] = useState(false)
  const [receiving, setReceiving] = useState(false)
  const [error, setError] = useState<string>("")

  const {currentFragment: requestFragment, isAnimated: isRequestAnimated} =
    useAnimatedQR(paymentRequestString)

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

  if (paymentRequestString) {
    return (
      <div className="space-y-4">
        <div className="alert alert-info">
          <div className="flex flex-col gap-2 w-full">
            <div className="font-bold">Payment request created!</div>
            {myPubKey && (
              <>
                <div className="text-sm opacity-80">Requesting payment to:</div>
                <UserRow pubKey={myPubKey} />
              </>
            )}
          </div>
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
            onClose()
          }}
        >
          Done
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="alert alert-error">
          <span>{error}</span>
        </div>
      )}
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
            setRequestAmount(e.target.value ? Number(e.target.value) : undefined)
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
    </div>
  )
}
