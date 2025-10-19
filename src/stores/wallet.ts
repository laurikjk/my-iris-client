import {persist} from "zustand/middleware"
import {create} from "zustand"

import {WebLNProvider} from "@/types/global"

interface WalletState {
  balance: number | null
  provider: WebLNProvider | null
  showBalanceInNav: boolean

  setBalance: (balance: number | null) => void
  setProvider: (provider: WebLNProvider | null) => void
  setShowBalanceInNav: (show: boolean) => void
}

export const useWalletStore = create<WalletState>()(
  persist(
    (set) => {
      const initialState = {
        balance: null,
        provider: null,
        showBalanceInNav: true,
      }

      const actions = {
        setBalance: (balance: number | null) => set({balance}),
        setProvider: (provider: WebLNProvider | null) => set({provider}),
        setShowBalanceInNav: (show: boolean) => set({showBalanceInNav: show}),
      }

      return {
        ...initialState,
        ...actions,
      }
    },
    {
      name: "wallet-storage",
    }
  )
)
