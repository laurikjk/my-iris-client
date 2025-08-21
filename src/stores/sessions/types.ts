import {Session} from "nostr-double-ratchet/src"

export interface SessionData {
  session: Session
  userPubKey: string
  deviceId: string
}
