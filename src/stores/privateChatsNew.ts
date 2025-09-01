/**
 * @deprecated This store is deprecated and will be removed in a future version.
 * Use usePrivateChatsStoreNew from './privateChats.new' instead.
 *
 * This was an experimental implementation that has been superseded by the new
 * centralized store with proper SessionManager integration.
 */

import {createJSONStorage, persist} from "zustand/middleware"
import {MessageType} from "@/pages/chats/message/Message"
import {comparator} from "@/pages/chats/utils/messageGrouping"
import {usePrivateMessagesStore} from "./privateMessages"
import {SortedMap} from "@/utils/SortedMap/SortedMap"
import localforage from "localforage"
import {create} from "zustand"
import {Filter, UnsignedEvent, VerifiedEvent} from "nostr-tools"
import {useUserStore} from "./user"
import Dexie, {EntityTable} from "dexie"
import {Invite, Session} from "nostr-double-ratchet/src"
import {ndk} from "@/utils/ndk"
import {PublicKey} from "@/shared/utils/PublicKey"
import {getEncryptFunction} from "@/utils/nostrCrypto"
import {NDKEventFromRawEvent} from "@/utils/nostr"

interface PrivateChatsStoreState {
  chats: Map<string, {lastSeen: number}> // userPubKey -> chat metadata
}

interface PrivateChatsStoreActions {
  sendToUser: (userPubKey: string, event: Partial<UnsignedEvent>) => Promise<string>
}

type PrivateChatsStore = PrivateChatsStoreState & PrivateChatsStoreActions

interface UserRecord {
  publicKey: string
  sessionId: string
}

// Dexie init to store chats and serialized sessions
class PrivateChatDb extends Dexie {
  public userRecords!: EntityTable<UserRecord, "publicKey">
  constructor() {
    super("PrivateChats")
    this.version(1).stores({
      userRecords: "publicKey",
    })
  }
}

const privateChatDb = new PrivateChatDb()

class SessionDb extends Dexie {
  public sessions!: EntityTable<{id: string; serializedSession: string}, "id">
  constructor() {
    super("Sessions")
    this.version(1).stores({
      sessions: "id",
    })
  }
}

const sessionDb = new SessionDb()

const subscribe = (filter: Filter, onEvent: (event: VerifiedEvent) => void) => {
  const sub = ndk().subscribe(filter)
  sub.on("event", (e) => onEvent(e as unknown as VerifiedEvent))
  return () => sub.stop()
}

export const usePrivateChatsStore = create<PrivateChatsStore>()(
  persist(
    (set, get) => ({
      chats: new Map(),
      sendToUser: async (userPubKey: string, event: Partial<UnsignedEvent>) => {
        const myPubKey = useUserStore.getState().publicKey
        const myPrivKey = useUserStore.getState().privateKey
        set((state) => {
          const chats = new Map(state.chats)
          if (!chats.has(userPubKey)) {
            chats.set(userPubKey, {lastSeen: 0})
          }
          return {chats}
        })
        // 1. Check if we have UserRecords or fetch invites and create one
        const userRecord = await privateChatDb.userRecords.get(userPubKey)
        if (!userRecord) {
          const myPubKeyHex = myPubKey ? new PublicKey(myPubKey).toString() : ""
          const unsubInvite = Invite.fromUser(myPubKeyHex, subscribe, (invite) => {
            privateChatDb.userRecords.get(userPubKey).then((existing) => {
              if (existing) {
                return
              }
              if (!invite.deviceId) {
                return
              }
              const encrypt = getEncryptFunction(myPrivKey)
              invite
                .accept(
                  (filter, onEvent) => subscribe(filter, onEvent),
                  myPubKey,
                  encrypt
                )
                .then(({session, event}) => {
                  NDKEventFromRawEvent(event)
                    .publish()
                    .then((res) => console.log("published", res))

                  // Use the actual deviceId from invite, not session.name
                  const sessionId = `${invite.inviter}:${invite.deviceId}`

                  // Add session to sessions
                })
            })
          })
        }

        console.log("event to send:", event)

        // 2. Fetch Sessions for the user
        // 3. Fetch Sessions for self
        // 4. Send event to all sessions
        return myPubKey
      },
      updateLastSeen: (userPubKey: string) => {
        const chats = new Map(get().chats)
        const chat = chats.get(userPubKey) || {lastSeen: 0}
        chat.lastSeen = Date.now()
        chats.set(userPubKey, chat)
        set({chats})
      },
      getChatsList: () => {
        const chats = get().chats
        const userPubKeys = new Set(chats.keys())
        return Array.from(userPubKeys)
          .map((userPubKey) => {
            const events = usePrivateMessagesStore.getState().events
            const messages =
              events.get(userPubKey) ?? new SortedMap<string, MessageType>([], comparator)
            const lastMessage = messages.last()?.[1]
            const chatData = chats.get(userPubKey) || {lastSeen: 0}
            const myPubKey = useUserStore.getState().publicKey
            const unreadCount = Array.from(messages.values()).filter(
              (msg: MessageType) => {
                if (msg.pubkey === myPubKey) return false // Don't count our own messages
                const msgTime = msg.created_at ? msg.created_at * 1000 : 0
                return msgTime > chatData.lastSeen
              }
            ).length

            return {
              userPubKey,
              lastMessage,
              lastMessageTime: lastMessage?.created_at
                ? lastMessage.created_at * 1000
                : 0,
              unreadCount,
            }
          })
          .sort((a, b) => b.lastMessageTime - a.lastMessageTime)
      },
    }),
    {
      name: "privateChats",
      storage: createJSONStorage(() => localforage),
      partialize: (state: PrivateChatsStore) => ({
        chats: Array.from(state.chats.entries()),
      }),
      merge: (persistedState: unknown, currentState: PrivateChatsStore) => {
        const state = (persistedState || {chats: []}) as {
          chats: [string, {lastSeen: number}][]
        }
        return {
          ...currentState,
          chats: new Map(state.chats || []),
        }
      },
    }
  )
)
