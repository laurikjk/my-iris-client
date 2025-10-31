import {getPeerConnection} from "./PeerConnection"
import socialGraph from "@/utils/socialGraph"
import {EventEmitter} from "tseep"
import {webrtcLogger} from "./Logger"
import {sendSignalingMessage, subscribeToSignaling} from "./signaling"
import {PeerId, type SignalingMessage} from "./types"
import {useUserStore} from "@/stores/user"
import {useSettingsStore} from "@/stores/settings"

function uuidv4() {
  return crypto.randomUUID()
}

function isMutualFollow(pubkey: string, myPubkey: string): boolean {
  return (
    socialGraph().getFollowedByUser(pubkey).has(myPubkey) &&
    socialGraph().getFollowedByUser(myPubkey).has(pubkey)
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

class PeerConnectionManager extends EventEmitter {
  private peers = new Map<string, PeerStatus>()
  private onlineUsers = new Map<string, OnlineUser>()
  private maxOutbound = 3
  private maxInbound = 3
  private connectionCheckInterval?: NodeJS.Timeout
  private presencePingInterval?: NodeJS.Timeout
  private cleanupInterval?: NodeJS.Timeout
  private isRunning = false
  private myPeerId: PeerId | null = null
  private unsubscribe?: () => void
  private readonly TIMEOUT = 15000 // 15 seconds

  start() {
    if (this.isRunning) return

    const {webrtcEnabled} = useSettingsStore.getState().network
    if (!webrtcEnabled) {
      webrtcLogger.info(undefined, "WebRTC is disabled in settings")
      return
    }

    this.isRunning = true

    const myPubkey = useUserStore.getState().publicKey
    if (!myPubkey) {
      webrtcLogger.error(undefined, "Cannot start: no pubkey")
      return
    }

    this.myPeerId = new PeerId(myPubkey, uuidv4())
    webrtcLogger.info(undefined, `Starting with peer ID: ${this.myPeerId.short()}`)

    // Subscribe to signaling messages
    this.unsubscribe = subscribeToSignaling(this.handleSignalingMessage.bind(this))

    // Send presence pings every 7.5 seconds
    this.presencePingInterval = setInterval(() => void this.sendPresencePing(), 7500)
    void this.sendPresencePing()

    // Check and maintain connections every 30 seconds
    this.connectionCheckInterval = setInterval(
      () => void this.maintainConnections(),
      30000
    )
    void this.maintainConnections()

    // Clean up stale online users every 5 seconds
    this.cleanupInterval = setInterval(() => void this.cleanupStaleUsers(), 5000)
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
    this.isRunning = false

    // Close all connections
    for (const peer of this.peers.values()) {
      getPeerConnection(peer.sessionId, {create: false})
        .then((conn) => conn?.close())
        .catch(console.error)
    }
    this.peers.clear()
    this.onlineUsers.clear()
    this.emit("update")
  }

  private async sendPresencePing() {
    if (!this.myPeerId) return

    await sendSignalingMessage({
      type: "hello",
      peerId: this.myPeerId.uuid,
    })
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

  private async handleSignalingMessage(message: SignalingMessage, senderPubkey: string) {
    if (!this.myPeerId) return

    const myPubkey = socialGraph().getRoot()
    if (!myPubkey) return

    // Update online presence
    if (message.type === "hello") {
      const peerId = new PeerId(senderPubkey, message.peerId)
      const peerIdStr = peerId.toString()

      // Don't track ourselves
      if (senderPubkey === myPubkey) return

      this.onlineUsers.set(senderPubkey, {
        pubkey: senderPubkey,
        lastSeen: Date.now(),
      })
      this.emit("update")

      // Check if we should connect
      if (
        isMutualFollow(senderPubkey, myPubkey) &&
        this.peers.size < this.maxOutbound &&
        !this.peers.has(peerIdStr) &&
        !this.isPeerConnectionOpen(peerId)
      ) {
        // Use tie-breaking: only initiate if our UUID is smaller
        if (this.myPeerId.uuid < message.peerId) {
          await this.connectToPeer(peerId)
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
        if (!isMutualFollow(senderPubkey, myPubkey)) {
          webrtcLogger.warn(undefined, "Rejected offer from non-mutual follow")
          return
        }

        const inboundCount = Array.from(this.peers.values()).filter(
          (p) => p.direction === "inbound"
        ).length
        if (inboundCount >= this.maxInbound) {
          webrtcLogger.warn(undefined, "Inbound connection quota full")
          return
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
    const myPubkey = socialGraph().getRoot()
    if (!myPubkey) return

    let changed = false

    // Clean up disconnected peers
    for (const [sessionId] of this.peers.entries()) {
      const conn = await getPeerConnection(sessionId, {create: false})
      const state = conn?.peerConnection.connectionState

      // Remove failed, closed, or long-stuck "new" connections
      if (!conn || ["failed", "closed"].includes(state || "")) {
        this.peers.delete(sessionId)
        changed = true
      } else if (state === "new") {
        // If stuck in "new" for more than 10 seconds, clean up
        const peer = this.peers.get(sessionId)
        if (peer && !peer.connectedAt) {
          // Check if we've been tracking this peer for a while
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

    webrtcLogger.info(undefined, `Initiating connection to ${peerId.short()}`)

    const peerConn = await getPeerConnection(peerIdStr, {
      ask: false,
      create: true,
      connect: true,
      mySessionId: this.myPeerId?.uuid,
    })

    if (!peerConn) {
      webrtcLogger.error(peerIdStr, "Failed to create peer connection")
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

    const newState = peerConn.peerConnection.connectionState

    if (newState === "connected" && !peer.connectedAt) {
      peer.connectedAt = Date.now()
    }

    peer.state = newState

    if (["failed", "closed"].includes(newState)) {
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
