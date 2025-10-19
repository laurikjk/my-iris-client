import {lazy, Suspense} from "react"
import Modal from "@/shared/components/ui/Modal"

const QRScanner = lazy(() => import("@/shared/components/QRScanner"))

interface QRScannerModalProps {
  isOpen: boolean
  onClose: () => void
  onScanSuccess: (result: string) => void
}

export default function QRScannerModal({
  isOpen,
  onClose,
  onScanSuccess,
}: QRScannerModalProps) {
  if (!isOpen) return null

  return (
    <Modal onClose={onClose}>
      <div className="p-4">
        <h3 className="font-bold text-lg mb-4">Scan QR Code</h3>
        <div className="flex flex-col items-center">
          <div className="w-full max-w-sm aspect-square bg-base-200 rounded-lg overflow-hidden">
            <Suspense
              fallback={
                <div className="flex items-center justify-center w-full h-full">
                  <span>Loading camera...</span>
                </div>
              }
            >
              <QRScanner onScanSuccess={onScanSuccess} />
            </Suspense>
          </div>
          <p className="text-sm text-base-content/60 text-center mt-4">
            Scan a Cashu token or Lightning invoice
          </p>
        </div>
      </div>
    </Modal>
  )
}
