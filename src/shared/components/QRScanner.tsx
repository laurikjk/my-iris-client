import {useEffect, useRef, useState} from "react"
import jsQR from "jsqr"

interface QRScannerProps {
  onScanSuccess: (result: string) => void
}

const QRScanner = ({onScanSuccess}: QRScannerProps) => {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [qrCodeResult, setQrCodeResult] = useState("")
  const streamRef = useRef<MediaStream | null>(null)
  const animationRef = useRef<number | null>(null)
  const [error, setError] = useState<string>("")

  useEffect(() => {
    // Set up canvas for processing video frames
    const canvas = canvasRef.current
    const video = videoRef.current
    if (!canvas || !video) return

    const ctx = canvas.getContext("2d", {willReadFrequently: true})
    if (!ctx) return

    // Start camera
    if (!navigator.mediaDevices?.getUserMedia) {
      console.error("Camera access not supported in this browser")
      return
    }

    navigator.mediaDevices
      .getUserMedia({
        video: {facingMode: "environment"}, // Use back camera if available
      })
      .then((stream) => {
        streamRef.current = stream
        video.srcObject = stream
        video.play()

        // Start scanning loop
        const scanQRCode = () => {
          if (video.readyState === video.HAVE_ENOUGH_DATA) {
            // Set canvas dimensions to match video
            canvas.height = video.videoHeight
            canvas.width = video.videoWidth

            // Draw current video frame to canvas
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

            // Get image data for QR processing
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)

            // Process with jsQR
            const code = jsQR(imageData.data, imageData.width, imageData.height, {
              inversionAttempts: "dontInvert", // Faster processing
            })

            if (code) {
              // QR code found
              const text = code.data
              setQrCodeResult(text)
              onScanSuccess(text)
            }
          }

          // Continue scanning
          animationRef.current = requestAnimationFrame(scanQRCode)
        }

        scanQRCode()
      })
      .catch((err) => {
        console.error("Error accessing camera:", err)
        setError(
          "Unable to access camera. Please make sure you have granted camera permissions."
        )
      })

    // Cleanup function
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop())
      }
    }
  }, [onScanSuccess])

  return (
    <div>
      <h1 className="text-center text-2xl mb-4">Scan QR</h1>
      {error ? (
        <p className="text-red-500 text-center">{error}</p>
      ) : (
        <>
          <video ref={videoRef} style={{width: "100%"}} />
          <canvas ref={canvasRef} style={{display: "none"}} />
          {qrCodeResult && <p>QR Code Result: {qrCodeResult}</p>}
        </>
      )}
    </div>
  )
}

export default QRScanner
