import {useCashuWalletStore} from "@/stores/cashuWallet"

/**
 * Select the best mint for a payment based on:
 * 1. Active mint if it has sufficient balance
 * 2. First mint with sufficient balance
 * 3. Error if no mint has enough
 */
export function selectMintForPayment(
  balances: {[mintUrl: string]: number},
  requiredAmount: number
): string {
  const activeMint = useCashuWalletStore.getState().activeMint
  const mints = Object.keys(balances).filter((mint) => balances[mint] > 0)

  if (mints.length === 0) {
    throw new Error("No mints with balance available")
  }

  // Try active mint first if it has enough balance
  if (activeMint && balances[activeMint] >= requiredAmount) {
    return activeMint
  }

  // Find first mint with enough balance
  const mintUrl = mints.find((mint) => balances[mint] >= requiredAmount)

  if (!mintUrl) {
    const totalBalance = Object.values(balances).reduce((sum, bal) => sum + bal, 0)
    const maxSingleMintBalance = Math.max(...Object.values(balances))
    throw new Error(
      `Not enough balance in any single mint. Need ${requiredAmount} sats, but highest balance is ${maxSingleMintBalance} sats (total: ${totalBalance} sats).`
    )
  }

  return mintUrl
}
