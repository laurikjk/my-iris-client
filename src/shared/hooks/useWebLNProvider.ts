import {onConnected} from "@getalby/bitcoin-connect"
import {WebLNProvider} from "@/types/global"
import {useEffect, useState} from "react"

let nwcUnsubscribe: (() => void) | null = null

export const useWebLNProvider = () => {
  const [provider, setProvider] = useState<WebLNProvider | null>(null)

  useEffect(() => {
    const checkNativeWebLN = async () => {
      if (window.webln) {
        try {
          const enabled = await window.webln.isEnabled()
          if (enabled) {
            setProvider(window.webln)
            return true
          }
        } catch (error) {
          console.warn("Failed to enable native WebLN provider:", error)
        }
      }
      return false
    }

    // Check native WebLN first
    checkNativeWebLN().then((hasNativeWebLN) => {
      if (!hasNativeWebLN) {
        // Only set up NWC if native WebLN is not available
        nwcUnsubscribe = onConnected(async (newProvider) => {
          try {
            const enabled = await newProvider.isEnabled()
            if (enabled) {
              setProvider(newProvider)
            }
          } catch (error) {
            console.warn("Failed to enable NWC provider:", error)
          }
        })
      }
    })

    return () => {
      if (nwcUnsubscribe) {
        nwcUnsubscribe()
        nwcUnsubscribe = null
      }
    }
  }, [])

  return provider
}
