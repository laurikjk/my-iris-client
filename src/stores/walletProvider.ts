import {create} from "zustand"
import {persist} from "zustand/middleware"
import {onConnected, disconnect} from "@getalby/bitcoin-connect"
import {WebLNProvider} from "@/types/global"

export type WalletProviderType = "native" | "nwc" | "disabled"

export interface NWCConnection {
  id: string
  name: string
  connectionString: string // nostr+walletconnect://...
  provider?: WebLNProvider
  lastUsed?: number
  balance?: number
}

interface WalletProviderState {
  // Current active provider settings
  activeProviderType: WalletProviderType
  activeNWCId?: string

  // Provider instances
  nativeProvider: WebLNProvider | null
  activeProvider: WebLNProvider | null

  // Saved NWC connections
  nwcConnections: NWCConnection[]

  // Actions
  setActiveProviderType: (type: WalletProviderType) => void
  setActiveNWCId: (id: string) => void
  setNativeProvider: (provider: WebLNProvider | null) => void
  setActiveProvider: (provider: WebLNProvider | null) => void

  // NWC connection management
  addNWCConnection: (connection: Omit<NWCConnection, "id">) => string
  removeNWCConnection: (id: string) => void
  updateNWCConnection: (id: string, updates: Partial<NWCConnection>) => void
  connectToNWC: (id: string) => Promise<boolean>
  disconnectCurrentProvider: () => Promise<void>

  // Provider initialization
  initializeProviders: () => Promise<void>
  refreshActiveProvider: () => Promise<void>
}

