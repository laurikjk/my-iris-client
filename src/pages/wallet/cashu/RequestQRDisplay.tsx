import {useEffect, useState} from "react"

interface RequestQRDisplayProps {
  data: string
  fragment: string
  isAnimated: boolean
}

export function RequestQRDisplay({data, fragment, isAnimated}: RequestQRDisplayProps) {
  const [qrUrl, setQrUrl] = useState<string>("")

  useEffect(() => {
    const generateQR = async () => {
      const dataToEncode = isAnimated ? fragment : data
      if (!dataToEncode) {
        setQrUrl("")
        return
      }
      try {
        const QRCode = await import("qrcode")
        const url = await new Promise<string>((resolve, reject) => {
          QRCode.toDataURL(
            dataToEncode,
            {
              errorCorrectionLevel: "H",
              margin: 1,
              width: 256,
              color: {
                dark: "#000000",
                light: "#FFFFFF",
              },
            },
            (error, url) => {
              if (error) reject(error)
              else resolve(url)
            }
          )
        })
        setQrUrl(url)
      } catch (error) {
        console.error("Error generating QR code:", error)
      }
    }
    generateQR()
  }, [data, fragment, isAnimated])

  if (!qrUrl) return null

  return (
    <div className="flex justify-center">
      <div className="bg-white rounded-lg p-4">
        <img src={qrUrl} alt="Payment Request QR Code" className="w-64 h-64" />
      </div>
    </div>
  )
}
