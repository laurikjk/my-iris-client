import {useState, useEffect} from "react"
import {RiBitCoinFill, RiLockLine} from "@remixicon/react"
import Embed, {type EmbedComponentProps} from "./index.ts"

function CashuTokenComponent({match, key, event}: EmbedComponentProps) {
  const [amount, setAmount] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>("")
  const [copied, setCopied] = useState(false)
  const [redeeming, setRedeeming] = useState(false)
  const [redeemed, setRedeemed] = useState(false)
  const [p2pkLock, setP2pkLock] = useState<string | null>(null)
  const [canRedeem, setCanRedeem] = useState(true)
  const [memo, setMemo] = useState<string>("")

  // Decode on mount and check if already redeemed
  useEffect(() => {
    const decodeToken = async () => {
      setLoading(true)
      try {
        const trimmedToken = match.trim()

        // Check if already redeemed (has sender metadata = was received)
        const {getPaymentMetadata} = await import("@/stores/paymentMetadata")
        const metadata = await getPaymentMetadata(trimmedToken)
        if (metadata?.sender) {
          setRedeemed(true)
        }

        const {getDecodedToken} = await import("@cashu/cashu-ts")
        const decoded = getDecodedToken(trimmedToken)

        // Calculate total amount and check for P2PK locks
        let totalAmount = 0
        let lockedPubkey: string | null = null

        const checkProofsForP2PK = (
          proofs: Array<{amount?: number; secret?: string}>
        ) => {
          for (const proof of proofs) {
            totalAmount += proof.amount || 0

            // Check if proof has P2PK lock
            if (proof.secret && typeof proof.secret === "string") {
              try {
                // P2PK secrets are JSON with format: ["P2PK", {"nonce":"...","data":"<pubkey>","tags":[...]}]
                const secretData = JSON.parse(proof.secret)
                if (Array.isArray(secretData) && secretData[0] === "P2PK") {
                  const p2pkData = secretData[1]
                  if (p2pkData?.data) {
                    lockedPubkey = p2pkData.data
                  }
                }
              } catch {
                // Not a P2PK secret, continue
              }
            }
          }
        }

        if (decoded.proofs && Array.isArray(decoded.proofs)) {
          checkProofsForP2PK(decoded.proofs)
        } else if (decoded.token && Array.isArray(decoded.token)) {
          for (const tokenEntry of decoded.token) {
            if (tokenEntry.proofs && Array.isArray(tokenEntry.proofs)) {
              checkProofsForP2PK(tokenEntry.proofs)
            }
          }
        }

        setAmount(totalAmount)
        setP2pkLock(lockedPubkey)
        setMemo(decoded.memo || "")

        // Check if we can redeem (only if locked to our pubkey)
        if (lockedPubkey) {
          const {useUserStore} = await import("@/stores/user")
          const myPubKey = useUserStore.getState().publicKey
          setCanRedeem(lockedPubkey === myPubKey)
        }
      } catch (err) {
        console.error("❌ Failed to decode cashu token:", err)
        setError(err instanceof Error ? err.message : "Invalid token")
      } finally {
        setLoading(false)
      }
    }

    decodeToken()
  }, [match])

  const handleRedeem = async () => {
    setRedeeming(true)
    setError("")
    try {
      const {getCashuManager} = await import("@/lib/cashu/manager")
      const manager = getCashuManager()

      if (!manager) {
        setError("Wallet not initialized")
        return
      }

      const trimmedToken = match.trim()

      // Save metadata BEFORE redeeming so it's available when history entry is created
      const {getPaymentMetadata, savePaymentMetadata} = await import(
        "@/stores/paymentMetadata"
      )

      // Check if we have send metadata for this token (means we sent it originally)
      const existingMetadata = await getPaymentMetadata(trimmedToken)

      // Determine sender: if redeeming our own token, use our pubkey
      // Otherwise use event author (or undefined if can't determine)
      const {useUserStore} = await import("@/stores/user")
      const myPubKey = useUserStore.getState().publicKey

      let senderPubkey: string | undefined
      if (existingMetadata?.recipient) {
        // We sent this token originally, now redeeming it ourselves
        senderPubkey = myPubKey
      } else if (event?.pubkey) {
        // Normal receive from someone else (NDKEvent with pubkey)
        senderPubkey = event.pubkey
      } else {
        // Rumor (encrypted DM) - pubkey not directly available
        // For now, leave undefined (could be enhanced with chat context)
        senderPubkey = undefined
      }

      // Extract message from token memo field or event content (fallback)
      let message: string | undefined = memo // Use memo from token

      // Fallback: extract from event content if memo is empty
      if (!message && event?.content) {
        const tokenMatch = event.content.match(/cashu[A-Za-z0-9_-]+/)
        if (tokenMatch) {
          const afterToken = event.content
            .slice(tokenMatch.index! + tokenMatch[0].length)
            .trim()
          if (afterToken) {
            message = afterToken.slice(0, 200) // Limit to 200 chars
          }
        }
      }

      await savePaymentMetadata(
        trimmedToken,
        "dm",
        undefined,
        undefined,
        message,
        undefined,
        senderPubkey
      )

      await manager.wallet.receive(trimmedToken)

      // Force balance refresh to update UI immediately
      const {useWalletStore} = await import("@/stores/wallet")
      const updatedBalances = await manager.wallet.getBalances()
      const newTotalBalance = Object.values(updatedBalances).reduce(
        (sum, val) => sum + val,
        0
      )
      useWalletStore.getState().setBalance(newTotalBalance)

      setRedeemed(true)
    } catch (err) {
      console.error("Failed to redeem token:", err)
      setError(err instanceof Error ? err.message : "Failed to redeem")
    } finally {
      setRedeeming(false)
    }
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(match)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div
      key={key}
      className="cashu-token-embed flex flex-col gap-3 p-4 bg-base-200 rounded-lg border border-base-300 my-2"
    >
      <div className="flex items-center gap-3">
        <div className="flex-shrink-0">
          <RiBitCoinFill className="w-10 h-10 text-warning" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-base flex items-center gap-2">
            Cashu Ecash Token
            {p2pkLock && (
              <span className="inline-flex items-center gap-1 text-xs font-normal bg-base-300 px-2 py-0.5 rounded">
                <RiLockLine className="w-3 h-3" />
                P2PK
              </span>
            )}
          </div>
          <div className="text-sm text-base-content/70">
            {loading && "Decoding token..."}
            {error && <span className="text-error">{error}</span>}
            {redeemed ? (
              <>
                <span className="text-success">Redeemed</span>
                {memo && <span className="block text-xs mt-1">{memo}</span>}
              </>
            ) : (
              amount !== null &&
              !error && (
                <>
                  <span className="font-medium text-success">{amount} bits</span>
                  {memo && <span className="block text-xs mt-1">{memo}</span>}
                </>
              )
            )}
            {p2pkLock && !canRedeem && !redeemed && (
              <span className="block text-xs text-warning mt-1">
                Locked to another key
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="flex gap-2">
        <button
          onClick={handleCopy}
          className="btn btn-ghost btn-sm flex-1"
          disabled={loading || redeemed}
        >
          {copied ? "Copied!" : "Copy"}
        </button>
        {canRedeem ? (
          <button
            onClick={handleRedeem}
            className="btn btn-primary btn-sm flex-1 disabled:opacity-50"
            disabled={loading || !!error || redeeming || redeemed}
          >
            {redeeming ? "Redeeming..." : "Redeem"}
          </button>
        ) : (
          <button
            className="btn btn-disabled btn-sm flex-1"
            disabled
            title="Token is locked to a different public key"
          >
            Locked
          </button>
        )}
      </div>
    </div>
  )
}

const CashuToken: Embed = {
  regex: /(cashu[A-Za-z0-9_-]+)/gi,
  component: CashuTokenComponent,
  settingsKey: "cashu",
}

export default CashuToken
