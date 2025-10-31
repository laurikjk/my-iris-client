import type {RTCSessionDescriptionInit, RTCIceCandidateInit} from "@/types/dom-types"
import {EventEmitter} from "tseep"

import {getCachedName} from "@/utils/nostr"
import socialGraph from "@/utils/socialGraph"
import {webrtcLogger} from "./Logger"
import {sendSignalingMessage} from "./signaling"
import type {SignalingMessage} from "./types"

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

export default class PeerConnection extends EventEmitter {
  peerId: string
  recipientPubkey: string
  mySessionId: string | null
  peerConnection: RTCPeerConnection
  dataChannel: RTCDataChannel | null
  fileChannel: RTCDataChannel | null
  incomingFileMetadata: {name: string; size: number; type: string} | null = null
  receivedFileData: ArrayBuffer[] = []
  receivedFileSize: number = 0

  constructor(peerId: string, mySessionId?: string) {
    super()
    this.peerId = peerId
    this.recipientPubkey = peerId.split(":")[0]
    this.mySessionId = mySessionId || null
    this.peerConnection = new RTCPeerConnection({
      iceServers: [{urls: "stun:stun.l.google.com:19302"}],
    })
    this.dataChannel = null
    this.fileChannel = null
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
          this.log("Received offer")
          this.handleOffer(message.offer as unknown as RTCSessionDescriptionInit)
          break
        case "answer":
          this.log("Received answer")
          this.handleAnswer(message.answer as unknown as RTCSessionDescriptionInit)
          break
        case "candidate":
          this.log("Received ICE candidate")
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
      } else {
        this.setDataChannel(channel)
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
    this.log("Sent offer")
  }

  setDataChannel(dataChannel: RTCDataChannel) {
    this.dataChannel = dataChannel
    this.dataChannel.onopen = () => this.log("Data channel open")
    this.dataChannel.onmessage = (event) => {
      this.log("Received message", event.data)
    }
    this.dataChannel.onclose = () => {
      this.log("Data channel closed")
      this.close()
    }
  }

  setFileChannel(fileChannel: RTCDataChannel) {
    this.fileChannel = fileChannel
    this.fileChannel.binaryType = "arraybuffer"
    this.fileChannel.onopen = () => this.log("File channel open")
    this.fileChannel.onmessage = (event) => {
      if (typeof event.data === "string") {
        const metadata = JSON.parse(event.data)
        if (metadata.type === "file-metadata" && metadata.metadata) {
          this.incomingFileMetadata = metadata.metadata
          this.receivedFileData = []
          this.receivedFileSize = 0
          this.log(`Receiving file: ${metadata.metadata.name}`)
        }
      } else if (event.data instanceof ArrayBuffer) {
        this.receivedFileData.push(event.data)
        this.receivedFileSize += event.data.byteLength

        if (
          this.incomingFileMetadata &&
          this.receivedFileSize === this.incomingFileMetadata.size
        ) {
          this.log("File fully received")
          this.saveReceivedFile()
        }
      }
    }
    this.fileChannel.onclose = () => {
      this.log("File channel closed")
    }
  }

  async saveReceivedFile() {
    if (!this.incomingFileMetadata) {
      webrtcLogger.error(this.peerId, "No file metadata available")
      return
    }

    const pubkey = this.peerId.split(":")[0]
    const name = getCachedName(pubkey)
    const confirmString = `Save ${this.incomingFileMetadata.name} from ${name}?`
    if (!(await (await import("@/utils/utils")).confirm(confirmString))) {
      this.log("User cancelled file save")
      this.incomingFileMetadata = null
      this.receivedFileData = []
      this.receivedFileSize = 0
      return
    }

    this.log(`Saving file: ${this.incomingFileMetadata.name}`)

    const blob = new Blob(this.receivedFileData, {type: this.incomingFileMetadata.type})
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
        this.log(`Sending file: ${file.name}`)
        fileChannel.send(JSON.stringify(metadata))

        // Read and send the file as binary data
        const reader = new FileReader()
        reader.onload = () => {
          if (reader.result && reader.result instanceof ArrayBuffer) {
            fileChannel.send(reader.result)
            this.log("File sent")
          }
        }
        reader.readAsArrayBuffer(file)
      }
    } else {
      webrtcLogger.error(this.peerId, "Peer connection not connected")
    }
  }

  close() {
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
