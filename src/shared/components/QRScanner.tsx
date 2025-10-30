import {useEffect, useRef, useState} from "react"
import jsQR from "jsqr"
import {URDecoder} from "@gandlaf21/bc-ur"

interface QRScannerProps {
  onScanSuccess: (result: string) => void
}

const QRScanner = ({onScanSuccess}: QRScannerProps) => {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const animationRef = useRef<number | null>(null)
  const urDecoderRef = useRef<URDecoder | null>(null)
  const [error, setError] = useState<string>("")
  const [urProgress, setUrProgress] = useState<number | null>(null)

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

              // Check if it's a UR (Uniform Resource) part from animated QR
              if (text.toLowerCase().startsWith("ur:bytes")) {
                // Initialize decoder if needed
                if (!urDecoderRef.current) {
                  urDecoderRef.current = new URDecoder()
                }

                try {
                  urDecoderRef.current.receivePart(text.toLowerCase())

                  // Update progress
                  const progress = urDecoderRef.current.estimatedPercentComplete()
                  setUrProgress(progress)

                  // Check if complete
                  if (urDecoderRef.current.isComplete()) {
                    if (urDecoderRef.current.isSuccess()) {
                      const ur = urDecoderRef.current.resultUR()
                      const decoded = ur.decodeCBOR()
                      const utf8 = new TextDecoder()
                      const result = utf8.decode(decoded)

                      // Reset decoder for next scan
                      urDecoderRef.current = null
                      setUrProgress(null)

                      onScanSuccess(result)
                    } else if (urDecoderRef.current.isError()) {
                      const errorMsg = urDecoderRef.current.resultError()
                      console.error("UR decode error:", errorMsg)
                      urDecoderRef.current = null
                      setUrProgress(null)
                      setError("Failed to decode animated QR code")
                    }
                  }
                } catch (err) {
                  console.error("Error processing UR part:", err)
                  urDecoderRef.current = null
                  setUrProgress(null)
                }
              } else {
                // Regular QR code (not animated)
                // Reset UR decoder if it was active
                urDecoderRef.current = null
                setUrProgress(null)
                onScanSuccess(text)
              }
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
    <div className="w-full h-full relative">
      {error ? (
        <div className="flex items-center justify-center h-full">
          <p className="text-red-500 text-center p-4">{error}</p>
        </div>
      ) : (
        <>
          <video ref={videoRef} className="w-full h-full object-cover" />
          <canvas ref={canvasRef} style={{display: "none"}} />
          {urProgress !== null && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/80 text-white px-4 py-2 rounded-lg">
              <div className="text-sm mb-1">Scanning animated QR...</div>
              <div className="w-48 h-2 bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all"
                  style={{width: `${urProgress * 100}%`}}
                />
              </div>
              <div className="text-xs mt-1 text-center">
                {Math.round(urProgress * 100)}%
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default QRScanner
