import {comparator} from "@/pages/chats/utils/messageGrouping"
import type {MessageType} from "@/pages/chats/message/Message"
import {SortedMap} from "@/utils/SortedMap/SortedMap"
import Dexie, {type EntityTable} from "dexie"

export type MessageEntity = MessageType & {session_id: string}
export interface SessionMetaEntity {
  session_id: string
  last_seen: number
}

class MessageDb extends Dexie {
  public messages!: EntityTable<MessageEntity, "id">
  public session_meta!: EntityTable<SessionMetaEntity, "session_id">
  constructor() {
    super("Messages")
    this.version(1).stores({
      messages: "id, session_id, created_at",
    })
    this.version(2)
      .stores({
        messages: "id, session_id, created_at",
        session_meta: "session_id",
      })
      .upgrade(async (tx) => {
        await tx.table("session_meta").clear()
      })
  }
}

const db = new MessageDb()

export async function loadAll(): Promise<Map<string, SortedMap<string, MessageType>>> {
  const msgArray = await db.messages.toArray()
  const sessionMap = new Map<string, SortedMap<string, MessageType>>()
  msgArray.forEach((msg) => {
    const {session_id, ...event} = msg
    const m =
      sessionMap.get(session_id) || new SortedMap<string, MessageType>([], comparator)
    m.set(event.id, event)
    sessionMap.set(session_id, m)
  })
  return sessionMap
}

export async function loadLastSeen(): Promise<Map<string, number>> {
  const rows = await db.session_meta.toArray()
  return new Map(rows.map(({session_id, last_seen}) => [session_id, last_seen]))
}

export async function saveLastSeen(sessionId: string, timestamp: number): Promise<void> {
  await db.session_meta.put({session_id: sessionId, last_seen: timestamp})
}

export async function deleteLastSeen(sessionId: string): Promise<void> {
  await db.session_meta.delete(sessionId)
}

export async function clearLastSeen(): Promise<void> {
  await db.session_meta.clear()
}

export async function save(sessionId: string, message: MessageType): Promise<void> {
  const msg = {session_id: sessionId, ...message}
  await db.messages.put(msg, msg.id)
}

export async function deleteBySession(sessionId: string): Promise<void> {
  await db.messages.where("session_id").equals(sessionId).delete()
}

export async function clearAll(): Promise<void> {
  await db.messages.clear()
}

export async function deleteMessage(sessionId: string, messageId: string): Promise<void> {
  await db.messages
    .where("session_id")
    .equals(sessionId)
    .and((msg) => msg.id === messageId)
    .delete()
}

export async function getById(messageId: string): Promise<MessageType | undefined> {
  const msg = await db.messages.get(messageId)
  if (!msg) return msg
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const {session_id, ...event} = msg
  return event
}