export const useWalletProviderStore = create<WalletProviderState>()(
  persist(
    (set, get) => ({
      // Initial state
      activeProviderType: "native",
      activeNWCId: undefined,
      nativeProvider: null,
      activeProvider: null,
      nwcConnections: [],

      setActiveProviderType: (type: WalletProviderType) => {
        console.log("🔄 Setting active provider type to:", type)
        set({activeProviderType: type})
        get().refreshActiveProvider()
      },

      setActiveNWCId: (id: string) => {
        console.log("🔄 Setting active NWC ID to:", id)
        set({activeNWCId: id})
        get().refreshActiveProvider()
      },

      setNativeProvider: (provider: WebLNProvider | null) => {
        set({nativeProvider: provider})
        if (get().activeProviderType === "native") {
          set({activeProvider: provider})
        }
      },

      setActiveProvider: (provider: WebLNProvider | null) => {
        set({activeProvider: provider})
      },

      addNWCConnection: (connection: Omit<NWCConnection, "id">) => {
        const id = `nwc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        const newConnection: NWCConnection = {
          ...connection,
          id,
          lastUsed: Date.now(),
        }

        set((state) => ({
          nwcConnections: [...state.nwcConnections, newConnection],
        }))

        return id
      },

      removeNWCConnection: (id: string) => {
        const state = get()

        // If removing the active NWC connection, switch to native
        if (state.activeNWCId === id) {
          set({
            activeProviderType: "native",
            activeNWCId: undefined,
            activeProvider: state.nativeProvider,
          })
        }

        set((state) => ({
          nwcConnections: state.nwcConnections.filter((conn) => conn.id !== id),
        }))
      },

      updateNWCConnection: (id: string, updates: Partial<NWCConnection>) => {
        set((state) => ({
          nwcConnections: state.nwcConnections.map((conn) =>
            conn.id === id ? {...conn, ...updates, lastUsed: Date.now()} : conn
          ),
        }))
      },

      connectToNWC: async (id: string): Promise<boolean> => {
        console.log("🔌 Starting NWC connection for ID:", id)
        const state = get()
        const connection = state.nwcConnections.find((conn) => conn.id === id)

        if (!connection) {
          console.warn(`❌ NWC connection ${id} not found`)
          return false
        }

        console.log(
          "🔌 Found connection:",
          connection.name,
          "connectionString:",
          connection.connectionString.substring(0, 50) + "..."
        )

        try {
          console.log("🔌 Creating direct NWC provider from connection string...")

          // Parse the connection string to create the provider directly
          const connectionString = connection.connectionString

          // Create NWC provider directly using the connection string
          // This bypasses bitcoin-connect's UI and connects directly

          console.log("🔌 Requesting provider with connection string...")

          // Set up bitcoin-connect with the connection string
          localStorage.setItem(
            "bc:config",
            JSON.stringify({
              nwcUrl: connectionString,
              connectorName: connection.name,
              connectorType: "nwc.generic",
            })
          )

          // Initialize bitcoin-connect
          const {init} = await import("@getalby/bitcoin-connect-react")
          init({
            appName: "Iris",
            filters: ["nwc"],
            showBalance: false,
          })

          console.log("🔌 Waiting for provider connection...")
          // Wait for provider connection
          return new Promise((resolve) => {
            const unsubscribe = onConnected(async (provider) => {
              console.log("🔌 Provider connected, checking capabilities...")
              console.log("🔌 Provider object:", provider)
              console.log("🔌 Provider methods:", Object.getOwnPropertyNames(provider))

              try {
                // Check if provider has the expected methods
                const hasGetBalance = typeof provider.getBalance === "function"
                const hasSendPayment = typeof provider.sendPayment === "function"

                console.log("🔌 Provider has getBalance:", hasGetBalance)
                console.log("🔌 Provider has sendPayment:", hasSendPayment)

                // For NWC providers, we don't need isEnabled, just check for required methods
                if (hasGetBalance && hasSendPayment) {
                  console.log("✅ NWC provider ready, updating connection...")
                  // Update the connection with the provider
                  get().updateNWCConnection(id, {provider})

                  // Set as active
                  set({
                    activeProviderType: "nwc",
                    activeNWCId: id,
                    activeProvider: provider,
                  })

                  console.log("✅ NWC connection successful!")
                  unsubscribe()
                  resolve(true)
                } else {
                  console.log("❌ Provider missing required methods")
                  unsubscribe()
                  resolve(false)
                }
              } catch (error) {
                console.warn("❌ Failed to check NWC provider:", error)
                unsubscribe()
                resolve(false)
              }
            })

            // Timeout after 10 seconds
            setTimeout(() => {
              console.log("⏰ NWC connection timeout after 10 seconds")
              unsubscribe()
              resolve(false)
            }, 10000)
          })
        } catch (error) {
          console.error("❌ Failed to connect to NWC:", error)
          return false
        }
      },

      disconnectCurrentProvider: async () => {
        try {
          await disconnect()
        } catch (error) {
          console.warn("Error disconnecting provider:", error)
        }

        set({
          activeProviderType: "disabled",
          activeNWCId: undefined,
          activeProvider: null,
        })
      },

      initializeProviders: async () => {
        const state = get()

        // Check for native WebLN
        if (window.webln) {
          try {
            const enabled = await window.webln.isEnabled()
            if (enabled && typeof window.webln.getBalance === "function") {
              set({nativeProvider: window.webln})

              // If active type is native, set as active provider
              if (state.activeProviderType === "native") {
                set({activeProvider: window.webln})
              }
            }
          } catch (error) {
            console.warn("Failed to enable native WebLN provider:", error)
          }
        }

        // Initialize active NWC connection if selected
        if (state.activeProviderType === "nwc" && state.activeNWCId) {
          await get().connectToNWC(state.activeNWCId)
        }
      },

      refreshActiveProvider: async () => {
        const state = get()
        console.log("🔄 Refreshing active provider. Current state:", {
          activeProviderType: state.activeProviderType,
          activeNWCId: state.activeNWCId,
          nwcConnectionsCount: state.nwcConnections.length,
        })

        switch (state.activeProviderType) {
          case "native":
            console.log("🔄 Setting native provider")
            set({activeProvider: state.nativeProvider})
            break

          case "nwc":
            if (state.activeNWCId) {
              const connection = state.nwcConnections.find(
                (c) => c.id === state.activeNWCId
              )
              console.log(
                "🔄 Looking for NWC connection:",
                state.activeNWCId,
                "found:",
                !!connection
              )
              if (connection?.provider) {
                console.log("🔄 Using existing NWC provider")
                set({activeProvider: connection.provider})
              } else if (state.activeNWCId) {
                console.log("🔄 Reconnecting to NWC:", state.activeNWCId)
                // Try to reconnect
                await get().connectToNWC(state.activeNWCId)
              }
            } else {
              console.log("🔄 No NWC ID set, clearing provider")
              set({activeProvider: null})
            }
            break

          case "disabled":
          default:
            console.log("🔄 Disabling provider")
            set({activeProvider: null})
            break
        }
      },
    }),
    {
      name: "wallet-provider-store",
      partialize: (state) => ({
        activeProviderType: state.activeProviderType,
        activeNWCId: state.activeNWCId,
        nwcConnections: state.nwcConnections.map((conn) => ({
          // Don't persist the provider instance, only connection info
          id: conn.id,
          name: conn.name,
          connectionString: conn.connectionString,
          lastUsed: conn.lastUsed,
          balance: conn.balance,
        })),
      }),
    }
  )
)
