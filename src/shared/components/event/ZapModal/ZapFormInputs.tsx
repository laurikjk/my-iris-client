import {ChangeEvent} from "react"
import {DonationCheckbox} from "../DonationCheckbox"

interface ZapFormInputsProps {
  // Custom amount
  customAmount: string
  zapAmount: string
  onCustomAmountChange: (e: ChangeEvent<HTMLInputElement>) => void
  onConfirmCustomAmount: () => void

  // Message
  zapMessage: string
  onZapMessageChange: (e: ChangeEvent<HTMLInputElement>) => void

  // Default settings
  shouldSetDefault: boolean
  onSetDefaultAmount: (e: ChangeEvent<HTMLInputElement>) => void
  shouldSetDefaultComment: boolean
  onSetDefaultComment: (e: ChangeEvent<HTMLInputElement>) => void
  defaultZapComment: string

  // Donation
  zapDonationEnabled: boolean
  setZapDonationEnabled: (enabled: boolean) => void
  zapDonationRecipients: Array<{recipient: string; percentage: number}>
  donationPubkeys: string[]
  recipientNames: string[]
  totalDonationAmount: number

  // Processing
  isProcessing: boolean
  effectiveDonationAmount: number

  // Errors
  noAddress: boolean
  errorMessage: string
}

export function ZapFormInputs({
  customAmount,
  zapAmount,
  onCustomAmountChange,
  onConfirmCustomAmount,
  zapMessage,
  onZapMessageChange,
  shouldSetDefault,
  onSetDefaultAmount,
  shouldSetDefaultComment,
  onSetDefaultComment,
  defaultZapComment,
  zapDonationEnabled,
  setZapDonationEnabled,
  zapDonationRecipients,
  donationPubkeys,
  recipientNames,
  totalDonationAmount,
  isProcessing,
  effectiveDonationAmount,
  noAddress,
  errorMessage,
}: ZapFormInputsProps) {
  return (
    <>
      {noAddress && (
        <span className="text-red-500">The user has no lightning address.</span>
      )}
      {errorMessage && <span className="text-red-500">{errorMessage}</span>}

      <div className="flex gap-2">
        <input
          type="number"
          className="input input-bordered grow"
          value={customAmount}
          onChange={onCustomAmountChange}
          placeholder="Custom amount"
        />
        <button
          type="button"
          className="btn btn-neutral"
          onClick={onConfirmCustomAmount}
          disabled={
            !customAmount || Number(customAmount) <= 0 || customAmount === zapAmount
          }
        >
          Confirm
        </button>
      </div>

      <input
        type="text"
        className="input input-bordered w-full"
        value={zapMessage}
        onChange={onZapMessageChange}
        placeholder="Comment (optional)"
      />

      <label className="label cursor-pointer justify-start gap-2">
        <input
          type="checkbox"
          className="checkbox"
          checked={shouldSetDefault}
          onChange={onSetDefaultAmount}
        />
        <span className="label-text">Set as default zap amount</span>
      </label>

      <label className="label cursor-pointer justify-start gap-2">
        <input
          type="checkbox"
          className="checkbox"
          checked={shouldSetDefaultComment}
          onChange={onSetDefaultComment}
          disabled={!zapMessage.trim() || zapMessage.trim() === defaultZapComment}
        />
        <span className="label-text">Save comment as default</span>
      </label>

      <DonationCheckbox
        zapDonationEnabled={zapDonationEnabled}
        setZapDonationEnabled={setZapDonationEnabled}
        zapDonationRecipients={zapDonationRecipients}
        donationPubkeys={donationPubkeys}
        recipientNames={recipientNames}
        totalDonationAmount={totalDonationAmount}
      />

      <button type="submit" className="btn btn-primary w-full" disabled={isProcessing}>
        {(() => {
          if (isProcessing) {
            return <div className="loading loading-spinner loading-sm" />
          }
          if (zapDonationEnabled && effectiveDonationAmount > 0) {
            return `Zap ${Number(zapAmount) + effectiveDonationAmount} bits`
          }
          return `Zap ${zapAmount} bits`
        })()}
      </button>
    </>
  )
}
