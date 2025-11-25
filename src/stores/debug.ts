import {create} from "zustand"
import {subscribeWithSelector} from "zustand/middleware"
import debug from "debug"
import Dexie from "dexie"

interface DebugStore {
  filter: string
  enabled: boolean
  setFilter: (filter: string) => void
  setEnabled: (enabled: boolean) => void
  toggleDebug: () => void
}

// Dexie database for cross-context storage
class DebugDB extends Dexie {
  settings!: Dexie.Table<{key: string; value: string}, string>

  constructor() {
    super("DebugDB")
    this.version(1).stores({
      settings: "key",
    })
  }
}

const db = new DebugDB()

// BroadcastChannel for cross-context reactivity
const channel =
  typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("debug-sync") : null

// Sync helpers
const saveToDb = async (filter: string, enabled: boolean) => {
  await db.settings.put({key: "filter", value: filter})
  await db.settings.put({key: "enabled", value: enabled ? "true" : "false"})

  // Broadcast change to other contexts (workers/tabs)
  channel?.postMessage({filter, enabled})
}

const loadFromDb = async (): Promise<{filter: string; enabled: boolean}> => {
  const filterRow = await db.settings.get("filter")
  const enabledRow = await db.settings.get("enabled")
  return {
    filter: filterRow?.value || "",
    enabled: enabledRow?.value === "true",
  }
}

export const useDebugStore = create<DebugStore>()(
  subscribeWithSelector((set, get) => ({
    filter: "",
    enabled: false,

    setFilter: (filter: string) => {
      set({filter, enabled: !!filter})

      // Save to Dexie (works in workers)
      saveToDb(filter, !!filter)

      // Update localStorage.debug and debug lib (main thread only)
      if (typeof localStorage !== "undefined") {
        if (filter) {
          localStorage.setItem("debug", filter)
          debug.enable(filter)
        } else {
          localStorage.removeItem("debug")
          debug.disable()
        }
      }
    },

    setEnabled: (enabled: boolean) => {
      const filter = enabled ? "*" : ""
      set({filter, enabled})

      // Save to Dexie
      saveToDb(filter, enabled)

      // Update localStorage.debug and debug lib (main thread only)
      if (typeof localStorage !== "undefined") {
        if (enabled) {
          localStorage.setItem("debug", "*")
          debug.enable("*")
        } else {
          localStorage.removeItem("debug")
          debug.disable()
        }
      }
    },

    toggleDebug: () => {
      const {enabled} = get()
      get().setEnabled(!enabled)
    },
  }))
)

// Initialize from Dexie on load
loadFromDb().then(({filter, enabled}) => {
  if (filter && enabled) {
    useDebugStore.setState({filter, enabled})

    // Sync to localStorage.debug (main thread only)
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("debug", filter)
      debug.enable(filter)
    }
  }
})

// Listen for changes from other contexts
channel?.addEventListener("message", (event) => {
  const {filter, enabled} = event.data
  useDebugStore.setState({filter, enabled})

  // Sync to localStorage.debug and debug lib (main thread only)
  if (typeof localStorage !== "undefined") {
    if (filter) {
      localStorage.setItem("debug", filter)
      debug.enable(filter)
    } else {
      localStorage.removeItem("debug")
      debug.disable()
    }
  }
})
