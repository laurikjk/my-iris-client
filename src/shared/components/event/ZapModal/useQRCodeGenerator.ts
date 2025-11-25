import {useEffect} from "react"
import {createDebugLogger} from "@/utils/createDebugLogger"
import {DEBUG_NAMESPACES} from "@/utils/constants"

const {error} = createDebugLogger(DEBUG_NAMESPACES.UTILS)

export function useQRCodeGenerator(
  showQRCode: boolean,
  bolt11Invoice: string,
  setQrCodeUrl: (url: string) => void,
  setErrorMessage: (message: string) => void
) {
  useEffect(() => {
    if (showQRCode && bolt11Invoice) {
      const generateQRCode = async () => {
        try {
          const QRCode = await import("qrcode")
          QRCode.toDataURL(`lightning:${bolt11Invoice}`, function (err, url) {
            if (err) {
              setErrorMessage("Failed to generate QR code")
              error("Error generating QR code:", err)
            } else {
              setQrCodeUrl(url)
            }
          })
        } catch (err) {
          setErrorMessage("Failed to generate QR code")
          error("Error importing QRCode:", err)
        }
      }
      generateQRCode()
    }
  }, [showQRCode, bolt11Invoice])
}
