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
    <Modal onClose={onClose} hasBackground={false}>
      <div className="flex flex-col items-center justify-center p-6 bg-gradient-to-br from-purple-600 to-blue-600 rounded-lg min-h-[500px]">
        <h2 className="text-2xl font-bold text-white mb-6">Scan QR Code</h2>
        <div className="bg-white rounded-2xl p-1 shadow-2xl">
          <div className="w-80 h-80 rounded-2xl overflow-hidden relative">
            <Suspense
              fallback={
                <div className="flex items-center justify-center w-full h-full bg-gray-100">
                  <span className="text-gray-600">Loading camera...</span>
                </div>
              }
            >
              <QRScanner onScanSuccess={onScanSuccess} />
            </Suspense>
          </div>
        </div>
        <p className="text-white text-center mt-6">
          Scan a Cashu token or Lightning invoice
        </p>
      </div>
    </Modal>
  )
}
