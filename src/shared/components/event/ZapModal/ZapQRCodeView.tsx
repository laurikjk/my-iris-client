import {RiCheckLine, RiFileCopyLine} from "@remixicon/react"

interface ZapQRCodeViewProps {
  hasWallet: boolean
  errorMessage: string
  paymentFailed?: boolean
  zapAmount: string
  zapMessage: string
  qrCodeUrl: string
  bolt11Invoice: string
  copiedPaymentRequest: boolean
  onCopyPaymentRequest: () => void
}

export function ZapQRCodeView({
  hasWallet,
  errorMessage,
  paymentFailed,
  zapAmount,
  zapMessage,
  qrCodeUrl,
  bolt11Invoice,
  copiedPaymentRequest,
  onCopyPaymentRequest,
}: ZapQRCodeViewProps) {
  return (
    <div className="flex flex-col items-center gap-4">
      {hasWallet && !errorMessage && !paymentFailed && (
        <div className="alert alert-info">
          <div className="loading loading-spinner loading-sm"></div>
          <span>Attempting to pay with your wallet...</span>
        </div>
      )}
      {errorMessage && (
        <div className="alert alert-warning">
          <span>{errorMessage}</span>
        </div>
      )}
      <p className="text-center">
        {hasWallet ? "Or scan" : "Scan"} the QR code to zap <b>{zapAmount} bits</b>
        {zapMessage && (
          <>
            <br />
            <span className="text-sm opacity-70">&ldquo;{zapMessage}&rdquo;</span>
          </>
        )}
      </p>
      <div className="w-40 h-40">
        {qrCodeUrl && <img id="qr-image" className="w-40 h-40" src={qrCodeUrl} />}
      </div>
      <a href={`lightning:${bolt11Invoice}`} className="btn btn-primary w-full">
        Open in Wallet
      </a>
      <button className="btn btn-neutral gap-2 w-full" onClick={onCopyPaymentRequest}>
        {!copiedPaymentRequest ? <RiFileCopyLine /> : <RiCheckLine />}
        Copy Lightning Invoice
      </button>
    </div>
  )
}
