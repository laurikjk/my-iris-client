import {create} from "zustand"
import {persist} from "zustand/middleware"
import {NDKWebLNWallet} from "@nostr-dev-kit/ndk-wallet"
import {ndk} from "@/utils/ndk"
import {SimpleNWCWallet} from "@/utils/nwc"
import throttle from "lodash/throttle"

export type WalletProviderType = "native" | "nwc" | "disabled" | undefined

export interface NWCConnection {
  id: string
  name: string
  connectionString: string // nostr+walletconnect://...
  wallet?: SimpleNWCWallet
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
  activeWallet: NDKWebLNWallet | SimpleNWCWallet | null

  // Saved NWC connections
  nwcConnections: NWCConnection[]

  // Actions
  setActiveProviderType: (type: WalletProviderType) => void
  setActiveNWCId: (id: string) => void
  setNativeWallet: (wallet: NDKWebLNWallet | null) => void
  setActiveWallet: (wallet: NDKWebLNWallet | SimpleNWCWallet | null) => void

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
  getBalance: () => Promise<number | null | undefined>
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
      nwcConnections: [],

      setActiveProviderType: (type: WalletProviderType) => {
        console.log("🔄 Setting active provider type to:", type)
        const prevType = get().activeProviderType
        console.log("🔄 Previous provider type was:", prevType)
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

      setActiveWallet: (wallet: NDKWebLNWallet | SimpleNWCWallet | null) => {
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

        console.log("🔌 Found connection:", {
          name: connection.name,
          isLocalCashu: connection.isLocalCashuWallet,
          hasWallet: !!connection.wallet,
          connectionStringLength: connection.connectionString?.length,
        })

        try {
          // Initialize NDK if not already done
          // Use global NDK instance
          ndk()

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

          // Create our simple NWC wallet
          console.log("🔌 Creating SimpleNWCWallet with:", {
            pubkey,
            relayUrls,
            hasSecret: !!secret,
          })

          const wallet = new SimpleNWCWallet({
            pubkey,
            relayUrls,
            secret,
          })

          // Connect the wallet
          await wallet.connect()

          console.log("🔌 SimpleNWCWallet created and connected:", {
            walletExists: !!wallet,
            walletType: wallet?.constructor?.name,
          })

          // Update the connection with the wallet
          get().updateNWCConnection(id, {wallet})

          // Set as active
          set({
            activeProviderType: "nwc",
            activeNWCId: id,
            activeWallet: wallet,
          })

          // Verify the state was updated
          const newState = get()
          console.log("🔌 State after setting wallet:", {
            hasActiveWallet: !!newState.activeWallet,
            activeWalletType: newState.activeWallet?.constructor?.name,
            activeNWCId: newState.activeNWCId,
            activeProviderType: newState.activeProviderType,
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
          hasActiveWallet: !!state.activeWallet,
          hasNativeWallet: !!state.nativeWallet,
        })

        // Use the global NDK instance - it's already initialized and connected
        const ndkInstance = ndk()
        console.log("🔍 Using global NDK instance:", !!ndkInstance)

        // Start delayed Cashu NWC checking to give Cashu wallet time to initialize
        console.log("🔍 About to call startCashuNWCChecking...")
        get().startCashuNWCChecking()
        console.log("🔍 Returned from startCashuNWCChecking, continuing...")

        // Only run wallet discovery if activeProviderType is undefined
        if (state.activeProviderType === undefined) {
          console.log("🔍 Starting wallet discovery...")

          // Check for native WebLN first
          if (window.webln) {
            try {
              const enabled = await window.webln.isEnabled()
              if (enabled) {
                const nativeWallet = new NDKWebLNWallet(ndk())

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
        }

        // Also handle already-selected providers (not in else block anymore)
        if (
          state.activeProviderType !== undefined &&
          state.activeProviderType !== "disabled"
        ) {
          console.log("🔍 Provider already selected, updating providers...")
          console.log("🔍 Checking conditions for NWC init:", {
            activeProviderType: state.activeProviderType,
            isNWC: state.activeProviderType === "nwc",
            activeNWCId: state.activeNWCId,
            hasActiveNWCId: !!state.activeNWCId,
            condition: state.activeProviderType === "nwc" && state.activeNWCId,
          })

          // Provider already selected, just update providers
          if (window.webln && !state.nativeWallet) {
            try {
              const enabled = await window.webln.isEnabled()
              if (enabled) {
                const nativeWallet = new NDKWebLNWallet(ndk())
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
            console.log("🔍 Initializing active NWC connection:", state.activeNWCId)
            console.log(
              "🔍 Available NWC connections:",
              state.nwcConnections.map((c) => ({
                id: c.id,
                name: c.name,
                hasWallet: !!c.wallet,
                isLocalCashu: c.isLocalCashuWallet,
              }))
            )
            const success = await get().connectToNWC(state.activeNWCId)
            console.log("🔍 NWC connection result:", success)
            console.log("🔍 Active wallet after connection:", !!get().activeWallet)
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
          console.log("🔍 Already have Cashu NWC connection, skipping check")
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

        // Handle NWC wallets with our SimpleNWCWallet
        if (activeProviderType === "nwc" && activeWallet instanceof SimpleNWCWallet) {
          const result = await activeWallet.payInvoice(invoice)
          if (!result) {
            throw new Error("Payment failed")
          }
          return result
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
        const {activeWallet, activeProviderType} = get()

        if (!activeWallet) {
          throw new Error("No wallet connected")
        }

        // Check if it's our SimpleNWC wallet
        if (activeProviderType === "nwc" && activeWallet instanceof SimpleNWCWallet) {
          const result = await activeWallet.makeInvoice(amount, description)
          if (result) {
            return result
          }
          throw new Error("Failed to create invoice")
        }

        throw new Error("Invoice creation not supported for this wallet type")
      },

      getBalance: throttle(
        async () => {
          try {
            const {activeWallet, activeProviderType} = get()
            console.log(
              "🔍 getBalance called (throttled), activeProviderType:",
              activeProviderType,
              "hasActiveWallet:",
              !!activeWallet
            )

            if (!activeWallet) {
              console.log("🔍 No active wallet, returning null")
              return null
            }

            // Handle NWC wallets with our SimpleNWCWallet
            if (activeProviderType === "nwc" && activeWallet instanceof SimpleNWCWallet) {
              console.log("🔍 Using SimpleNWCWallet for balance request")
              const balance = await activeWallet.getBalance()
              return balance
            }

            // For NDK wallets, try balance property and updateBalance method
            if (activeWallet instanceof NDKWebLNWallet) {
              const walletWithBalance = activeWallet as NDKWebLNWallet & {
                balance?: {amount: number}
                updateBalance?: () => Promise<void>
              }
              const balance = walletWithBalance.balance
              if (balance && typeof balance === "object" && "amount" in balance) {
                return balance.amount || 0
              }

              // If NDK wallet doesn't have balance yet, try to update it
              if (walletWithBalance.updateBalance) {
                await walletWithBalance.updateBalance()
                const updatedBalance = walletWithBalance.balance
                if (
                  updatedBalance &&
                  typeof updatedBalance === "object" &&
                  "amount" in updatedBalance
                ) {
                  return updatedBalance.amount || 0
                }
              }
            }

            return 0
          } catch (error) {
            console.error("Failed to get balance:", error)
            return null
          }
        },
        3000, // Throttle to max once per 3 seconds
        {leading: true, trailing: false} // Execute on first call, skip trailing calls
      ),

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
