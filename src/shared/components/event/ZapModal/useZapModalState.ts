import {useState} from "react"
import {useUserStore} from "@/stores/user"
import {useWalletProviderStore} from "@/stores/walletProvider"
import {useDonationCalculation} from "../hooks/useDonationCalculation"

export interface ZapModalProps {
  initialInvoice?: string
  initialAmount?: string
  paymentFailed?: boolean
}

export function useZapModalState(props: ZapModalProps) {
  const {initialInvoice, initialAmount} = props

  // User store state
  const {
    defaultZapAmount,
    setDefaultZapAmount,
    defaultZapComment,
    setDefaultZapComment,
    zapDonationEnabled,
    setZapDonationEnabled,
    zapDonationRecipients,
    zapDonationMinAmount,
  } = useUserStore()

  // Wallet provider state
  const {activeProviderType, sendPayment: walletProviderSendPayment} =
    useWalletProviderStore()

  // Check if we have any wallet available
  const hasWallet = activeProviderType !== "disabled" && activeProviderType !== undefined

  // UI state
  const [copiedPaymentRequest, setCopiedPaymentRequest] = useState(false)
  const [noAddress, setNoAddress] = useState(false)
  const [showQRCode, setShowQRCode] = useState(!!initialInvoice)
  const [bolt11Invoice, setBolt11Invoice] = useState<string>(initialInvoice || "")
  const [qrCodeUrl, setQrCodeUrl] = useState<string>("")

  // Form state
  const [zapAmount, setZapAmount] = useState<string>(
    initialAmount || (defaultZapAmount > 0 ? defaultZapAmount.toString() : "21")
  )
  const [customAmount, setCustomAmount] = useState<string>("")
  const [zapMessage, setZapMessage] = useState<string>(defaultZapComment || "")
  const [shouldSetDefault, setShouldSetDefault] = useState(false)
  const [shouldSetDefaultComment, setShouldSetDefaultComment] = useState(false)

  // Processing state
  const [isProcessing, setIsProcessing] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string>("")
  const [zapRefresh, setZapRefresh] = useState(false)

  // Calculate donation details
  const {donationPubkeys, totalDonationAmount, recipientNames, effectiveDonationAmount} =
    useDonationCalculation(
      zapDonationEnabled,
      zapDonationRecipients,
      zapDonationMinAmount,
      zapAmount
    )

  return {
    // User settings
    defaultZapAmount,
    setDefaultZapAmount,
    defaultZapComment,
    setDefaultZapComment,
    zapDonationEnabled,
    setZapDonationEnabled,
    zapDonationRecipients,
    zapDonationMinAmount,

    // Wallet
    hasWallet,
    activeProviderType,
    walletProviderSendPayment,

    // UI state
    copiedPaymentRequest,
    setCopiedPaymentRequest,
    noAddress,
    setNoAddress,
    showQRCode,
    setShowQRCode,
    bolt11Invoice,
    setBolt11Invoice,
    qrCodeUrl,
    setQrCodeUrl,

    // Form state
    zapAmount,
    setZapAmount,
    customAmount,
    setCustomAmount,
    zapMessage,
    setZapMessage,
    shouldSetDefault,
    setShouldSetDefault,
    shouldSetDefaultComment,
    setShouldSetDefaultComment,

    // Processing state
    isProcessing,
    setIsProcessing,
    errorMessage,
    setErrorMessage,
    zapRefresh,
    setZapRefresh,

    // Donation calculation
    donationPubkeys,
    totalDonationAmount,
    recipientNames,
    effectiveDonationAmount,
  }
}
