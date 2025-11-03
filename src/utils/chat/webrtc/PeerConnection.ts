import type {RTCSessionDescriptionInit, RTCIceCandidateInit} from "@/types/dom-types"
import {EventEmitter} from "tseep"
import {LRUCache} from "typescript-lru-cache"

import {getCachedName} from "@/utils/nostr"
import socialGraph from "@/utils/socialGraph"
import {webrtcLogger} from "./Logger"
import {sendSignalingMessage} from "./signaling"
import type {SignalingMessage} from "./types"
import {handleIncomingEvent} from "./p2pNostr"
import {useSettingsStore} from "@/stores/settings"

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
    webrtcLogger.warn(sessionId, "Rejected connection from untrusted user")
    return
  }

  // Return existing connection if available
  const existing = connections.get(sessionId)
  if (existing) {
    // Update mySessionId if provided
    if (mySessionId && !existing.mySessionId) {
      existing.mySessionId = mySessionId
    }
    if (connect) {
      existing.connect()
    }
    return existing
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
  incomingFileMetadata: {name: string; size: number; type: string} | null = null
  receivedFileData: ArrayBuffer[] = []
  receivedFileSize: number = 0
  seenEvents: LRUCache<string, boolean>
  localStream: MediaStream | null = null
  remoteStream: MediaStream | null = null
  private fileTransferAccepted: boolean = false

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

  log(message: string, ...args: unknown[]) {
    webrtcLogger.info(this.peerId, message, ...args)
  }

  connect() {
    const state = this.peerConnection.connectionState
    if (state !== "connected" && state !== "connecting") {
      this.sendOffer()
    }
  }

  handleSignalingMessage(message: SignalingMessage) {
    this.log(`Processing ${message.type} message`)

    try {
      switch (message.type) {
        case "offer":
          this.log("↓ Offer")
          this.handleOffer(message.offer as unknown as RTCSessionDescriptionInit)
          break
        case "answer":
          this.log("↓ Answer")
          this.handleAnswer(message.answer as unknown as RTCSessionDescriptionInit)
          break
        case "candidate":
          this.log("↓ ICE candidate")
          this.handleCandidate(message.candidate as unknown as RTCIceCandidateInit)
          break
        default:
          webrtcLogger.error(this.peerId, `Unknown message type`)
      }
    } catch (e) {
      webrtcLogger.error(this.peerId, "Error processing WebRTC message", e)
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
      this.log("Remote description not set, queuing candidate")
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
      } else {
        this.setDataChannel(channel)
      }
    }

    this.peerConnection.ontrack = (event) => {
      this.log("Remote track received")
      if (event.streams && event.streams[0]) {
        this.remoteStream = event.streams[0]
        this.emit("remote-stream", event.streams[0])

        // Monitor when all tracks end (call ended by remote)
        event.track.onended = () => {
          this.log(`Remote ${event.track.kind} track ended`)
          // Check if all tracks have ended
          if (this.remoteStream) {
            const allEnded = this.remoteStream
              .getTracks()
              .every((track) => track.readyState === "ended")
            if (allEnded) {
              this.log("All remote tracks ended, call ended by remote")
              this.stopCall()
              this.emit("close")
            }
          }
        }
      }
    }

    this.peerConnection.onconnectionstatechange = () => {
      this.log(`Connection state: ${this.peerConnection.connectionState}`)
      if (this.peerConnection.connectionState === "closed") {
        this.log("Connection closed")
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
            this.log("Calls disabled, ignoring call request")
            return
          }
          this.log(`↓ Call request (video: ${data.hasVideo})`)
          this.emit("call-incoming", data.hasVideo)
        } else if (data.type === "call-ended") {
          this.log("↓ Call ended by remote peer")
          this.stopCall()
          this.emit("close")
        }
      } catch (error) {
        webrtcLogger.error(this.peerId, "Failed to parse call signaling", error)
      }
    }
  }

  async startCall(hasVideo = false) {
    if (this.peerConnection.connectionState !== "connected") {
      webrtcLogger.error(this.peerId, "Cannot start call: not connected")
      return
    }

    try {
      // Get user media
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: hasVideo,
      })

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
        this.log(`↑ Call request (video: ${hasVideo})`)
      }

      this.log(`Call started (video: ${hasVideo})`)

      // Emit event so UI can show active call view for caller
      this.emit("call-started", hasVideo, this.localStream)
    } catch (error) {
      webrtcLogger.error(this.peerId, "Failed to start call", error)
      this.stopCall()
    }
  }

  stopCall(notifyRemote = false) {
    // Notify remote peer before stopping
    if (notifyRemote && this.callSignalingChannel?.readyState === "open") {
      try {
        this.callSignalingChannel.send(JSON.stringify({type: "call-ended"}))
        this.log("↑ Call ended notification sent")
      } catch (error) {
        webrtcLogger.error(this.peerId, "Failed to send call-ended", error)
      }
    }

    // Stop and clean up local media tracks (camera/mic)
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        track.stop()
        this.log(`Stopped ${track.kind} track`)
      })
      this.localStream = null
    }
    // Remote stream cleanup happens automatically when connection closes
    this.remoteStream = null
    this.log("Call stopped")
  }

  async sendOffer() {
    this.dataChannel = this.peerConnection.createDataChannel("jsonChannel")
    this.setDataChannel(this.dataChannel)
    this.fileChannel = this.peerConnection.createDataChannel("fileChannel")
    this.setFileChannel(this.fileChannel)
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
    this.log("↑ Offer")
  }

  setDataChannel(dataChannel: RTCDataChannel) {
    this.dataChannel = dataChannel
    this.dataChannel.onopen = () => this.log("Data channel open")
    this.dataChannel.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        handleIncomingEvent(this.peerId, data)
      } catch (error) {
        webrtcLogger.error(this.peerId, "Failed to parse data channel message", error)
      }
    }
    this.dataChannel.onclose = () => {
      this.log("Data channel closed")
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
    this.fileChannel.onopen = () => this.log("File channel open")
    this.fileChannel.onmessage = (event) => {
      if (typeof event.data === "string") {
        const metadata = JSON.parse(event.data)
        if (metadata.type === "file-metadata" && metadata.metadata) {
          const {webrtcFileReceivingEnabled} = useSettingsStore.getState().network
          if (!webrtcFileReceivingEnabled) {
            this.log("File receiving disabled, rejecting transfer")
            return
          }
          this.incomingFileMetadata = metadata.metadata
          this.log(`↓ File incoming: ${metadata.metadata.name}`)
          // Emit event for UI to show modal
          this.emit("file-incoming", metadata.metadata)
        }
      } else if (event.data instanceof ArrayBuffer) {
        // Buffer all data chunks
        this.receivedFileData.push(event.data)
        this.receivedFileSize += event.data.byteLength

        if (
          this.incomingFileMetadata &&
          this.receivedFileSize === this.incomingFileMetadata.size
        ) {
          this.log("File fully received, waiting for user action")
          // File fully buffered - wait for user to accept or reject
          // If already accepted, save immediately
          if (this.fileTransferAccepted) {
            const blob = new Blob(this.receivedFileData, {
              type: this.incomingFileMetadata.type,
            })
            this.emit("file-received", blob, this.incomingFileMetadata)
            this.saveReceivedFile(blob)
          }
        }
      }
    }
    this.fileChannel.onclose = () => {
      this.log("File channel closed")
    }
  }

  acceptFileTransfer() {
    this.fileTransferAccepted = true
    this.log(
      `File transfer accepted. Metadata: ${this.incomingFileMetadata ? "yes" : "no"}, Size: ${this.receivedFileSize}/${this.incomingFileMetadata?.size || 0}`
    )

    // If file already fully received, save it now
    if (
      this.incomingFileMetadata &&
      this.receivedFileSize === this.incomingFileMetadata.size
    ) {
      this.log("File was already received, saving now")
      const blob = new Blob(this.receivedFileData, {
        type: this.incomingFileMetadata.type,
      })
      this.emit("file-received", blob, this.incomingFileMetadata)
      this.saveReceivedFile(blob)
    } else {
      this.log("File not yet fully received, will save when complete")
    }
  }

  rejectFileTransfer() {
    this.log("File transfer rejected")
    this.incomingFileMetadata = null
    this.receivedFileData = []
    this.receivedFileSize = 0
    this.fileTransferAccepted = false
  }

  private saveReceivedFile(blob: Blob) {
    if (!this.incomingFileMetadata) {
      webrtcLogger.error(this.peerId, "No file metadata available")
      return
    }

    this.log(`Saving file: ${this.incomingFileMetadata.name}`)

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
    this.log("File saved")
  }

  sendJsonData(jsonData: unknown) {
    if (this.dataChannel?.readyState === "open") {
      const jsonString = JSON.stringify(jsonData)
      this.dataChannel.send(jsonString)
    }
  }

  sendFile(file: File) {
    if (this.peerConnection.connectionState === "connected") {
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
      fileChannel.onopen = () => {
        this.log(`↑ File: ${file.name}`)
        fileChannel.send(JSON.stringify(metadata))

        // Read and send the file as binary data
        const reader = new FileReader()
        reader.onload = () => {
          if (reader.result && reader.result instanceof ArrayBuffer) {
            fileChannel.send(reader.result)
            this.log("File sent")
            // Close channel after sending
            setTimeout(() => {
              fileChannel.close()
              this.fileChannel = null
            }, 100)
          }
        }
        reader.readAsArrayBuffer(file)
      }
    } else {
      webrtcLogger.error(this.peerId, "Peer connection not connected")
    }
  }

  close() {
    this.stopCall()
    if (this.dataChannel) {
      this.dataChannel.close()
    }
    if (this.fileChannel) {
      this.fileChannel.close()
    }
    this.peerConnection.close()
    this.emit("close")
  }
}
