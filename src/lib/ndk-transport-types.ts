import type {NDKFilter} from "./ndk/subscription"

export interface WorkerSubscribeOpts {
  destinations?: ("cache" | "relay")[]
  closeOnEose?: boolean
  groupable?: boolean
}

export interface WorkerPublishOpts {
  publishTo?: ("cache" | "relay" | "subscriptions")[]
  verifySignature?: boolean
  source?: string
}

export interface LocalDataStats {
  totalEvents: number
  eventsByKind: Record<number, number>
  databaseSize?: string
}

export interface WorkerMessage {
  type:
    | "init"
    | "subscribe"
    | "unsubscribe"
    | "publish"
    | "close"
    | "getRelayStatus"
    | "getStats"
    | "addRelay"
    | "removeRelay"
    | "connectRelay"
    | "disconnectRelay"
    | "reconnectDisconnected"
  id?: string
  filters?: NDKFilter[]
  event?: unknown
  relays?: string[]
  url?: string
  subscribeOpts?: WorkerSubscribeOpts
  publishOpts?: WorkerPublishOpts
  reason?: string
}

export interface WorkerResponse {
  type:
    | "ready"
    | "event"
    | "eose"
    | "notice"
    | "published"
    | "error"
    | "relayStatus"
    | "stats"
    | "relayAdded"
    | "relayConnected"
    | "relayDisconnected"
  subId?: string
  event?: unknown
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
  stats?: LocalDataStats
}
