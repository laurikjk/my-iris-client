import {useEffect} from "react"

export function useZapReceiptPoller(showQRCode: boolean, fetchZapReceipt: () => void) {
  useEffect(() => {
    const timer = setInterval(() => {
      fetchZapReceipt()
    }, 2500)

    return () => {
      clearInterval(timer)
    }
  }, [showQRCode])
}
