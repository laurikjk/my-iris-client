import {useState, useEffect} from "react"
import {getCashuManager} from "@/lib/cashu/manager"
import type {Manager} from "@/lib/cashu/core/index"
import {formatUsd} from "@/pages/wallet/cashu/utils"
import {useWalletStore} from "@/stores/wallet"

interface CashuSendDialogProps {
  isOpen: boolean
  onClose: () => void
  onSendMessage: (message: string) => Promise<void>
  recipientPubKey?: string
}

export default function CashuSendDialog({
  isOpen,
  onClose,
  onSendMessage,
}: CashuSendDialogProps) {
  const [manager, setManager] = useState<Manager | null>(null)
  const [balance, setBalance] = useState<{[mintUrl: string]: number} | null>(null)
  const [usdRate, setUsdRate] = useState<number | null>(null)
  const [amount, setAmount] = useState<string>("")
  const [memo, setMemo] = useState<string>("")
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string>("")
  const {setBalance: setGlobalBalance} = useWalletStore()

  useEffect(() => {
    if (isOpen) {
      const mgr = getCashuManager()
      setManager(mgr)

      if (mgr) {
        mgr.wallet.getBalances().then(setBalance)
      }

      // Fetch USD rate
      fetch("https://api.coinbase.com/v2/exchange-rates?currency=BTC")
        .then((res) => res.json())
        .then((data) => setUsdRate(parseFloat(data.data.rates.USD)))
        .catch(console.error)
    }
  }, [isOpen])

  const totalBalance = balance
    ? Object.values(balance).reduce((sum, val) => sum + val, 0)
    : 0

  const handleSend = async () => {
    if (!manager || !amount) return

    const amountNum = parseInt(amount, 10)
    if (isNaN(amountNum) || amountNum <= 0) {
      setError("Please enter a valid amount")
      return
    }

    if (amountNum > totalBalance) {
      setError(`Insufficient balance. You have ${totalBalance} bit`)
      return
    }

    setSending(true)
    setError("")

    try {
      if (!balance) {
        throw new Error("No mint available")
      }

      // Select best mint for this payment
      const {selectMintForPayment} = await import("@/lib/cashu/mintSelection")
      const mintUrl = selectMintForPayment(balance, amountNum)

      const token = await manager.wallet.send(
        mintUrl,
        amountNum,
        memo.trim() || undefined
      )

      const {getEncodedToken} = await import("@cashu/cashu-ts")
      const encoded = getEncodedToken(token)

      // Save metadata if memo provided
      if (memo.trim()) {
        const {savePaymentMetadata} = await import("@/stores/paymentMetadata")
        await savePaymentMetadata(
          encoded,
          "other",
          undefined,
          undefined,
          memo.trim()
        ).catch((err) => console.warn("Failed to save metadata:", err))
      }

      // Send the token as a message immediately
      await onSendMessage(encoded)

      // Force balance refresh to update UI immediately
      const updatedBalances = await manager.wallet.getBalances()
      const newTotalBalance = Object.values(updatedBalances).reduce(
        (sum, val) => sum + val,
        0
      )
      setBalance(updatedBalances)
      setGlobalBalance(newTotalBalance)

      onClose()
      setAmount("")
      setMemo("")
    } catch (err) {
      console.error("Failed to create token:", err)
      setError(err instanceof Error ? err.message : "Failed to create token")
    } finally {
      setSending(false)
    }
  }

  const handleClose = () => {
    setAmount("")
    setMemo("")
    setError("")
    onClose()
  }

  if (!isOpen) return null

  return (
    <dialog className="modal modal-open">
      <div className="modal-box max-w-md">
        <h3 className="font-bold text-lg mb-4">Send ecash</h3>
        <div className="space-y-4">
          {/* Balance Display */}
          <div className="bg-base-300 rounded-lg p-4 text-center">
            <div className="text-sm text-base-content/60 mb-1">Balance</div>
            <div className="text-2xl font-bold">{totalBalance} bit</div>
            {usdRate && (
              <div className="text-sm text-base-content/60">
                {formatUsd(totalBalance, usdRate)}
              </div>
            )}
          </div>

          {/* Amount Input */}
          <div className="form-control">
            <label className="label">
              <span className="label-text">Amount (bits)</span>
            </label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="input input-bordered w-full"
              placeholder="Enter amount"
              min="1"
              step="1"
              disabled={sending}
            />
          </div>

          {/* Memo Input */}
          <div className="form-control">
            <label className="label">
              <span className="label-text">Memo (optional)</span>
            </label>
            <input
              type="text"
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              className="input input-bordered w-full"
              placeholder="Add a message"
              disabled={sending}
              maxLength={200}
            />
          </div>

          {error && (
            <div className="alert alert-error">
              <span>{error}</span>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 justify-end">
            <button onClick={handleClose} className="btn" disabled={sending}>
              Cancel
            </button>
            <button
              onClick={handleSend}
              className="btn btn-primary"
              disabled={sending || !amount || !manager}
            >
              {sending ? (
                <>
                  <span className="loading loading-spinner loading-sm" />
                  Sending...
                </>
              ) : (
                "Send"
              )}
            </button>
          </div>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button onClick={handleClose}>close</button>
      </form>
    </dialog>
  )
}
