import {Manager, ConsoleLogger} from "./core/index"
import {IndexedDbRepositories} from "./indexeddb/index"

let managerInstance: Manager | null = null

const getSeed = async (): Promise<Uint8Array> => {
  const storedSeed = localStorage.getItem("cashu:seed")

  if (storedSeed) {
    return Uint8Array.from(atob(storedSeed), (c) => c.charCodeAt(0))
  }

  // Generate new 64-byte seed
  const seed = new Uint8Array(64)
  crypto.getRandomValues(seed)

  // Store for future use
  localStorage.setItem("cashu:seed", btoa(String.fromCharCode(...seed)))

  return seed
}

export const initCashuManager = async (): Promise<Manager> => {
  if (managerInstance) {
    return managerInstance
  }

  const repos = new IndexedDbRepositories({
    name: "iris-cashu-db",
  })

  await repos.init()

  const logger = new ConsoleLogger("cashu", {level: "warn"})

  managerInstance = new Manager(repos, getSeed, logger)

  // Enable watchers for automatic quote redemption
  await managerInstance.enableMintQuoteWatcher({watchExistingPendingOnStart: true})
  await managerInstance.enableProofStateWatcher()

  // Enable processor to automatically redeem paid quotes
  await managerInstance.enableMintQuoteProcessor()
  await managerInstance.quotes.requeuePaidMintQuotes()

  return managerInstance
}

export const getCashuManager = (): Manager | null => {
  return managerInstance
}

export const disposeCashuManager = async (): Promise<void> => {
  if (managerInstance) {
    await managerInstance.dispose()
    managerInstance = null
  }
}
