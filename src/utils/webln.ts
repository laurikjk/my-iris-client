import {WebLNProvider} from "@/types/global"

let nwcProvider: WebLNProvider | null = null

export const getWebLNProvider = async (): Promise<WebLNProvider | null> => {
  if (nwcProvider) {
    return nwcProvider
  }

  if (window.webln) {
    const enabled = await window.webln.isEnabled()
    if (enabled) {
      return window.webln
    }
  }

  try {
    const {requestProvider} = await import("@getalby/bitcoin-connect")
    nwcProvider = await requestProvider()
    return nwcProvider
  } catch (error) {
    console.warn("Failed to get NWC provider:", error)
  }

  return null
}

export const isWebLNEnabled = async (): Promise<boolean> => {
  const provider = await getWebLNProvider()
  return !!provider
}
