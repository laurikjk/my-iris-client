import type {RTCSessionDescriptionInit, RTCIceCandidateInit} from "@/types/dom-types"
import {EventEmitter} from "tseep"
import {LRUCache} from "typescript-lru-cache"

import {getCachedName} from "@/utils/nostr"
import socialGraph from "@/utils/socialGraph"
import {createDebugLogger} from "@/utils/createDebugLogger"
import {DEBUG_NAMESPACES} from "@/utils/constants"
import {sendSignalingMessage} from "./signaling"

const {
  log: logLifecycle,
  warn,
  error,
} = createDebugLogger(DEBUG_NAMESPACES.WEBRTC_PEER_LIFECYCLE)
const {log: logMessages} = createDebugLogger(DEBUG_NAMESPACES.WEBRTC_PEER_MESSAGES)
const {log: logData} = createDebugLogger(DEBUG_NAMESPACES.WEBRTC_PEER_DATA)
import type {SignalingMessage} from "./types"
import {handleIncomingEvent} from "./p2pNostr"
import {useSettingsStore} from "@/stores/settings"
import {incrementBlobSent, incrementBlobReceived} from "./p2pStats"
import {
  updatePeerLastSeen,
  trackPeerBlobSent,
  trackPeerBlobReceived,
} from "./peerBandwidthStats"

const connections = new Map<string, PeerConnection>()

export function getAllConnections() {
  return connections
}
export async function getPeerConnection(
  sessionId: string,
  options: {
    ask?: boolean
    connect?: boolean
    create?: boolean
    mySessionId?: string
  } = {}
) {
  const {ask = true, connect = false, create = true, mySessionId} = options
  const pubKey = sessionId.split(":")[0]

  // Reject untrusted users
  if (
    create &&
    socialGraph().getFollowDistance(pubKey) > 1 &&
    socialGraph().getRoot() !== pubKey
  ) {
    warn("Rejected connection from untrusted user")
    return
  }

  // Check for existing connection
  const existing = connections.get(sessionId)
  if (existing) {
    const state = existing.peerConnection.connectionState

    // If connection is failed or closed, clean it up first
    if (state === "failed" || state === "closed") {
      logLifecycle(`Cleaning up ${state} connection before recreating`)
      existing.close()
      // Connection is now removed from map by close()
    } else {
      // Connection is usable, update and return
      if (mySessionId && !existing.mySessionId) {
        existing.mySessionId = mySessionId
      }
      if (connect && (state === "new" || state === "connecting")) {
        existing.connect()
      }
      return existing
    }
  }

  // Create new connection if needed
  if (
    create &&
    (pubKey === socialGraph().getRoot() ||
      !ask ||
      (await (
        await import("@/utils/utils")
      ).confirm(`WebRTC connect with ${getCachedName(pubKey)}?`)))
  ) {
    const connection = new PeerConnection(sessionId, mySessionId)
    connections.set(sessionId, connection)

    if (connect) {
      connection.connect()
    }

    return connection
  }

  return undefined
}

type PeerConnectionEvents = {
  "file-incoming": (metadata: {name: string; size: number; type: string}) => void
  "file-received": (
    blob: Blob,
    metadata: {name: string; size: number; type: string}
  ) => void
  "file-progress": (progress: number, direction: "send" | "receive") => void
  "call-incoming": (hasVideo: boolean) => void
  "call-started": (hasVideo: boolean, localStream: MediaStream) => void
  "remote-stream": (stream: MediaStream) => void
  close: () => void
}

