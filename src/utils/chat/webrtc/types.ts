function uuidv4() {
  return crypto.randomUUID()
}

export interface OfferMessage {
  type: "offer"
  offer: unknown
  recipient: string
  peerId: string
}

export interface AnswerMessage {
  type: "answer"
  answer: unknown
  recipient: string
  peerId: string
}

export interface CandidateMessage {
  type: "candidate"
  candidate: unknown
  recipient: string
  peerId: string
}

export interface HelloMessage {
  type: "hello"
  peerId: string
}

export type SignalingMessage =
  | OfferMessage
  | AnswerMessage
  | CandidateMessage
  | HelloMessage

export class PeerId {
  readonly pubkey: string
  readonly uuid: string
  private readonly str: string

  constructor(pubkey: string, peerId?: string) {
    this.uuid = peerId || uuidv4()
    this.pubkey = pubkey
    this.str = `${pubkey}:${this.uuid}`
  }

  toString() {
    return this.str
  }

  short() {
    return `${this.pubkey.slice(0, 8)}:${this.uuid.slice(0, 6)}`
  }

  static fromString(str: string) {
    const [publicKey, peerId] = str.split(":")
    if (!publicKey || !peerId) {
      throw new Error("Invalid peer string " + str)
    }
    return new PeerId(publicKey, peerId)
  }
}
