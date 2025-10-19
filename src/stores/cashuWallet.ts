import {persist} from "zustand/middleware"
import {create} from "zustand"

type Tab = "history" | "mints"

interface CashuWalletState {
  expandHistory: boolean
  activeTab: Tab

  setExpandHistory: (expand: boolean) => void
  toggleExpandHistory: () => void
  setActiveTab: (tab: Tab) => void
}

export const useCashuWalletStore = create<CashuWalletState>()(
  persist(
    (set) => {
      const initialState = {
        expandHistory: false,
        activeTab: "history" as Tab,
      }

      const actions = {
        setExpandHistory: (expand: boolean) => set({expandHistory: expand}),
        toggleExpandHistory: () =>
          set((state) => ({expandHistory: !state.expandHistory})),
        setActiveTab: (tab: Tab) => set({activeTab: tab}),
      }

      return {
        ...initialState,
        ...actions,
      }
    },
    {
      name: "cashu-wallet-storage",
    }
  )
)
