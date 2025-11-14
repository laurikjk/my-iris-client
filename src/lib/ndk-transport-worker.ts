import type NDK from "./ndk"
import type {NDKEvent} from "./ndk/events"
import type {NDKFilter} from "./ndk/subscription"
import type {NDKRelay} from "./ndk/relay"

interface WorkerMessage {
  type:
    | "init"
    | "subscribe"
    | "unsubscribe"
    | "publish"
    | "close"
    | "getRelayStatus"
    | "addRelay"
    | "removeRelay"
    | "connectRelay"
    | "disconnectRelay"
  id?: string
  filters?: NDKFilter[]
  event?: any
  relays?: string[]
  url?: string
}

interface WorkerResponse {
  type:
    | "ready"
    | "event"
    | "eose"
    | "notice"
    | "published"
    | "error"
    | "relayStatus"
    | "relayAdded"
    | "relayConnected"
    | "relayDisconnected"
  subId?: string
  event?: any
  relay?: string
  notice?: string
  error?: string
  id?: string
  relayStatuses?: Array<{
    url: string
    status: number
    stats?: {
      attempts: number
      success: number
      connectedAt?: number
    }
  }>
}

/**
 * NDK transport that communicates with relay worker
 * All actual WebSocket connections live in the worker thread
 */
export class NDKWorkerTransport {
  public name = "worker-transport"
  private worker: Worker
  private workerUrl: string
  private ndk?: NDK
  private relayUrls: string[] = []
  private subscriptions = new Map<string, Set<(event: NDKEvent) => void>>()
  private eoseHandlers = new Map<string, Set<() => void>>()
  private publishResolvers = new Map<
    string,
    {resolve: () => void; reject: (err: Error) => void}
  >()
  private ready = false
  private readyPromise!: Promise<void>
  private restartAttempts = 0

  constructor(workerUrl = "/relay-worker.js") {
    this.workerUrl = workerUrl
    this.worker = this.createWorker()
  }

  private createWorker(): Worker {
    const worker = new Worker(this.workerUrl, {type: "module"})

    this.readyPromise = new Promise((resolve) => {
      const handler = (e: MessageEvent<WorkerResponse>) => {
        if (e.data.type === "ready") {
          this.ready = true
          worker.removeEventListener("message", handler)
          this.restartAttempts = 0 // Reset on successful init
          resolve()
        }
      }
      worker.addEventListener("message", handler)
    })

    // Handle worker crashes
    worker.onerror = (error) => {
      console.error("[Worker Transport] Worker error:", error)
      this.handleWorkerCrash()
    }

    // Setup message handlers after worker is assigned
    this.setupMessageHandler(worker)

    return worker
  }

  private async handleWorkerCrash() {
    this.restartAttempts++
    this.ready = false

    // Exponential backoff capped at 30s
    const delay = Math.min(1000 * Math.pow(2, this.restartAttempts - 1), 30_000)
    console.warn(
      `[Worker Transport] Worker crashed (attempt ${this.restartAttempts}), restarting in ${delay}ms...`,
    )

    await new Promise((resolve) => setTimeout(resolve, delay))

    // Recreate worker
    this.worker.terminate()
    this.worker = this.createWorker()

    // Reinitialize with same config
    if (this.ndk && this.relayUrls.length > 0) {
      try {
        await this.connect(this.ndk, this.relayUrls)
        console.log(`[Worker Transport] Worker restarted successfully after ${this.restartAttempts} attempts`)
      } catch (error) {
        console.error("[Worker Transport] Failed to reconnect after restart:", error)
        // Will retry on next crash
      }
    }
  }

  async connect(ndk: NDK, relayUrls?: string[]): Promise<void> {
    this.ndk = ndk
    this.relayUrls = relayUrls || []

    // Register as transport plugin for publish and subscription interception
    if (!ndk.transportPlugins) {
      ndk.transportPlugins = []
    }
    ndk.transportPlugins.push(this as any) // Type compatibility handled at runtime

    this.worker.postMessage({
      type: "init",
      relays: relayUrls || [],
    } as WorkerMessage)

    await this.readyPromise
  }

  // Transport plugin hook - intercept publishes
  async onPublish(event: NDKEvent): Promise<void> {
    // Publish through worker instead of main thread pool
    await this.publish(event)
  }

  // Transport plugin hook - intercept subscriptions
  onSubscribe(subscription: any, filters: NDKFilter[]): void {
    const subId = subscription.subId || subscription.internalId

    // Listen for subscription close to clean up worker subscription
    subscription.once("close", () => {
      this.unsubscribe(subId)
    })

    // Forward subscription to worker
    this.subscribe(
      subId,
      filters,
      (event: NDKEvent) => {
        // Emit event to main thread subscription
        // Pass event as NOT from cache (3rd param = false) so it gets processed
        subscription.eventReceived(event, undefined, false)
      },
      () => {
        // Emit EOSE to main thread subscription (pass null instead of undefined)
        // Worker doesn't have relay reference, subscription handles it
        subscription.eoseReceived(null as any)
      },
    )
  }

