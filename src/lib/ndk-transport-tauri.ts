import type NDK from "./ndk"
import {NDKEvent} from "./ndk/events"
import type {NDKFilter} from "./ndk/subscription"
import {invoke} from "@tauri-apps/api/core"
import {listen, UnlistenFn} from "@tauri-apps/api/event"

interface WorkerSubscribeOpts {
  destinations?: ("cache" | "relay")[]
  closeOnEose?: boolean
  groupable?: boolean
}

interface WorkerPublishOpts {
  publishTo?: ("cache" | "relay" | "subscriptions")[]
  verifySignature?: boolean
  source?: string
}

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
    | "reconnectDisconnected"
  id?: string
  filters?: NDKFilter[]
  event?: any
  relays?: string[]
  url?: string
  subscribeOpts?: WorkerSubscribeOpts
  publishOpts?: WorkerPublishOpts
  reason?: string
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
 * NDK transport that communicates with Tauri backend
 * Same protocol as NDKWorkerTransport but via Tauri IPC
 */
export class NDKTauriTransport {
  public name = "tauri-transport"
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
  private unlisten?: UnlistenFn
  private relayStatusCallbacks = new Map<string, (statuses: any[]) => void>()

  constructor() {
    this.setupTauri()
  }

  private async setupTauri() {
    // Listen for events from Tauri backend
    this.unlisten = await listen<WorkerResponse>("nostr_event", (event) => {
      this.handleResponse(event.payload)
    })

    // Initialize
    this.readyPromise = invoke<void>("nostr_message", {
      msg: {type: "init"} as WorkerMessage,
    }).then(() => {
      this.ready = true
    })
  }

  private handleResponse(response: WorkerResponse) {
    console.log("[Tauri Transport] handleResponse:", response.type, response)
    switch (response.type) {
      case "ready":
        this.ready = true
        break

      case "relayStatus":
        if (response.id) {
          const callback = this.relayStatusCallbacks.get(response.id)
          if (callback) {
            callback(response.relayStatuses || [])
            this.relayStatusCallbacks.delete(response.id)
          }
        }
        break

      case "event":
        if (response.subId && response.event) {
          const handlers = this.subscriptions.get(response.subId)
          if (handlers) {
            const event = new NDKEvent(this.ndk, response.event)
            handlers.forEach((handler) => handler(event))
          }
        }
        break

      case "eose":
        if (response.subId) {
          const handlers = this.eoseHandlers.get(response.subId)
          if (handlers) {
            handlers.forEach((handler) => handler())
          }
        }
        break

      case "published":
        if (response.id) {
          const resolver = this.publishResolvers.get(response.id)
          if (resolver) {
            resolver.resolve()
            this.publishResolvers.delete(response.id)
          }
        }
        break

      case "error":
        if (response.id) {
          const resolver = this.publishResolvers.get(response.id)
          if (resolver) {
            resolver.reject(new Error(response.error || "Unknown error"))
            this.publishResolvers.delete(response.id)
          }
        }
        break

      case "relayConnected":
        console.log("🔗 Relay connected:", response.relay)
        break

      case "relayDisconnected":
        console.log("🔌 Relay disconnected:", response.relay)
        break

      case "relayAdded":
        console.log("✅ Relay added:", response)
        break
    }
  }

  async connect(ndk: NDK, relayUrls?: string[]): Promise<void> {
    this.ndk = ndk
    this.relayUrls = relayUrls || []

    // Register as transport plugin for publish and subscription interception
    if (!ndk.transportPlugins) {
      ndk.transportPlugins = []
    }
    ndk.transportPlugins.push(this as any)

    await this.readyPromise

    // Send relay URLs to backend
    if (this.relayUrls.length > 0) {
      for (const url of this.relayUrls) {
        await this.addRelay(url)
      }
    }
  }

  async addRelay(url: string): Promise<void> {
    await invoke('nostr_message', {
      msg: {type: 'addRelay', url} as WorkerMessage
    })
  }