export default class PeerConnection extends EventEmitter<PeerConnectionEvents> {
  peerId: string
  recipientPubkey: string
  mySessionId: string | null
  peerConnection: RTCPeerConnection
  dataChannel: RTCDataChannel | null
  fileChannel: RTCDataChannel | null
  callSignalingChannel: RTCDataChannel | null = null
  blobChannel: RTCDataChannel | null = null
  incomingFileMetadata: {name: string; size: number; type: string} | null = null
  receivedFileData: ArrayBuffer[] = []
  receivedFileSize: number = 0
  seenEvents: LRUCache<string, boolean>
  localStream: MediaStream | null = null
  remoteStream: MediaStream | null = null
  private fileTransferAccepted: boolean = false
  private blobRequests: Map<
    number,
    {
      hash: string
      chunks: ArrayBuffer[]
      totalChunks: number
      receivedChunks: Set<number>
      resolve?: (data: ArrayBuffer | null) => void
    }
  > = new Map()
  private pendingBlobSends: Map<
    number,
    {
      hash: string
      entry: {data: ArrayBuffer; size: number}
    }
  > = new Map()
  private nextBlobRequestId: number = 1

  constructor(peerId: string, mySessionId?: string) {
    super()
    this.peerId = peerId
    this.recipientPubkey = peerId.split(":")[0]
    this.mySessionId = mySessionId || null
    this.peerConnection = new RTCPeerConnection({
      iceServers: [
        {urls: "stun:stun.l.google.com:19302"},
        {urls: "stun:stun.cloudflare.com:3478"},
      ],
    })
    this.dataChannel = null
    this.fileChannel = null
    this.seenEvents = new LRUCache<string, boolean>({maxSize: 500})
    this.setupPeerConnectionEvents()
  }

  log(message: string) {
    logLifecycle(message)
  }

  connect() {
    const state = this.peerConnection.connectionState
    if (state !== "connected" && state !== "connecting") {
      this.sendOffer()
    }
  }

  handleSignalingMessage(message: SignalingMessage) {
    logMessages(`Processing ${message.type} message`)

    try {
      switch (message.type) {
        case "offer":
          logMessages("Offer")
          this.handleOffer(message.offer as unknown as RTCSessionDescriptionInit)
          break
        case "answer":
          logMessages("Answer")
          this.handleAnswer(message.answer as unknown as RTCSessionDescriptionInit)
          break
        case "candidate":
          logMessages("ICE candidate")
          this.handleCandidate(message.candidate as unknown as RTCIceCandidateInit)
          break
        default:
          error(`Unknown message type`)
      }
    } catch (e) {
      error("Error processing WebRTC message")
    }
  }

