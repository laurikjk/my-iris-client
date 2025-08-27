import {PublicKey} from "@/shared/utils/PublicKey"
import {NDKEventFromRawEvent, RawEvent} from "@/utils/nostr"
import {getEncryptFunction} from "@/utils/nostrCrypto"
import {
  Invite,
  Session,
  serializeSessionState,
  deserializeSessionState,
} from "nostr-double-ratchet/src"
import {Filter, VerifiedEvent} from "nostr-tools"

export type SubscribeFunction = (
  filter: Filter,
  onEvent: (event: VerifiedEvent) => void
) => () => void

//): ((plaintext: string, pubkey: string) => Promise<string>) | Uint8Array => {

export type EncryptFunction = (plaintext: string, pubkey: string) => Promise<string>

//NDKEventFromRawEvent(event)
//  .publish()
//  .then((res) => console.log("published", res))
export type PublishFunction = (event: RawEvent) => Promise<void>

export interface StorageAdapter {
  getItem: (key: string) => Promise<string | null>
  setItem: (key: string, value: string) => Promise<void>
  removeItem: (key: string) => Promise<void>
}
export interface SessionManagerConfig {
  myPublicKey: string
  myPrivateKey: string
  storageAdapter: StorageAdapter
  subscribe: SubscribeFunction
  publishEvent: PublishFunction
}

//
// Helper fucntions
//

//
// SessionManager
//

export class SessionManager {
  private myPublicKey: string
  private myPrivateKey: string
  private subscribe: (
    filter: Filter,
    onEvent: (event: VerifiedEvent) => void
  ) => () => void
  private encrypt: EncryptFunction | Uint8Array
  private publishEvent: PublishFunction | undefined
  private storage: StorageAdapter

  // Chats
  //private users: Record<string, string> = {} // user record -> device records
  //private devices: Record<string, Session> = {} // device record -> session
  //private oldSessions: Record<string, Session[]> = {} // device record -> old sessions

  // unsubs
  private inviteUnsubs: Map<string, () => void> = new Map()
  private sessionUnsubs: Map<string, () => void> = new Map()

  constructor(config: SessionManagerConfig) {
    const {myPublicKey, myPrivateKey, subscribe, storageAdapter} = config
    this.myPublicKey = myPublicKey
    this.myPrivateKey = myPrivateKey
    this.subscribe = subscribe
    this.encrypt = getEncryptFunction(this.myPrivateKey)
    this.storage = storageAdapter
  }

  async listenToUser(userPubKey: string) {
    const myPubKeyHex = this.myPublicKey ? new PublicKey(this.myPublicKey).toString() : ""
    const unsubInvite = Invite.fromUser(myPubKeyHex, this.subscribe, (invite) => {
      const encrypt = getEncryptFunction(this.myPrivateKey)
      invite
        .accept(this.subscribe, this.myPublicKey, encrypt)
        .then(({session, event}) => {
          if (!invite.deviceId) {
            return
          }
          const deviceRecord = `${userPubKey}/${invite.deviceId}`
          this.storage.setItem(
            `session/${deviceRecord}`,
            serializeSessionState(session.state)
          )
        })
    })
    this.inviteUnsubs.set(userPubKey, unsubInvite)
  }
}
