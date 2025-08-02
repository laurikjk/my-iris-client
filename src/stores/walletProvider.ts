import {create} from "zustand"
import {persist} from "zustand/middleware"
import {NDKNWCWallet, NDKWebLNWallet, NDKWallet} from "@nostr-dev-kit/ndk-wallet"
import NDK from "@nostr-dev-kit/ndk"

export type WalletProviderType = "native" | "nwc" | "disabled" | undefined

export interface NWCConnection {
  id: string
  name: string
  connectionString: string // nostr+walletconnect://...
  wallet?: NDKNWCWallet
  lastUsed?: number
  balance?: number
  isLocalCashuWallet?: boolean // true if this connection comes from bc:config
}

interface WalletProviderState {
  // Current active provider settings
  activeProviderType: WalletProviderType
  activeNWCId?: string

  // Provider instances
  nativeWallet: NDKWebLNWallet | null
  activeWallet: NDKWallet | null
  ndk: NDK | null

  // Saved NWC connections
  nwcConnections: NWCConnection[]

  // Actions
  setActiveProviderType: (type: WalletProviderType) => void
  setActiveNWCId: (id: string) => void
  setNativeWallet: (wallet: NDKWebLNWallet | null) => void
  setActiveWallet: (wallet: NDKWallet | null) => void

  // NWC connection management
  addNWCConnection: (connection: Omit<NWCConnection, "id">) => string
  removeNWCConnection: (id: string) => void
  updateNWCConnection: (id: string, updates: Partial<NWCConnection>) => void
  connectToNWC: (id: string) => Promise<boolean>
  disconnectCurrentProvider: () => Promise<void>

  // Provider initialization
  initializeProviders: () => Promise<void>
  refreshActiveProvider: () => Promise<void>
  startCashuNWCChecking: () => void
  checkCashuNWCConnection: () => boolean
  cleanup: () => void

  // Wallet operations
  sendPayment: (invoice: string) => Promise<{preimage?: string}>
  createInvoice: (amount: number, description?: string) => Promise<{invoice: string}>
  getBalance: () => Promise<number | null>
  getInfo: () => Promise<Record<string, unknown> | null>
}

