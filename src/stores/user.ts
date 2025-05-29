import {persist} from "zustand/middleware"
import {create} from "zustand"

interface UserState {
  publicKey: string
  privateKey: string

  nip07Login: boolean

  DHTPublicKey: string
  DHTPrivateKey: string

  relays: string[]
  mediaserver: string
  blossomServers: string[]
  defaultBlossomServer: string

  walletConnect: boolean
  cashuEnabled: boolean
  defaultZapAmount: number

  hasHydrated: boolean

  setPublicKey: (publicKey: string) => void
  setPrivateKey: (privateKey: string) => void
  setNip07Login: (nip07Login: boolean) => void
  setDHTPublicKey: (DHTPublicKey: string) => void
  setDHTPrivateKey: (DHTPrivateKey: string) => void
  setRelays: (relays: string[]) => void
  setMediaserver: (mediaserver: string) => void
  setBlossomServers: (servers: string[]) => void
  setDefaultBlossomServer: (server: string) => void
  addBlossomServer: (server: string) => void
  removeBlossomServer: (server: string) => void
  setWalletConnect: (walletConnect: boolean) => void
  setCashuEnabled: (cashuEnabled: boolean) => void
  setDefaultZapAmount: (defaultZapAmount: number) => void
  reset: () => void
}

export const useUserStore = create<UserState>()(
  persist(
    (set) => {
      const initialState = {
        publicKey: "",
        privateKey: "",
        nip07Login: false,
        DHTPublicKey: "",
        DHTPrivateKey: "",
        relays: [],
        mediaserver: "",
        blossomServers: ["https://nostr.build"],
        defaultBlossomServer: "https://nostr.build",
        walletConnect: false,
        cashuEnabled: false,
        defaultZapAmount: 21,
        hasHydrated: false,
      }

      const actions = {
        setPublicKey: (publicKey: string) => set({publicKey}),
        setPrivateKey: (privateKey: string) => set({privateKey}),
        setNip07Login: (nip07Login: boolean) => set({nip07Login}),
        setDHTPublicKey: (DHTPublicKey: string) => set({DHTPublicKey}),
        setDHTPrivateKey: (DHTPrivateKey: string) => set({DHTPrivateKey}),
        setRelays: (relays: string[]) => set({relays}),
        setMediaserver: (mediaserver: string) => set({mediaserver}),
        setBlossomServers: (blossomServers: string[]) => set({blossomServers}),
        setDefaultBlossomServer: (defaultBlossomServer: string) =>
          set({defaultBlossomServer}),
        addBlossomServer: (server: string) =>
          set((state) => ({
            blossomServers: [...new Set([...state.blossomServers, server])],
          })),
        removeBlossomServer: (server: string) =>
          set((state) => ({
            blossomServers: state.blossomServers.filter((s) => s !== server),
          })),
        setWalletConnect: (walletConnect: boolean) => set({walletConnect}),
        setCashuEnabled: (cashuEnabled: boolean) => set({cashuEnabled}),
        setDefaultZapAmount: (defaultZapAmount: number) => set({defaultZapAmount}),
        reset: () => set(initialState),
      }

      return {
        ...initialState,
        ...actions,
      }
    },
    {
      name: "user-storage",
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.hasHydrated = true
        }
      },
    }
  )
)

export const usePublicKey = () => useUserStore((state) => state.publicKey)
export const usePrivateKey = () => useUserStore((state) => state.privateKey)
export const useNip07Login = () => useUserStore((state) => state.nip07Login)
export const useRelays = () => useUserStore((state) => state.relays)
export const useWalletConnect = () => useUserStore((state) => state.walletConnect)
export const useCashuEnabled = () => useUserStore((state) => state.cashuEnabled)
export const useDefaultZapAmount = () => useUserStore((state) => state.defaultZapAmount)
export const useReset = () => useUserStore((state) => state.reset)