  async publish(event: NDKEvent, relays?: NDKRelay[]): Promise<void> {
    if (!this.ready) await this.readyPromise

    return new Promise((resolve, reject) => {
      const id = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
      this.publishResolvers.set(id, {resolve, reject})

      this.worker.postMessage({
        type: "publish",
        id,
        event: event.rawEvent(),
        relays: relays?.map((r) => r.url),
      } as WorkerMessage)

      // Timeout after 10s
      setTimeout(() => {
        if (this.publishResolvers.has(id)) {
          this.publishResolvers.delete(id)
          reject(new Error("Publish timeout"))
        }
      }, 10_000)
    })
  }

  subscribe(
    subId: string,
    filters: NDKFilter[],
    onEvent: (event: NDKEvent) => void,
    onEose?: () => void,
  ): void {
    if (!this.subscriptions.has(subId)) {
      this.subscriptions.set(subId, new Set())
    }
    this.subscriptions.get(subId)!.add(onEvent)

    if (onEose) {
      if (!this.eoseHandlers.has(subId)) {
        this.eoseHandlers.set(subId, new Set())
      }
      this.eoseHandlers.get(subId)!.add(onEose)
    }

    this.worker.postMessage({
      type: "subscribe",
      id: subId,
      filters,
    } as WorkerMessage)
  }

  unsubscribe(subId: string): void {
    this.subscriptions.delete(subId)
    this.eoseHandlers.delete(subId)

    this.worker.postMessage({
      type: "unsubscribe",
      id: subId,
    } as WorkerMessage)
  }

  close(): void {
    this.worker.postMessage({type: "close"} as WorkerMessage)
    this.worker.terminate()
  }

  /**
   * Get current status of all relays in worker
   */
  async getRelayStatus(): Promise<
    Array<{
      url: string
      status: number
      stats?: {attempts: number; success: number; connectedAt?: number}
    }>
  > {
    return new Promise((resolve) => {
      const id = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
      const handler = (e: MessageEvent<WorkerResponse>) => {
        if (e.data.type === "relayStatus" && e.data.id === id) {
          this.worker.removeEventListener("message", handler)
          resolve(e.data.relayStatuses || [])
        }
      }
      this.worker.addEventListener("message", handler)
      this.worker.postMessage({type: "getRelayStatus", id} as WorkerMessage)
      setTimeout(() => resolve([]), 1000) // Timeout fallback
    })
  }

  /**
   * Add relay to worker pool
   */
  async addRelay(url: string): Promise<void> {
    this.worker.postMessage({type: "addRelay", url} as WorkerMessage)
  }

  /**
   * Remove relay from worker pool
   */
  async removeRelay(url: string): Promise<void> {
    this.worker.postMessage({type: "removeRelay", url} as WorkerMessage)
  }

  /**
   * Connect specific relay
   */
  async connectRelay(url: string): Promise<void> {
    this.worker.postMessage({type: "connectRelay", url} as WorkerMessage)
  }

  /**
   * Disconnect specific relay
   */
  async disconnectRelay(url: string): Promise<void> {
    this.worker.postMessage({type: "disconnectRelay", url} as WorkerMessage)
  }

  private setupMessageHandler(worker: Worker): void {
    worker.onmessage = async (e: MessageEvent<WorkerResponse>) => {
      const {type, subId, event, relay, notice, error, id} = e.data

      switch (type) {
        case "event":
          if (subId && event && this.ndk) {
            const {NDKEvent} = await import("./ndk/events")
            const ndkEvent = new NDKEvent(this.ndk, event)
            const handlers = this.subscriptions.get(subId)
            if (handlers) {
              handlers.forEach((handler) => handler(ndkEvent))
            }
          }
          break

        case "eose":
          if (subId) {
            const handlers = this.eoseHandlers.get(subId)
            if (handlers) {
              handlers.forEach((handler) => handler())
            }
          }
          break

        case "notice":
          if (relay && notice) {
            console.warn(`[Relay ${relay}] ${notice}`)
          }
          break

        case "published":
          if (id) {
            const resolver = this.publishResolvers.get(id)
            if (resolver) {
              resolver.resolve()
              this.publishResolvers.delete(id)
            }
          }
          break

        case "error":
          if (id && error) {
            const resolver = this.publishResolvers.get(id)
            if (resolver) {
              resolver.reject(new Error(error))
              this.publishResolvers.delete(id)
            }
          }
          console.error("[Worker Transport]", error)
          break
      }
    }
  }
}