  // Transport plugin hook - intercept publishes
  async onPublish(event: NDKEvent): Promise<void> {
    await this.publish(event)
  }

  // Transport plugin hook - intercept subscriptions
  onSubscribe(subscription: any, filters: NDKFilter[]): void {
    const subId = subscription.subId || subscription.internalId

    // Listen for subscription close
    subscription.once("close", () => {
      this.unsubscribeInternal(subId)
    })

    // Forward subscription to backend
    this.subscribeInternal(
      subId,
      filters,
      (event: NDKEvent) => {
        subscription.eventReceived(event, undefined, false)
      },
      () => {
        subscription.eoseReceived(null as any)
      }
    )
  }

  private subscribeInternal(
    subId: string,
    filters: NDKFilter[],
    onEvent: (event: NDKEvent) => void,
    onEose: () => void
  ): void {
    // Store handlers
    if (!this.subscriptions.has(subId)) {
      this.subscriptions.set(subId, new Set())
    }
    this.subscriptions.get(subId)!.add(onEvent)

    if (!this.eoseHandlers.has(subId)) {
      this.eoseHandlers.set(subId, new Set())
    }
    this.eoseHandlers.get(subId)!.add(onEose)

    // Send to backend
    invoke("nostr_message", {
      msg: {
        type: "subscribe",
        id: subId,
        filters,
      } as WorkerMessage,
    })
  }

  private async unsubscribeInternal(subId: string): Promise<void> {
    this.subscriptions.delete(subId)
    this.eoseHandlers.delete(subId)

    await invoke("nostr_message", {
      msg: {
        type: "unsubscribe",
        id: subId,
      } as WorkerMessage,
    })
  }

  async publish(
    event: NDKEvent,
    opts?: {
      publishTo?: ("cache" | "relay" | "subscriptions")[]
      verifySignature?: boolean
    }
  ): Promise<void> {
    const id = Math.random().toString(36).substring(7)

    return new Promise((resolve, reject) => {
      this.publishResolvers.set(id, {resolve, reject})

      invoke("nostr_message", {
        msg: {
          type: "publish",
          id,
          event: event.rawEvent(),
          publishOpts: opts,
        } as WorkerMessage,
      }).catch(reject)
    })
  }

  async disconnect(): Promise<void> {
    if (this.unlisten) {
      this.unlisten()
    }

    await invoke("nostr_message", {
      msg: {type: "close"} as WorkerMessage,
    })
  }

  async reconnectDisconnected(reason: string): Promise<void> {
    await invoke("nostr_message", {
      msg: {type: "reconnectDisconnected", reason} as WorkerMessage,
    })
  }

  async getRelayStatus(): Promise<
    Array<{
      url: string
      status: number
      stats?: {attempts: number; success: number; connectedAt?: number}
    }>
  > {
    const id = Math.random().toString(36).substring(7)

    return new Promise((resolve) => {
      // Register callback for this request ID
      this.relayStatusCallbacks.set(id, resolve)

      invoke("nostr_message", {
        msg: {type: "getRelayStatus", id} as WorkerMessage,
      })

      // Timeout fallback
      setTimeout(() => {
        if (this.relayStatusCallbacks.has(id)) {
          this.relayStatusCallbacks.delete(id)
          resolve([])
        }
      }, 1000)
    })
  }

  async addRelay(url: string): Promise<void> {
    await invoke("nostr_message", {
      msg: {type: "addRelay", url} as WorkerMessage,
    })
  }

  async removeRelay(url: string): Promise<void> {
    await invoke("nostr_message", {
      msg: {type: "removeRelay", url} as WorkerMessage,
    })
  }

  async connectRelay(url: string): Promise<void> {
    await invoke("nostr_message", {
      msg: {type: "connectRelay", url} as WorkerMessage,
    })
  }

  async disconnectRelay(url: string): Promise<void> {
    await invoke("nostr_message", {
      msg: {type: "disconnectRelay", url} as WorkerMessage,
    })
  }
}
