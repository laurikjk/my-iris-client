import {useMemo} from "react"
import {nip19} from "nostr-tools"

interface DonationRecipient {
  recipient: string
  percentage: number
}

export function useDonationCalculation(
  zapDonationEnabled: boolean,
  zapDonationRecipients: DonationRecipient[],
  zapDonationMinAmount: number,
  zapAmount: string
) {
  return useMemo(() => {
    if (zapDonationRecipients.length === 0) {
      return {
        donationPubkeys: [],
        totalDonationAmount: 0,
        recipientNames: [],
        effectiveDonationAmount: 0,
      }
    }

    const calculateMultiRecipientDonations = (
      zapAmount: number,
      recipients: DonationRecipient[],
      minAmount: number
    ) => {
      return recipients.map(({recipient, percentage}) => {
        const calculatedAmount = Math.floor((zapAmount * percentage) / 100)
        const finalAmount = Math.max(calculatedAmount, minAmount)
        return {recipient, amount: finalAmount}
      })
    }

    const donations = calculateMultiRecipientDonations(
      Number(zapAmount),
      zapDonationRecipients,
      zapDonationMinAmount
    )

    const pubkeys: string[] = []
    const names: string[] = []

    donations.forEach(({recipient}) => {
      if (recipient.startsWith("npub")) {
        try {
          const decoded = nip19.decode(recipient)
          if (decoded.type === "npub") {
            pubkeys.push(decoded.data)
            names.push(recipient)
          }
        } catch {
          names.push(recipient)
        }
      } else {
        names.push(recipient)
      }
    })

    const total = donations.reduce((sum, d) => sum + d.amount, 0)
    const effectiveTotal = zapDonationEnabled ? total : 0
    return {
      donationPubkeys: pubkeys,
      totalDonationAmount: total,
      recipientNames: names,
      effectiveDonationAmount: effectiveTotal,
    }
  }, [zapDonationEnabled, zapDonationRecipients, zapDonationMinAmount, zapAmount])
}
