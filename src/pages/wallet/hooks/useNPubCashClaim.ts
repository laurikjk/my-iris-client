import {useEffect} from "react"
import type {Manager} from "@/lib/cashu/core/index"
import {
  getNPubCashBalance,
  claimNPubCashTokens,
  extractMintFromToken,
} from "@/lib/npubcash"
import {ndk} from "@/utils/ndk"

export function useNPubCashClaim(
  myPubKey: string | null,
  manager: Manager | null,
  onRefresh: () => void
) {
  useEffect(() => {
    if (!myPubKey || !ndk().signer || !manager) return

    const checkAndClaim = async () => {
      const signer = ndk().signer
      if (!signer) return

      try {
        const balance = await getNPubCashBalance(signer)

        // Auto-claim if balance > 0
        if (balance > 0) {
          const token = await claimNPubCashTokens(signer)
          if (token) {
            // Extract mint URL from token and ensure it's added
            const mintUrl = await extractMintFromToken(token)
            if (mintUrl) {
              try {
                await manager.mint.addMint(mintUrl)
                console.log(`✅ Auto-added mint from npub.cash token: ${mintUrl}`)
              } catch (error) {
                console.log(`Mint already exists or failed to add: ${mintUrl}`)
              }
            }

            await manager.wallet.receive(token)
            onRefresh()
          }
        }
      } catch (error) {
        console.error("Failed to check/claim npub.cash:", error)
      }
    }

    checkAndClaim()

    // Check every 60 seconds
    const balanceInterval = setInterval(checkAndClaim, 60000)

    return () => clearInterval(balanceInterval)
  }, [myPubKey, manager, onRefresh])
}
