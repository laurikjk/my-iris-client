import {getPeerConnection} from "./PeerConnection"
import {getSocialGraph, socialGraphLoaded} from "@/utils/socialGraph"
import {useSocialGraphStore} from "@/stores/socialGraph"
import {EventEmitter} from "tseep"
import {createDebugLogger} from "@/utils/createDebugLogger"
import {DEBUG_NAMESPACES} from "@/utils/constants"
import {sendSignalingMessage, subscribeToSignaling} from "./signaling"

const {log, warn, error} = createDebugLogger(DEBUG_NAMESPACES.WEBRTC_PEER)
import {PeerId, type SignalingMessage} from "./types"
import {useUserStore} from "@/stores/user"
import {useSettingsStore} from "@/stores/settings"

function uuidv4() {
  return (
    Math.random().toString(36).substring(2, 15) +
    Math.random().toString(36).substring(2, 15)
  )
}

function isMutualFollow(pubkey: string, myPubkey: string): boolean {
  return (
    getSocialGraph().getFollowedByUser(pubkey).has(myPubkey) &&
    getSocialGraph().getFollowedByUser(myPubkey).has(pubkey)
  )
}

type PeerStatus = {
  pubkey: string
  sessionId: string
  state: RTCPeerConnection["connectionState"]
  direction: "outbound" | "inbound"
  connectedAt?: number
}

type OnlineUser = {
  pubkey: string
  lastSeen: number
}

