import {EventEmitter} from "tseep"
import debug from "debug"

import {Rumor, Session} from "nostr-double-ratchet"
import {NDKEventFromRawEvent} from "@/utils/nostr"

const log = debug("webrtc:connection")

const connections = new Map<string, PeerConnection>()
export function getPeerConnection(session: Session, peerId: string) {
  const isLocalhost =
    window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"

  if (
    isLocalhost &&
    !connections.has(peerId) &&
    confirm(`WebRTC connect with ${peerId}?`)
  ) {
    const connection = new PeerConnection(session, peerId)
    connections.set(peerId, connection)
    return connection
  }
  return connections.get(peerId)
}

export default class PeerConnection extends EventEmitter {
  peerId: string
  session: Session
  peerConnection: RTCPeerConnection
  dataChannel: RTCDataChannel | null
  fileChannel: RTCDataChannel | null
  incomingFileMetadata: {name: string; size: number; type: string} | null = null
  receivedFileData: ArrayBuffer[] = []
  receivedFileSize: number = 0

  constructor(session: Session, peerId?: string) {
    super()
    this.peerId = peerId || Math.random().toString(36).substring(2, 8)
    this.session = session
    this.peerConnection = new RTCPeerConnection({
      iceServers: [{urls: "stun:stun.l.google.com:19302"}],
    })
    this.dataChannel = null
    this.fileChannel = null
    this.setupPeerConnectionEvents()
    this.session.onEvent((e) => this.handleEvent(e))
  }

  connect() {
    this.sendOffer()
  }

  handleEvent(event: Rumor) {
    console.log("Received event:", event)
    if (event.kind !== 30078) return

    const typeTag = event.tags.find((tag) => tag[0] === "type")
    const content = event.content

    if (!typeTag || !content) return

    switch (typeTag[1]) {
      case "offer":
        this.handleOffer(JSON.parse(content))
        break
      case "answer":
        this.handleAnswer(JSON.parse(content))
        break
      case "candidate":
        this.handleCandidate(JSON.parse(content))
        break
      default:
        console.error("Unknown message type:", typeTag[1])
    }
  }

  async handleOffer(offer: RTCSessionDescriptionInit) {
    await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer))
    const answer = await this.peerConnection.createAnswer()
    await this.peerConnection.setLocalDescription(answer)
    this.send({
      kind: 30078,
      tags: [
        ["l", "webrtc"],
        ["type", "answer"],
      ],
      content: JSON.stringify(answer),
    })
  }

  async handleAnswer(answer: RTCSessionDescriptionInit) {
    await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer))
  }

  async handleCandidate(candidate: RTCIceCandidateInit) {
    await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate))
  }

  setupPeerConnectionEvents() {
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        this.send({
          kind: 30078,
          tags: [
            ["l", "webrtc"],
            ["type", "candidate"],
            ["candidate", event.candidate.toString()],
            ["expiration", (Math.floor(Date.now() / 1000) + 5 * 60).toString()],
          ],
        })
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
      log("Connection state:", this.peerConnection.connectionState)
      if (this.peerConnection.connectionState === "closed") {
        log(`${this.peerId} connection closed`)
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
    this.send({
      kind: 30078,
      tags: [
        ["l", "webrtc"],
        ["type", "offer"],
      ],
      content: JSON.stringify(offer),
    })
    console.log("Sent offer:", offer)
  }

  async sendAnswer(offer: RTCSessionDescriptionInit) {
    await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer))
    const answer = await this.peerConnection.createAnswer()
    await this.peerConnection.setLocalDescription(answer)
    this.send({
      kind: 30078,
      tags: [
        ["l", "webrtc"],
        ["type", "answer"],
      ],
      content: JSON.stringify(answer),
    })
    console.log("Sent answer:", answer)
  }

  private send(eventData: Partial<Rumor>) {
    const {event} = this.session.sendEvent(eventData)
    NDKEventFromRawEvent(event).publish()
    log("Sent event:", eventData)
    return event
  }

  setDataChannel(dataChannel: RTCDataChannel) {
    this.dataChannel = dataChannel
    this.dataChannel.onopen = () => log("Data channel is open")
    this.dataChannel.onmessage = (event) => {
      log("Received message:", event.data)
    }
    this.dataChannel.onclose = () => {
      log("Data channel is closed")
      this.close()
    }
  }

  setFileChannel(fileChannel: RTCDataChannel) {
    this.fileChannel = fileChannel
    this.fileChannel.binaryType = "arraybuffer"
    this.fileChannel.onopen = () => log("File channel is open")
    this.fileChannel.onmessage = (event) => {
      log("File channel received message:", event.data)
      if (typeof event.data === "string") {
        const metadata = JSON.parse(event.data)
        if (metadata.type === "file-metadata") {
          this.incomingFileMetadata = metadata.metadata
          this.receivedFileData = []
          this.receivedFileSize = 0
          log("Received file metadata:", this.incomingFileMetadata)
        }
      } else if (event.data instanceof ArrayBuffer) {
        this.receivedFileData.push(event.data)
        this.receivedFileSize += event.data.byteLength
        log("Received file chunk:", event.data.byteLength, "bytes")
        log("Total received size:", this.receivedFileSize, "bytes")

        if (this.incomingFileMetadata) {
          log("Expected file size:", this.incomingFileMetadata.size, "bytes")
          if (this.receivedFileSize === this.incomingFileMetadata.size) {
            log("File fully received, saving file...")
            this.saveReceivedFile()
          } else {
            log("File not fully received, waiting...")
          }
        } else {
          console.error("No file metadata available")
        }
      }
    }
    this.fileChannel.onclose = () => {
      log("File channel is closed")
    }
  }

  async saveReceivedFile() {
    if (!this.incomingFileMetadata) {
      console.error("No file metadata available")
      return
    }

    const confirmString = `Save ${this.incomingFileMetadata.name} from ${this.peerId}?`
    if (!confirm(confirmString)) {
      log("User did not confirm file save")
      this.incomingFileMetadata = null
      this.receivedFileData = []
      this.receivedFileSize = 0
      return
    }

    log("Saving file with metadata:", this.incomingFileMetadata)
    log("Total received file data size:", this.receivedFileSize)

    const blob = new Blob(this.receivedFileData, {type: this.incomingFileMetadata.type})
    log("Created Blob:", blob)

    const url = URL.createObjectURL(blob)
    log("Created Object URL:", url)

    const a = document.createElement("a")
    a.href = url
    a.download = this.incomingFileMetadata.name
    document.body.appendChild(a)
    log("Appended anchor element to body:", a)

    a.click()
    log("Triggered download")

    document.body.removeChild(a)
    log("Removed anchor element from body")

    URL.revokeObjectURL(url)
    log("Revoked Object URL")

    // Reset file data
    this.incomingFileMetadata = null
    this.receivedFileData = []
    this.receivedFileSize = 0
    log("Reset file data")
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
        log("File channel is open, sending metadata")
        fileChannel.send(JSON.stringify(metadata))

        // Read and send the file as binary data
        const reader = new FileReader()
        reader.onload = () => {
          if (reader.result && reader.result instanceof ArrayBuffer) {
            fileChannel.send(reader.result)
          }
        }
        reader.readAsArrayBuffer(file)
      }
    } else {
      console.error("Peer connection is not connected")
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