  async handleOffer(offer: RTCSessionDescriptionInit) {
    await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer))
    const answer = await this.peerConnection.createAnswer()
    await this.peerConnection.setLocalDescription(answer)
    await sendSignalingMessage(
      {
        type: "answer",
        answer,
        recipient: this.peerId,
        peerId: this.mySessionId || socialGraph().getRoot(),
      },
      this.recipientPubkey
    )
  }

  async handleAnswer(answer: RTCSessionDescriptionInit) {
    await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer))
  }

  async handleCandidate(candidate: RTCIceCandidateInit | null) {
    if (!candidate) return
    if (this.peerConnection.remoteDescription === null) {
      logMessages("Remote description not set, queuing candidate")
      setTimeout(() => this.handleCandidate(candidate), 500)
      return
    }
    await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate))
  }

  setupPeerConnectionEvents() {
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        sendSignalingMessage(
          {
            type: "candidate",
            candidate: event.candidate,
            recipient: this.peerId,
            peerId: this.mySessionId || socialGraph().getRoot(),
          },
          this.recipientPubkey
        )
      }
    }

    this.peerConnection.ondatachannel = (event) => {
      const channel = event.channel
      if (channel.label.startsWith("fileChannel")) {
        this.setFileChannel(channel)
      } else if (channel.label === "callSignaling") {
        this.setupCallSignalingChannel(channel)
      } else if (channel.label === "blobChannel") {
        this.setupBlobChannel(channel)
      } else {
        this.setDataChannel(channel)
      }
    }

    this.peerConnection.ontrack = (event) => {
      logLifecycle(
        `Remote ${event.track.kind} track received (enabled: ${event.track.enabled}, muted: ${event.track.muted})`
      )
      if (event.streams && event.streams[0]) {
        this.remoteStream = event.streams[0]
        this.emit("remote-stream", event.streams[0])

        // Monitor when all tracks end (call ended by remote)
        event.track.onended = () => {
          logLifecycle(`Remote ${event.track.kind} track ended`)
          // Check if all tracks have ended
          if (this.remoteStream) {
            const allEnded = this.remoteStream
              .getTracks()
              .every((track) => track.readyState === "ended")
            if (allEnded) {
              logLifecycle("All remote tracks ended, call ended by remote")
              this.stopCall()
              this.emit("close")
            }
          }
        }
      }
    }

    this.peerConnection.onconnectionstatechange = () => {
      logLifecycle(`Connection state: ${this.peerConnection.connectionState}`)
      const state = this.peerConnection.connectionState

      if (state === "connected") {
        const peerPubkey = this.peerId.split(":")[0]
        updatePeerLastSeen(peerPubkey)
      }

      if (state === "closed" || state === "failed") {
        logLifecycle(`Connection ${state}`)
        this.close()
      }
    }
  }

  private setupCallSignalingChannel(channel: RTCDataChannel) {
    this.callSignalingChannel = channel
    channel.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        if (data.type === "call-request") {
          const {webrtcCallsEnabled} = useSettingsStore.getState().network
          if (!webrtcCallsEnabled) {
            logLifecycle("Calls disabled, ignoring call request")
            return
          }
          logLifecycle(`Call request (video: ${data.hasVideo})`, "down")
          this.emit("call-incoming", data.hasVideo)
        } else if (data.type === "call-ended") {
          logLifecycle("Call ended by remote peer", "down")
          this.stopCall()
          this.emit("close")
        }
      } catch (err) {
        error("Failed to parse call signaling")
      }
    }
  }

  async startCall(hasVideo = false) {
    if (this.peerConnection.connectionState !== "connected") {
      error("Cannot start call: not connected")
      return
    }

    try {
      logLifecycle(`Requesting ${hasVideo ? "video" : "audio"} call permissions`)

      // Get user media
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: hasVideo,
      })

      logLifecycle(
        `Media stream acquired (${this.localStream.getTracks().length} tracks)`
      )

      // Add tracks to peer connection
      for (const track of this.localStream.getTracks()) {
        this.peerConnection.addTrack(track, this.localStream)
      }

      // Renegotiate connection to send new tracks
      const offer = await this.peerConnection.createOffer()
      await this.peerConnection.setLocalDescription(offer)
      await sendSignalingMessage(
        {
          type: "offer",
          offer,
          recipient: this.peerId,
          peerId: this.mySessionId || socialGraph().getRoot(),
        },
        this.recipientPubkey
      )

      // Create call signaling channel if it doesn't exist
      if (!this.peerConnection.createDataChannel) return
      const signalingChannel = this.peerConnection.createDataChannel("callSignaling")
      this.setupCallSignalingChannel(signalingChannel)
      signalingChannel.onopen = () => {
        signalingChannel.send(JSON.stringify({type: "call-request", hasVideo}))
        logLifecycle(`Call request (video: ${hasVideo})`, "up")
      }

      logLifecycle(`Call started (video: ${hasVideo})`)

      // Emit event so UI can show active call view for caller
      this.emit("call-started", hasVideo, this.localStream)
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err)
      error(`Failed to start call: ${errorMsg}`)

      // Show user-friendly error message
      const {useToastStore} = await import("@/stores/toast")
      if (
        errorMsg.includes("NotAllowedError") ||
        errorMsg.includes("Permission denied")
      ) {
        useToastStore.getState().addToast("Camera/microphone permission denied", "error")
      } else if (errorMsg.includes("NotFoundError")) {
        useToastStore.getState().addToast("Camera/microphone not found", "error")
      } else {
        useToastStore.getState().addToast(`Failed to start call: ${errorMsg}`, "error")
      }

      this.stopCall()
    }
  }

  stopCall(notifyRemote = false) {
    const hadCall = this.localStream !== null || this.remoteStream !== null

    // Notify remote peer before stopping
    if (notifyRemote && this.callSignalingChannel?.readyState === "open") {
      try {
        this.callSignalingChannel.send(JSON.stringify({type: "call-ended"}))
        logLifecycle("Call ended notification sent", "up")
      } catch (err) {
        error("Failed to send call-ended")
      }
    }

    // Stop and clean up local media tracks (camera/mic)
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        track.stop()
        logLifecycle(`Stopped ${track.kind} track`)
      })
      this.localStream = null
    }
    // Remote stream cleanup happens automatically when connection closes
    this.remoteStream = null

    if (hadCall) {
      logLifecycle("Call stopped")
    }
  }

  async sendOffer() {
    this.dataChannel = this.peerConnection.createDataChannel("jsonChannel")
    this.setDataChannel(this.dataChannel)
    this.fileChannel = this.peerConnection.createDataChannel("fileChannel")
    this.setFileChannel(this.fileChannel)
    this.blobChannel = this.peerConnection.createDataChannel("blobChannel")
    this.setupBlobChannel(this.blobChannel)
    const offer = await this.peerConnection.createOffer()
    await this.peerConnection.setLocalDescription(offer)
    await sendSignalingMessage(
      {
        type: "offer",
        offer,
        recipient: this.peerId,
        peerId: this.mySessionId || socialGraph().getRoot(),
      },
      this.recipientPubkey
    )
    logMessages("Offer")
  }

  setDataChannel(dataChannel: RTCDataChannel) {
    this.dataChannel = dataChannel
    this.dataChannel.onopen = () => logData("Data channel open")
    this.dataChannel.onmessage = (event) => {
      try {
        handleIncomingEvent(this.peerId, event.data)
      } catch (err) {
        error("Error handling data channel message")
      }
    }
    this.dataChannel.onclose = () => {
      logData("Data channel closed")
      this.close()
    }
  }

  setFileChannel(fileChannel: RTCDataChannel) {
    // Reset state for new file transfer
    this.incomingFileMetadata = null
    this.receivedFileData = []
    this.receivedFileSize = 0
    this.fileTransferAccepted = false

    this.fileChannel = fileChannel
    this.fileChannel.binaryType = "arraybuffer"
    this.fileChannel.onopen = () => logData("File channel open")
    this.fileChannel.onmessage = (event) => {
      if (typeof event.data === "string") {
        const metadata = JSON.parse(event.data)
        if (metadata.type === "file-metadata" && metadata.metadata) {
          const {webrtcFileReceivingEnabled} = useSettingsStore.getState().network
          if (!webrtcFileReceivingEnabled) {
            logData("File receiving disabled, rejecting transfer")
            fileChannel.send(JSON.stringify({type: "file-rejected"}))
            return
          }
          this.incomingFileMetadata = metadata.metadata
          logData(`File incoming: ${metadata.metadata.name}`, "down")
          // Emit event for UI to show modal
          this.emit("file-incoming", metadata.metadata)
        } else if (metadata.type === "file-accepted") {
          logData("File acceptance confirmed, ready to receive", "down")
        } else if (metadata.type === "file-rejected") {
          logData("File rejected by remote peer", "down")
          this.incomingFileMetadata = null
          this.receivedFileData = []
          this.receivedFileSize = 0
        }
      } else if (event.data instanceof ArrayBuffer) {
        // Only buffer if we have metadata and user accepted
        if (!this.incomingFileMetadata) {
          logData("Received file data without metadata, ignoring")
          return
        }

        if (!this.fileTransferAccepted) {
          logData("Received file data before acceptance, ignoring")
          return
        }

        this.receivedFileData.push(event.data)
        this.receivedFileSize += event.data.byteLength

        // Emit progress
        const progress = Math.round(
          (this.receivedFileSize / this.incomingFileMetadata.size) * 100
        )
        this.emit("file-progress", progress, "receive")

        if (this.receivedFileSize === this.incomingFileMetadata.size) {
          logData("File fully received")
          const blob = new Blob(this.receivedFileData, {
            type: this.incomingFileMetadata.type,
          })
          this.emit("file-received", blob, this.incomingFileMetadata)
          this.saveReceivedFile(blob)
        }
      }
    }
    this.fileChannel.onclose = () => {
      logData("File channel closed")
    }
  }

  acceptFileTransfer() {
    this.fileTransferAccepted = true
    logData("File transfer accepted, sending confirmation")

    // Send acceptance confirmation to sender (sender will start streaming)
    if (this.fileChannel?.readyState === "open") {
      this.fileChannel.send(JSON.stringify({type: "file-accepted"}))
    }

    logData("Waiting for file data...")
  }

  rejectFileTransfer() {
    logData("File transfer rejected")

    // Send rejection to sender
    if (this.fileChannel?.readyState === "open") {
      this.fileChannel.send(JSON.stringify({type: "file-rejected"}))
    }

    this.incomingFileMetadata = null
    this.receivedFileData = []
    this.receivedFileSize = 0
    this.fileTransferAccepted = false
  }

  private saveReceivedFile(blob: Blob) {
    if (!this.incomingFileMetadata) {
      error("No file metadata available")
      return
    }

    logData(`Saving file: ${this.incomingFileMetadata.name}`)

    const url = URL.createObjectURL(blob)

    const a = document.createElement("a")
    a.href = url
    a.download = this.incomingFileMetadata.name
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    // Reset file data
    this.incomingFileMetadata = null
    this.receivedFileData = []
    this.receivedFileSize = 0
    this.fileTransferAccepted = false
    logData("File saved")
  }

  sendJsonData(jsonData: unknown) {
    if (this.dataChannel?.readyState === "open") {
      const jsonString = JSON.stringify(jsonData)
      this.dataChannel.send(jsonString)
    }
  }

  sendFile(file: File) {
    if (this.peerConnection.connectionState !== "connected") {
      error("Peer connection not connected")
      return
    }

    // Create a unique file channel name
    const fileChannelName = `fileChannel-${Date.now()}`
    const fileChannel = this.peerConnection.createDataChannel(fileChannelName)
    this.setFileChannel(fileChannel)

    // Send file metadata over the file channel
    const metadata = {
      type: "file-metadata",
      metadata: {
        name: file.name,
        size: file.size,
        type: file.type,
      },
    }

    const originalOnMessage = fileChannel.onmessage
    fileChannel.onmessage = (event) => {
      if (typeof event.data === "string") {
        const data = JSON.parse(event.data)
        if (data.type === "file-accepted") {
          logData("File accepted by receiver, starting transfer", "down")
          startSending()
        } else if (data.type === "file-rejected") {
          logData("File rejected by receiver", "down")
          fileChannel.close()
          this.fileChannel = null
        }
      }
      if (originalOnMessage) {
        originalOnMessage.call(fileChannel, event)
      }
    }

    fileChannel.onopen = () => {
      logData(`File: ${file.name} (${file.size} bytes)`, "up")
      fileChannel.send(JSON.stringify(metadata))
      logData("Waiting for receiver acceptance...")
    }

    const startSending = () => {
      // Send file in chunks to avoid buffer overflow
      const CHUNK_SIZE = 16384 // 16KB chunks
      let offset = 0

      const sendChunk = () => {
        // Check buffer before sending
        if (fileChannel.bufferedAmount > CHUNK_SIZE * 4) {
          // Buffer too full, wait and retry
          setTimeout(sendChunk, 100)
          return
        }

        const chunk = file.slice(offset, offset + CHUNK_SIZE)
        const reader = new FileReader()

        reader.onload = () => {
          if (reader.result && reader.result instanceof ArrayBuffer) {
            fileChannel.send(reader.result)
            offset += reader.result.byteLength

            const progress = Math.round((offset / file.size) * 100)
            this.emit("file-progress", progress, "send")

            if (offset % (CHUNK_SIZE * 10) === 0 || offset >= file.size) {
              logData(`File send progress: ${progress}%`)
            }

            if (offset < file.size) {
              sendChunk()
            } else {
              logData("File sent")
              setTimeout(() => {
                fileChannel.close()
                this.fileChannel = null
              }, 100)
            }
          }
        }

        reader.readAsArrayBuffer(chunk)
      }

      sendChunk()
    }
  }

  setupBlobChannel(blobChannel: RTCDataChannel) {
    this.blobChannel = blobChannel
    this.blobChannel.binaryType = "arraybuffer"
    this.blobChannel.onopen = () => logData("Blob channel open")

    this.blobChannel.onmessage = async (event) => {
      if (typeof event.data === "string") {
        // JSON control messages
        try {
          const msg = JSON.parse(event.data)
          await this.handleBlobMessage(msg)
        } catch (err) {
          error("Failed to parse blob message")
        }
      } else if (event.data instanceof ArrayBuffer) {
        // Binary chunk
        await this.handleBlobChunk(event.data)
      }
    }

    this.blobChannel.onclose = () => {
      logData("Blob channel closed")
    }
  }

  private async handleBlobMessage(msg: [string, number, Record<string, unknown>]) {
    const [type, requestId, payload] = msg

    if (type === "BLOB_REQ") {
      await this.handleBlobRequest(requestId, payload)
    } else if (type === "BLOB_RES") {
      await this.handleBlobResponse(requestId, payload)
    } else if (type === "BLOB_ACK") {
      await this.handleBlobAck(requestId, payload)
    } else if (type === "BLOB_OK") {
      await this.handleBlobOk(requestId, payload)
    }
  }

  private async handleBlobRequest(requestId: number, req: Record<string, unknown>) {
    const {hash, size} = req
    logData(
      `BLOB_REQ ${(hash as string).slice(0, 8)}... (${size || "unknown"} bytes)`,
      "down"
    )

    // Get blob from storage
    const {getBlobStorage} = await import("./blobManager")
    const storage = getBlobStorage()
    const entry = await storage.get(hash as string)

    if (!entry) {
      logData(`Blob not found: ${(hash as string).slice(0, 8)}...`)
      // Timeout - requester will handle
      return
    }

    // Track peer request stat
    storage.incrementPeerRequests(hash as string)

    // Track this send
    this.pendingBlobSends.set(requestId, {hash: hash as string, entry})

    // Send response (no payment for now)
    const {BLOB_CHUNK_SIZE} = await import("./blobProtocol")
    const chunks = Math.ceil(entry.size / BLOB_CHUNK_SIZE)

    const response = {
      size: entry.size,
      chunks,
    }

    this.sendBlobMessage("BLOB_RES", requestId, response)
    logData(`BLOB_RES ${chunks} chunks`, "up")
  }

  private async handleBlobResponse(requestId: number, res: Record<string, unknown>) {
    const {size, chunks} = res
    logData(`BLOB_RES ${chunks} chunks (${size} bytes)`, "down")

    // Get existing request (has the hash)
    const existing = this.blobRequests.get(requestId)
    if (!existing) {
      warn(`Received BLOB_RES for unknown request ${requestId}`)
      return
    }

    // Update with chunk info (preserve hash and resolver)
    this.blobRequests.set(requestId, {
      hash: existing.hash,
      chunks: new Array(chunks as number),
      totalChunks: chunks as number,
      receivedChunks: new Set(),
      resolve: existing.resolve,
    })

    // Send ACK to start transfer
    this.sendBlobMessage("BLOB_ACK", requestId, {accept: true})
    logData(`BLOB_ACK accepted`, "up")
  }

  private async handleBlobAck(requestId: number, ack: Record<string, unknown>) {
    if (!ack.accept) {
      logData(`BLOB_ACK rejected`, "down")
      return
    }

    logData(`BLOB_ACK accepted, starting transfer`, "down")
    await this.sendBlobChunks(requestId)
  }

  private async sendBlobChunks(requestId: number) {
    // This is called on sender side after receiving ACK
    const pendingSend = this.pendingBlobSends.get(requestId)
    if (!pendingSend) {
      warn(`No pending send for request ${requestId}`)
      return
    }

    const {hash, entry} = pendingSend
    const {BLOB_CHUNK_SIZE, encodeBlobChunkHeader} = await import("./blobProtocol")
    const chunks = Math.ceil(entry.size / BLOB_CHUNK_SIZE)

    for (let i = 0; i < chunks; i++) {
      const start = i * BLOB_CHUNK_SIZE
      const end = Math.min(start + BLOB_CHUNK_SIZE, entry.size)
      const chunkData = entry.data.slice(start, end)

      // Encode: [requestId][chunkIndex][data]
      const header = encodeBlobChunkHeader(requestId, i)
      const packet = new Uint8Array(header.length + chunkData.byteLength)
      packet.set(header, 0)
      packet.set(new Uint8Array(chunkData), header.length)

      // Send with backpressure handling
      while (this.blobChannel && this.blobChannel.bufferedAmount > BLOB_CHUNK_SIZE * 4) {
        await new Promise((resolve) => setTimeout(resolve, 10))
      }

      if (this.blobChannel?.readyState === "open") {
        this.blobChannel.send(packet.buffer)
      } else {
        error("Blob channel closed during send")
        break
      }

      if (i % 10 === 0 || i === chunks - 1) {
        const progress = Math.round(((i + 1) / chunks) * 100)
        logData(`Blob send progress: ${progress}%`)
      }
    }

    logData(`Blob transfer complete: ${hash.slice(0, 8)}...`)
    this.pendingBlobSends.delete(requestId)

    // Track blob sent
    const peerPubkey = this.peerId.split(":")[0]
    incrementBlobSent(entry.size)
    trackPeerBlobSent(peerPubkey, entry.size)
  }

  private async handleBlobOk(requestId: number, ok: Record<string, unknown>) {
    const {verified, hash} = ok
    if (verified) {
      logData(`BLOB_OK verified ${(hash as string).slice(0, 8)}...`, "down")
    } else {
      logData(`BLOB_OK verification failed ${(hash as string).slice(0, 8)}...`, "down")
    }
    this.blobRequests.delete(requestId)
  }

  private async handleBlobChunk(data: ArrayBuffer) {
    const {decodeBlobChunkHeader, BLOB_CHUNK_HEADER_SIZE} = await import("./blobProtocol")
    const header = decodeBlobChunkHeader(data)
    const chunkData = data.slice(BLOB_CHUNK_HEADER_SIZE)

    const request = this.blobRequests.get(header.requestId)
    if (!request) {
      warn(`Received chunk for unknown request ${header.requestId}`)
      return
    }

    // Store chunk
    request.chunks[header.chunkIndex] = chunkData
    request.receivedChunks.add(header.chunkIndex)

    if (
      request.receivedChunks.size % 10 === 0 ||
      request.receivedChunks.size === request.totalChunks
    ) {
      const progress = Math.round(
        (request.receivedChunks.size / request.totalChunks) * 100
      )
      logData(`Blob progress: ${progress}%`)
    }

    // Check if complete
    if (request.receivedChunks.size === request.totalChunks) {
      await this.completeBlobTransfer(header.requestId, request)
    }
  }

  private async completeBlobTransfer(
    requestId: number,
    request: {
      hash: string
      chunks: ArrayBuffer[]
      totalChunks: number
      receivedChunks: Set<number>
      resolve?: (data: ArrayBuffer | null) => void
    }
  ) {
    logData("Blob transfer complete, verifying...")

    // Reassemble blob
    const blob = new Uint8Array(
      request.chunks.reduce(
        (acc: number, chunk: ArrayBuffer) => acc + chunk.byteLength,
        0
      )
    )
    let offset = 0
    for (const chunk of request.chunks) {
      blob.set(new Uint8Array(chunk), offset)
      offset += chunk.byteLength
    }

    // Verify hash
    const {sha256} = await import("@noble/hashes/sha256")
    const {bytesToHex} = await import("@noble/hashes/utils")
    const hash = bytesToHex(sha256(blob))

    const verified = hash === request.hash
    logData(`Hash verification: ${verified ? "OK" : "FAILED"}`)

    // Track blob received
    if (verified) {
      const peerPubkey = this.peerId.split(":")[0]
      incrementBlobReceived(blob.byteLength)
      trackPeerBlobReceived(peerPubkey, blob.byteLength)
    }

    let result: ArrayBuffer | null = null

    if (verified) {
      // Store in cache
      const {getBlobStorage} = await import("./blobManager")
      const storage = getBlobStorage()
      await storage.save(hash, blob.buffer)
      logData(`Blob saved: ${hash.slice(0, 8)}...`)
      result = blob.buffer
    }

    // Send completion
    this.sendBlobMessage("BLOB_OK", requestId, {verified, hash})

    // Resolve the promise from requestBlob
    if (request.resolve) {
      request.resolve(result)
    }

    this.blobRequests.delete(requestId)
  }

  private sendBlobMessage(
    type: string,
    requestId: number,
    payload: Record<string, unknown>
  ) {
    if (this.blobChannel?.readyState === "open") {
      this.blobChannel.send(JSON.stringify([type, requestId, payload]))
    }
  }

  async requestBlob(hash: string, size?: number): Promise<ArrayBuffer | null> {
    if (!this.blobChannel || this.blobChannel.readyState !== "open") {
      error("Blob channel not open")
      return null
    }

    const requestId = this.nextBlobRequestId++

    // Track local request stat
    const {getBlobStorage} = await import("./blobManager")
    const storage = getBlobStorage()
    storage.incrementLocalRequests(hash)

    // Create promise that will be resolved by completeBlobTransfer
    return new Promise((resolve) => {
      // Track this request with resolver
      this.blobRequests.set(requestId, {
        hash,
        chunks: [],
        totalChunks: 0,
        receivedChunks: new Set(),
        resolve,
      })

      // Send request
      const req = {hash, size}
      this.sendBlobMessage("BLOB_REQ", requestId, req)
      logData(`BLOB_REQ ${hash.slice(0, 8)}...`, "up")

      // Timeout after 60s
      setTimeout(() => {
        const request = this.blobRequests.get(requestId)
        if (request && request.resolve) {
          request.resolve(null)
        }
        this.blobRequests.delete(requestId)
      }, 60000)
    })
  }

  close() {
    logLifecycle("Closing connection")

    // Stop any active call
    this.stopCall()

    // Close data channels
    if (this.dataChannel) {
      this.dataChannel.onopen = null
      this.dataChannel.onmessage = null
      this.dataChannel.onclose = null
      this.dataChannel.close()
      this.dataChannel = null
    }
    if (this.fileChannel) {
      this.fileChannel.onopen = null
      this.fileChannel.onmessage = null
      this.fileChannel.onclose = null
      this.fileChannel.close()
      this.fileChannel = null
    }
    if (this.callSignalingChannel) {
      this.callSignalingChannel.onopen = null
      this.callSignalingChannel.onmessage = null
      this.callSignalingChannel.onclose = null
      this.callSignalingChannel.close()
      this.callSignalingChannel = null
    }
    if (this.blobChannel) {
      this.blobChannel.onopen = null
      this.blobChannel.onmessage = null
      this.blobChannel.onclose = null
      this.blobChannel.close()
      this.blobChannel = null
    }

    // Remove RTCPeerConnection event handlers
    this.peerConnection.onicecandidate = null
    this.peerConnection.ondatachannel = null
    this.peerConnection.ontrack = null
    this.peerConnection.onconnectionstatechange = null

    // Close peer connection
    this.peerConnection.close()

    // Remove from global connections map
    connections.delete(this.peerId)

    // Clear streams
    this.localStream = null
    this.remoteStream = null

    // Emit close event
    this.emit("close")

    // Remove all event listeners
    this.removeAllListeners()
  }
}
