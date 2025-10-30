import {useState} from "react"
import type {Manager} from "@/lib/cashu/core/index"
import Modal from "@/shared/components/ui/Modal"
import ReceiveEcashMode from "./ReceiveEcashMode"
import ReceiveLightningMode from "./ReceiveLightningMode"
import ReceiveRequestMode from "./ReceiveRequestMode"

interface ReceiveDialogProps {
  isOpen: boolean
  onClose: () => void
  manager: Manager | null
  mintUrl: string
  onSuccess: () => void
  initialToken?: string
  initialInvoice?: string
  balance?: number
  onScanRequest?: () => void
}

export default function ReceiveDialog({
  isOpen,
  onClose,
  manager,
  mintUrl,
  onSuccess,
  initialToken,
  initialInvoice,
  onScanRequest,
}: ReceiveDialogProps) {
  const [receiveMode, setReceiveMode] = useState<
    "select" | "ecash" | "lightning" | "request"
  >("select")

  const handleClose = () => {
    onClose()
    setReceiveMode("select")
  }

  const getTitle = () => {
    if (receiveMode === "ecash") return "Receive Ecash"
    if (receiveMode === "request") return "Create Payment Request"
    if (receiveMode === "lightning") return "Receive Lightning"
    return "Receive"
  }

  const handleBack = () => {
    if (receiveMode === "request") {
      setReceiveMode("ecash")
    } else {
      setReceiveMode("select")
    }
  }

  const showBackButton = receiveMode !== "select"

  if (!isOpen) return null

  return (
    <Modal onClose={handleClose}>
      <div className="p-4">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2">
            {showBackButton && (
              <button onClick={handleBack} className="btn btn-ghost btn-sm btn-circle">
                ←
              </button>
            )}
            <div>
              <h3 className="font-bold text-lg">{getTitle()}</h3>
              <div className="text-xs opacity-60 mt-1">
                {mintUrl.replace(/^https?:\/\//, "")}
              </div>
            </div>
          </div>
        </div>

        {receiveMode === "select" && (
          <div className="space-y-4">
            <button
              className="btn btn-outline w-full justify-start"
              onClick={() => setReceiveMode("ecash")}
            >
              <svg
                className="w-5 h-5 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              Ecash
            </button>

            <button
              className="btn btn-outline w-full justify-start"
              onClick={() => setReceiveMode("lightning")}
            >
              <svg
                className="w-5 h-5 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
              Lightning
            </button>
          </div>
        )}

        {receiveMode === "ecash" && (
          <ReceiveEcashMode
            manager={manager}
            onSuccess={onSuccess}
            onClose={handleClose}
            onScanRequest={onScanRequest}
            initialToken={initialToken}
          />
        )}

        {receiveMode === "lightning" && (
          <ReceiveLightningMode
            manager={manager}
            mintUrl={mintUrl}
            onClose={handleClose}
            initialInvoice={initialInvoice}
          />
        )}

        {receiveMode === "request" && (
          <ReceiveRequestMode manager={manager} mintUrl={mintUrl} onClose={handleClose} />
        )}
      </div>
    </Modal>
  )
}
