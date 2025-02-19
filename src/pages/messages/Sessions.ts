import {showNotification, subscribeToAuthorDMNotifications} from "@/utils/notifications"
import {Session, deserializeSessionState} from "nostr-double-ratchet"
import {Filter, VerifiedEvent} from "nostr-tools"
import {profileCache} from "@/utils/memcache"
import AnimalName from "@/utils/AnimalName"
import {MessageType} from "./Message"
import {localState} from "irisdb"
import {ndk} from "@/utils/ndk"

const sessions = new Map<string, Session | undefined>()

const openedAt = Date.now()

const subscribe = (filter: Filter, onEvent: (event: VerifiedEvent) => void) => {
  const sub = ndk().subscribe(filter)
  sub.on("event", (event) => {
    onEvent(event as unknown as VerifiedEvent)
  })
  return () => sub.stop()
}

export async function getSession(id: string): Promise<Session | undefined> {
  if (sessions.has(id)) return sessions.get(id)

  // Mark as loading to prevent duplicate work
  sessions.set(id, undefined)

  const state = await localState.get("sessions").get(id).get("state").once()

  if (typeof state === "string" && state !== null) {
    const deserialized = deserializeSessionState(state)
    const session = new Session(subscribe, deserialized)
    sessions.set(id, session)
    return session
  }

  return undefined
}

// function that gets all our sessions and subscribes to messages from them
export function loadSessions() {
  return localState.get("sessions").on(async (sessionData) => {
    for (const [id, data] of Object.entries(sessionData || {})) {
      if (sessions.has(id)) continue
      if (data) {
        const sessionId = id.split("/").pop()!
        const session = await getSession(sessionId)
        if (!session?.onMessage) continue

        session.onMessage(async (msg) => {
          const message: MessageType = {
            id: msg.id,
            sender: id.split(":").shift()!,
            content: msg.data,
            time: msg.time,
          }
          localState.get("sessions").get(id).get("messages").get(msg.id).put(message)
          localState.get("sessions").get(id).get("latest").put(message)

          // If visible, update lastSeen. If not, show notification.
          if (
            window.location.pathname.includes(`/messages/${id}`) &&
            document.visibilityState !== "visible"
          ) {
            localState.get("sessions").get(id).get("lastSeen").put(Date.now())
          } else if (msg.time > openedAt) {
            const sender = id.split(":").shift()!
            let profile = profileCache.get(sender)
            if (!profile) {
              try {
                profile = await ndk()
                  .getUser({pubkey: sender})
                  .fetchProfile({closeOnEose: true})
              } catch (e) {
                console.warn("Failed to fetch profile for", sender, e)
              }
            }
            const name =
              profile?.name ||
              profile?.display_name ||
              profile?.displayName ||
              profile?.username ||
              profile?.nip05?.split("@")[0] ||
              (sender && AnimalName(sender))
            showNotification(String(name), {
              body: msg.data.length > 100 ? msg.data.slice(0, 100) + "..." : msg.data,
              icon: profile?.picture
                ? `https://imgproxy.iris.to/insecure/rs:fill:128:128/plain/${profile.picture}`
                : "/favicon.png",
              data: {url: `/messages/${id}`},
            })
          }
        })
      }
    }
    subscribeToAuthorDMNotifications()
  })
}

export const getSessions = () => sessions