export const useWalletProviderStore = create<WalletProviderState>()(
  persist(
    (set, get) => ({
      // Initial state
      activeProviderType: undefined,
      activeNWCId: undefined,
      nativeWallet: null,
      activeWallet: null,
      ndk: null,
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

      setNativeWallet: (wallet: NDKWebLNWallet | null) => {
        set({nativeWallet: wallet})
        if (get().activeProviderType === "native") {
          set({activeWallet: wallet})
        }
      },

      setActiveWallet: (wallet: NDKWallet | null) => {
        set({activeWallet: wallet})
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
            activeWallet: state.nativeWallet,
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

        console.log("🔌 Found connection string:", connection.connectionString)

        try {
          // Initialize NDK if not already done
          let ndk = state.ndk
          if (!ndk) {
            ndk = new NDK({
              explicitRelayUrls: [
                "wss://relay.damus.io",
                "wss://nos.lol",
                "wss://relay.nostr.band",
              ],
            })
            await ndk.connect()
            set({ndk})
          }

          // Parse the NWC connection string
          // Format: nostr+walletconnect://<pubkey>?relay=<relay>&secret=<secret>
          let pubkey: string | undefined
          let relayUrls: string[] | undefined
          let secret: string | undefined

          try {
            const url = new URL(connection.connectionString)
            pubkey = url.hostname || url.pathname.replace("/", "")

            // Get relay URLs - can be comma-separated
            const relayParam = url.searchParams.get("relay")
            if (relayParam) {
              relayUrls = relayParam
                .split(",")
                .map((r) => r.trim())
                .filter((r) => r.startsWith("wss://"))
            }

            secret = url.searchParams.get("secret") || undefined

            console.log("🔌 Parsed NWC parameters:", {pubkey, relayUrls, secret})

            // Validate that we have the required parameters
            if (!pubkey || !relayUrls || relayUrls.length === 0 || !secret) {
              throw new Error("Missing required NWC parameters: pubkey, relay, or secret")
            }
          } catch (parseError) {
            console.error(
              "❌ Failed to parse NWC connection string:",
              connection.connectionString,
              parseError
            )
            throw new Error(
              `Invalid NWC connection string format. Expected: nostr+walletconnect://<pubkey>?relay=<relay>&secret=<secret>`
            )
          }

          // Create NWC wallet
          const wallet = new NDKNWCWallet(ndk, {
            pubkey,
            relayUrls,
            secret,
          })

          // Update the connection with the wallet
          get().updateNWCConnection(id, {wallet})

          // Set as active
          set({
            activeProviderType: "nwc",
            activeNWCId: id,
            activeWallet: wallet,
          })

          console.log("✅ NWC connection successful!")
          return true
        } catch (error) {
          console.error("❌ Failed to connect to NWC:", error)
          return false
        }
      },

      disconnectCurrentProvider: async () => {
        const state = get()

        // Clean up active wallet
        if (state.activeWallet) {
          // NDK wallets don't need explicit disconnect
        }

        set({
          activeProviderType: "disabled",
          activeNWCId: undefined,
          activeWallet: null,
        })
      },

      initializeProviders: async () => {
        const state = get()
        console.log("🔍 Initializing providers. Current state:", {
          activeProviderType: state.activeProviderType,
          nwcConnectionsCount: state.nwcConnections.length,
          activeNWCId: state.activeNWCId,
        })

        // Initialize NDK
        if (!state.ndk) {
          const ndk = new NDK({
            explicitRelayUrls: [
              "wss://relay.damus.io",
              "wss://nos.lol",
              "wss://relay.nostr.band",
            ],
          })
          await ndk.connect()
          set({ndk})
        }

        // Start delayed Cashu NWC checking to give Cashu wallet time to initialize
        get().startCashuNWCChecking()

        // Only run wallet discovery if activeProviderType is undefined
        if (state.activeProviderType === undefined) {
          console.log("🔍 Starting wallet discovery...")

          // Check for native WebLN first
          if (window.webln) {
            try {
              const enabled = await window.webln.isEnabled()
              if (enabled) {
                const nativeWallet = new NDKWebLNWallet(state.ndk!)

                console.log("🔍 Found native WebLN, setting as active")
                set({
                  nativeWallet,
                  activeProviderType: "native",
                  activeWallet: nativeWallet,
                })
              }
            } catch (error) {
              console.warn("Failed to enable native WebLN provider:", error)
            }
          }
        } else {
          // Provider already selected, just update providers
          if (window.webln && !state.nativeWallet) {
            try {
              const enabled = await window.webln.isEnabled()
              if (enabled) {
                const nativeWallet = new NDKWebLNWallet(state.ndk!)
                set({nativeWallet})
                if (state.activeProviderType === "native") {
                  set({activeWallet: nativeWallet})
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
            console.log("🔄 Setting native wallet")
            set({activeWallet: state.nativeWallet})
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
                !!connection,
                "hasWallet:",
                !!connection?.wallet,
                "isLocalCashu:",
                !!connection?.isLocalCashuWallet
              )
              if (connection?.wallet) {
                console.log("🔄 Using existing NWC wallet")
                set({activeWallet: connection.wallet})
              } else if (state.activeNWCId) {
                console.log("🔄 Reconnecting to NWC:", state.activeNWCId)
                // Try to reconnect
                await get().connectToNWC(state.activeNWCId)
              }
            } else {
              console.log("🔄 No NWC ID set, clearing wallet")
              set({activeWallet: null})
            }
            break

          case "disabled":
          default:
            console.log("🔄 Disabling wallet")
            set({activeWallet: null})
            break
        }
      },

      startCashuNWCChecking: () => {
        const state = get()

        // Check if we already have a Cashu NWC connection
        const existingCashuConnection = state.nwcConnections.find(
          (conn) => conn.isLocalCashuWallet
        )

        if (existingCashuConnection) {
          return
        }

        console.log("🔍 Starting delayed Cashu NWC checking...")

        const timeoutIds: NodeJS.Timeout[] = []

        const scheduleCheck = (delay: number, attempt: number) => {
          const timeoutId = setTimeout(() => {
            console.log(`🔍 Cashu check attempt ${attempt} (${delay / 1000}s)`)
            const found = get().checkCashuNWCConnection()
            if (found) {
              console.log("🔍 Cashu NWC connection found, stopping further checks")
              // Clear any remaining scheduled checks
              timeoutIds.forEach((id) => clearTimeout(id))
            }
          }, delay)
          timeoutIds.push(timeoutId)
        }

        // Schedule checks at 3s, 5s, 10s, and 15s
        scheduleCheck(3000, 1)
        scheduleCheck(5000, 2)
        scheduleCheck(10000, 3)
        scheduleCheck(15000, 4)
      },

      checkCashuNWCConnection: (): boolean => {
        const state = get()
        console.log("🔍 Checking for Cashu NWC connection in localStorage...")

        try {
          const bcConfigString = localStorage.getItem("bc:config")
          if (bcConfigString) {
            console.log("🔍 Found bc:config in localStorage")
            const bcConfig = JSON.parse(bcConfigString)
            const cashuNWCString = bcConfig.nwcUrl

            if (cashuNWCString) {
              console.log(
                "🔍 Found Cashu NWC string:",
                cashuNWCString.substring(0, 50) + "..."
              )

              // Check if we already have this connection
              const existingConnection = state.nwcConnections.find(
                (conn) => conn.connectionString === cashuNWCString
              )

              if (existingConnection) {
                console.log("🔍 Cashu NWC connection already exists, setting as active")

                // Ensure existing connection has the isLocalCashuWallet flag
                if (!existingConnection.isLocalCashuWallet) {
                  console.log("🔍 Adding isLocalCashuWallet flag to existing connection")
                  get().updateNWCConnection(existingConnection.id, {
                    isLocalCashuWallet: true,
                  })
                }

                if (state.activeProviderType === undefined) {
                  set({
                    activeProviderType: "nwc",
                    activeNWCId: existingConnection.id,
                  })
                  get().refreshActiveProvider()
                }
                return true // Connection found and configured
              } else {
                console.log("🔍 Adding new Cashu NWC connection")
                const connectionId = get().addNWCConnection({
                  name: "Cashu Wallet",
                  connectionString: cashuNWCString,
                  isLocalCashuWallet: true,
                })

                // Set as active if no wallet type is selected yet
                if (state.activeProviderType === undefined) {
                  console.log("🔍 Setting Cashu NWC as active")
                  set({
                    activeProviderType: "nwc",
                    activeNWCId: connectionId,
                  })
                  get().refreshActiveProvider()
                } else {
                  console.log(
                    "🔍 Other wallet already active, Cashu NWC added but not set as active"
                  )
                }
                return true // New connection added
              }
            } else {
              console.log("🔍 No nwcUrl found in bc:config")
              return false
            }
          } else {
            console.log("🔍 No bc:config found in localStorage")
            return false
          }
        } catch (error) {
          console.warn("🔍 Error checking for Cashu NWC connection:", error)
          return false
        }
      },

      cleanup: () => {
        // NDK cleanup is handled automatically
      },

      // Wallet operations
      sendPayment: async (invoice: string) => {
        const {activeWallet, activeProviderType, nativeWallet} = get()

        // Handle NWC wallets
        if (activeProviderType === "nwc" && activeWallet instanceof NDKNWCWallet) {
          return await activeWallet.req("pay_invoice", {invoice})
        }

        // Handle native WebLN wallets (only if explicitly active)
        if (activeProviderType === "native" && nativeWallet) {
          if (
            "sendPayment" in nativeWallet &&
            typeof nativeWallet.sendPayment === "function"
          ) {
            return await nativeWallet.sendPayment(invoice)
          }
        }

        throw new Error("No active wallet configured for payment")
      },

      createInvoice: async (amount: number, description?: string) => {
        const {activeWallet} = get()

        if (!activeWallet) {
          throw new Error("No wallet connected")
        }

        // Check if it's an NWC wallet which has makeInvoice method
        if (activeWallet instanceof NDKNWCWallet) {
          return await activeWallet.makeInvoice(amount, description || "")
        } else {
          throw new Error("Invoice creation not supported for this wallet type")
        }
      },

      getBalance: async () => {
        try {
          const {activeWallet} = get()

          if (!activeWallet) {
            return null
          }

          // For NDK wallets, check if balance is available
          const balance = activeWallet.balance
          if (balance && typeof balance === "object" && "amount" in balance) {
            return (balance as {amount: number}).amount || 0
          }

          // If NDK wallet doesn't have balance yet, try to update it
          if (
            "updateBalance" in activeWallet &&
            typeof activeWallet.updateBalance === "function"
          ) {
            await activeWallet.updateBalance()
            const updatedBalance = activeWallet.balance
            if (
              updatedBalance &&
              typeof updatedBalance === "object" &&
              "amount" in updatedBalance
            ) {
              return (updatedBalance as {amount: number}).amount || 0
            }
          }

          return 0
        } catch (error) {
          console.error("Failed to get balance:", error)
          return null
        }
      },

      getInfo: async () => {
        try {
          const {activeWallet} = get()

          if (!activeWallet) {
            return null
          }

          // NDK wallets don't have a direct getInfo method
          return null
        } catch (error) {
          console.error("Failed to get wallet info:", error)
          return null
        }
      },
    }),
    {
      name: "wallet-provider-store",
      partialize: (state) => ({
        activeProviderType: state.activeProviderType,
        activeNWCId: state.activeNWCId,
        nwcConnections: state.nwcConnections.map((conn) => ({
          // Don't persist the wallet instance, only connection info
          id: conn.id,
          name: conn.name,
          connectionString: conn.connectionString,
          lastUsed: conn.lastUsed,
          balance: conn.balance,
          isLocalCashuWallet: conn.isLocalCashuWallet,
        })),
      }),
    }
  )
)