class PeerConnectionManager extends EventEmitter<{
  update: () => void
}> {
  private peers = new Map<string, PeerStatus>()
  private onlineUsers = new Map<string, OnlineUser>()
  private connectionCheckInterval?: NodeJS.Timeout
  private presencePingInterval?: NodeJS.Timeout
  private cleanupInterval?: NodeJS.Timeout
  private isRunning = false
  private myPeerId: PeerId | null = null
  private unsubscribe?: () => void
  private socialGraphUnsubscribe?: () => void
  private currentMutualFollows = new Set<string>()
  private readonly TIMEOUT = 15000 // 15 seconds
  private readonly PRESENCE_PING_INTERVAL = 10000 // 10 seconds

  start() {
    if (this.isRunning) return

    const {webrtcEnabled} = useSettingsStore.getState().network
    if (!webrtcEnabled) {
      log("WebRTC is disabled in settings")
      return
    }

    this.isRunning = true

    const myPubkey = useUserStore.getState().publicKey
    if (!myPubkey) {
      error("Cannot start: no pubkey")
      return
    }

    this.myPeerId = new PeerId(myPubkey, uuidv4())
    log(`Starting with peer ID: ${this.myPeerId.short()}`)

    // Wait for social graph to load before starting
    socialGraphLoaded.then(() => {
      log("Social graph loaded, setting up WebRTC")

      // Get initial mutual follows and subscribe
      this.updateMutualFollowsAndResubscribe(myPubkey)

      // Watch for social graph changes via Zustand store
      let previousVersion = useSocialGraphStore.getState().version
      this.socialGraphUnsubscribe = useSocialGraphStore.subscribe((state) => {
        if (state.version !== previousVersion) {
          previousVersion = state.version
          log("Social graph updated, rechecking mutual follows")
          this.updateMutualFollowsAndResubscribe(myPubkey)
        }
      })

      // Send presence pings AFTER subscription is set up
      this.presencePingInterval = setInterval(
        () => void this.sendPresencePing(),
        this.PRESENCE_PING_INTERVAL
      )
      void this.sendPresencePing()

      // Check and maintain connections every 30 seconds
      this.connectionCheckInterval = setInterval(
        () => void this.maintainConnections(),
        30000
      )
      void this.maintainConnections()
    })

    // Clean up stale online users every 5 seconds
    this.cleanupInterval = setInterval(() => void this.cleanupStaleUsers(), 5000)

    // Close connections gracefully on page unload
    this.setupUnloadHandler()
  }

  private setupUnloadHandler() {
    const cleanup = () => {
      log("Page unloading, closing all connections")
      // Close all connections synchronously
      for (const peer of this.peers.values()) {
        getPeerConnection(peer.sessionId, {create: false})
          .then((conn) => conn?.close())
          .catch(() => {})
      }
    }

    // Only beforeunload - pagehide fires on mobile when backgrounding
    window.addEventListener("beforeunload", cleanup)
  }

  stop() {
    if (this.connectionCheckInterval) {
      clearInterval(this.connectionCheckInterval)
      this.connectionCheckInterval = undefined
    }
    if (this.presencePingInterval) {
      clearInterval(this.presencePingInterval)
      this.presencePingInterval = undefined
    }
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = undefined
    }
    if (this.unsubscribe) {
      this.unsubscribe()
      this.unsubscribe = undefined
    }
    if (this.socialGraphUnsubscribe) {
      this.socialGraphUnsubscribe()
      this.socialGraphUnsubscribe = undefined
    }
    this.isRunning = false

    // Close all connections
    for (const peer of this.peers.values()) {
      getPeerConnection(peer.sessionId, {create: false})
        .then((conn) => conn?.close())
        .catch(console.error)
    }
    this.peers.clear()
    this.onlineUsers.clear()
    this.currentMutualFollows.clear()
    this.emit("update")
  }

  private async sendPresencePing() {
    if (!this.myPeerId) return

    // Always send hello to enable connecting to own devices/sessions
    // (subscription includes own pubkey even with no mutual follows)
    const helloMsg = {
      type: "hello" as const,
      peerId: this.myPeerId.uuid,
    }
    log(`Sending hello with peerId: ${this.myPeerId.uuid}`)
    await sendSignalingMessage(helloMsg)
  }

  private cleanupStaleUsers() {
    const now = Date.now()
    let changed = false

    for (const [pubkey, user] of this.onlineUsers.entries()) {
      if (now - user.lastSeen > this.TIMEOUT) {
        this.onlineUsers.delete(pubkey)
        changed = true
      }
    }

    if (changed) {
      this.emit("update")
    }
  }

  private getMutualFollows(myPubkey: string): Set<string> {
    const mutualFollows = new Set<string>()
    const myFollows = getSocialGraph().getFollowedByUser(myPubkey)

    for (const pubkey of myFollows) {
      if (isMutualFollow(pubkey, myPubkey)) {
        mutualFollows.add(pubkey)
      }
    }

    return mutualFollows
  }

  private updateMutualFollowsAndResubscribe(myPubkey: string) {
    const newMutualFollows = this.getMutualFollows(myPubkey)

    // Check if mutual follows actually changed (bidirectional comparison)
    // Skip only if we've already set up subscription AND follows haven't changed
    if (this.unsubscribe && newMutualFollows.size === this.currentMutualFollows.size) {
      const same = Array.from(newMutualFollows).every((pubkey) =>
        this.currentMutualFollows.has(pubkey)
      )
      if (same) {
        log("Mutual follows unchanged, skipping resubscription")
        return // No changes, skip resubscription
      }
    }

    this.currentMutualFollows = newMutualFollows

    const followCount = newMutualFollows.size
    log(
      followCount > 0
        ? `Found ${followCount} mutual follows, subscribing`
        : "No mutual follows, subscribing to own devices only"
    )

    // Unsubscribe from old subscription
    if (this.unsubscribe) {
      this.unsubscribe()
    }

    // Subscribe with new filter (always subscribe, even with no mutual follows to connect to own devices)
    this.unsubscribe = subscribeToSignaling(
      this.handleSignalingMessage.bind(this),
      newMutualFollows,
      myPubkey
    )
  }

  private async handleSignalingMessage(message: SignalingMessage, senderPubkey: string) {
    if (!this.myPeerId) return

    const myPubkey = getSocialGraph().getRoot()
    if (!myPubkey) return

    // Update online presence
    if (message.type === "hello") {
      const peerId = new PeerId(senderPubkey, message.peerId)
      const peerIdStr = peerId.toString()

      // Skip same session (ourselves on this device)
      if (peerIdStr === this.myPeerId.toString()) {
        return
      }

      log(
        `Received hello from ${senderPubkey.slice(0, 8)}... with peerId: ${message.peerId}`
      )
      log(`hello`)

      // Track online users (including our other sessions)
      this.onlineUsers.set(senderPubkey, {
        pubkey: senderPubkey,
        lastSeen: Date.now(),
      })
      this.emit("update")

      // Check if we should connect
      const isOwnSession = senderPubkey === myPubkey
      const isMutual = isMutualFollow(senderPubkey, myPubkey)

      const {webrtcMaxOutbound, webrtcConnectToOwnDevices} =
        useSettingsStore.getState().network

      // Conditionally connect to own sessions, respect quota for mutual follows
      const shouldConnect =
        ((webrtcConnectToOwnDevices && isOwnSession) ||
          (isMutual && this.peers.size < webrtcMaxOutbound)) &&
        !this.peers.has(peerIdStr) &&
        !this.isPeerConnectionOpen(peerId)

      if (shouldConnect) {
        // Use tie-breaking: only initiate if our UUID is smaller
        const shouldInitiate = this.myPeerId.uuid < message.peerId
        if (shouldInitiate) {
          await this.connectToPeer(peerId)
        } else {
          log(`Waiting for connection`)
        }
      }
      return
    }

    // Handle WebRTC signaling for established connections
    const peerId = new PeerId(senderPubkey, message.peerId)
    const peerIdStr = peerId.toString()

    // Check if message is for us
    if (message.recipient && message.recipient !== this.myPeerId.toString()) {
      return
    }

    switch (message.type) {
      case "offer": {
        const isOwnSession = senderPubkey === myPubkey
        const isMutual = isMutualFollow(senderPubkey, myPubkey)

        // Accept offers from own sessions or mutual follows
        if (!isOwnSession && !isMutual) {
          warn("Rejected offer from non-mutual follow")
          return
        }

        // Check inbound quota (but allow own sessions if enabled)
        const {webrtcMaxInbound, webrtcConnectToOwnDevices} =
          useSettingsStore.getState().network
        const bypassQuota = webrtcConnectToOwnDevices && isOwnSession

        if (!bypassQuota) {
          const inboundCount = Array.from(this.peers.values()).filter(
            (p) => p.direction === "inbound"
          ).length
          if (inboundCount >= webrtcMaxInbound) {
            warn("Inbound connection quota full")
            return
          }
        }

        // Clean up any existing failed/closed connection before creating new one
        const existingConn = await getPeerConnection(peerIdStr, {create: false})
        if (existingConn) {
          const state = existingConn.peerConnection.connectionState
          if (state === "failed" || state === "closed") {
            log(`Cleaning up ${state} connection before accepting offer`)
            existingConn.close()
            this.peers.delete(peerIdStr)
          }
        }

        const peerConn = await getPeerConnection(peerIdStr, {
          ask: false,
          create: true,
          connect: false,
          mySessionId: this.myPeerId?.uuid,
        })
        if (!peerConn) return

        peerConn.handleSignalingMessage(message)

        if (!this.peers.has(peerIdStr)) {
          this.peers.set(peerIdStr, {
            pubkey: senderPubkey,
            sessionId: peerIdStr,
            state: peerConn.peerConnection.connectionState,
            direction: "inbound",
          })
          this.emit("update")
        }

        peerConn.peerConnection.onconnectionstatechange = () => {
          this.updatePeerStatus(peerIdStr, peerConn)
        }
        break
      }

      case "answer":
      case "candidate": {
        const peerConn = await getPeerConnection(peerIdStr, {create: false})
        if (peerConn) {
          peerConn.handleSignalingMessage(message)
        }
        break
      }
    }
  }

  private isPeerConnectionOpen(peerId: PeerId): boolean {
    const connection = this.peers.get(peerId.toString())
    return connection?.state === "connected" || connection?.state === "connecting"
  }

  private async maintainConnections() {
    const myPubkey = getSocialGraph().getRoot()
    if (!myPubkey) return

    let changed = false

    // Clean up disconnected peers
    for (const [sessionId] of this.peers.entries()) {
      const conn = await getPeerConnection(sessionId, {create: false})
      const state = conn?.peerConnection.connectionState

      // Remove failed, closed, or long-stuck "new" connections
      if (!conn || ["failed", "closed"].includes(state || "")) {
        log(`Cleaning up ${state || "missing"} connection`)
        // Ensure connection is fully closed
        if (conn) {
          conn.close()
        }
        this.peers.delete(sessionId)
        changed = true
      } else if (state === "new") {
        // If stuck in "new" for more than 10 seconds, clean up
        const peer = this.peers.get(sessionId)
        if (peer && !peer.connectedAt) {
          log("Cleaning up stuck 'new' connection")
          conn.close()
          this.peers.delete(sessionId)
          changed = true
        }
      }
    }

    if (changed) {
      this.emit("update")
    }

    // Connection establishment is now driven by hello messages
    // No need to proactively connect here
  }

  private async connectToPeer(peerId: PeerId) {
    const peerIdStr = peerId.toString()

    log(`Initiating connection`)

    const peerConn = await getPeerConnection(peerIdStr, {
      ask: false,
      create: true,
      connect: true,
      mySessionId: this.myPeerId?.uuid,
    })

    if (!peerConn) {
      error("Failed to create peer connection")
      return
    }

    this.peers.set(peerIdStr, {
      pubkey: peerId.pubkey,
      sessionId: peerIdStr,
      state: peerConn.peerConnection.connectionState,
      direction: "outbound",
    })
    this.emit("update")

    peerConn.peerConnection.onconnectionstatechange = () => {
      this.updatePeerStatus(peerIdStr, peerConn)
    }
  }

  private updatePeerStatus(
    sessionId: string,
    peerConn: Awaited<ReturnType<typeof getPeerConnection>>
  ) {
    if (!peerConn) return

    const peer = this.peers.get(sessionId)
    if (!peer) return

    const oldState = peer.state
    const newState = peerConn.peerConnection.connectionState

    if (newState === "connected" && !peer.connectedAt) {
      peer.connectedAt = Date.now()
      log(`Connected`)
    }

    peer.state = newState

    if (["failed", "closed"].includes(newState)) {
      if (oldState === "connected") {
        log(`Disconnected`)
      }
      // Ensure connection is properly closed and cleaned up
      peerConn.close()
      this.peers.delete(sessionId)
    }

    this.emit("update")
  }

  getPeers(): PeerStatus[] {
    return Array.from(this.peers.values())
  }

  getConnectionCount(): number {
    return Array.from(this.peers.values()).filter((p) => p.state === "connected").length
  }

  hasConnections(): boolean {
    return this.getConnectionCount() > 0
  }

  getOnlineUsers(): OnlineUser[] {
    return Array.from(this.onlineUsers.values())
  }

  getMyPeerId(): string | null {
    return this.myPeerId?.toString() || null
  }
}

export const peerConnectionManager = new PeerConnectionManager()
