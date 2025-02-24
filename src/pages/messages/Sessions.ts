import {
  Rumor,
  Session,
  deserializeSessionState,
  getMillisecondTimestamp,
  serializeSessionState,
} from "nostr-double-ratchet"
import {showNotification, subscribeToDMNotifications} from "@/utils/notifications"
import {getPeerConnection} from "./webrtc/PeerConnection"
import {generateProxyUrl} from "@/shared/utils/imgproxy"
import {Filter, VerifiedEvent} from "nostr-tools"
import {profileCache} from "@/utils/memcache"
import {JsonObject, localState} from "irisdb"
import AnimalName from "@/utils/AnimalName"
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
      if (sessions.has(id) || !data) continue

      const session = await getSession(id)
      if (!session?.onEvent) continue

      // TODO called twice?
      session.onEvent(async (event) => {
        handleNewSessionEvent(id, session, event)
      })
    }
    subscribeToDMNotifications()
  })
}

async function handleNewSessionEvent(id: string, session: Session, event: Rumor) {
  saveSessionState(id, session)
  if (event.kind === 30078) {
    console.log("got 30078", event)
    const connection = getPeerConnection(session, id)
    connection?.handleEvent(event)
    return
  }
  localState.get("sessions").get(id).get("events").get(event.id).put(event)
  await updateLatestMessageIfNewer(id, event)
  handleEventNotification(id, event)
}

function saveSessionState(id: string, session: Session) {
  localState
    .get("sessions")
    .get(id)
    .get("state")
    .put(serializeSessionState(session.state))
}

async function updateLatestMessageIfNewer(id: string, event: Rumor) {
  let latest
  try {
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Timeout")), 100)
    )
    latest = await Promise.race([
      localState.get("sessions").get(id).get("latest").once(),
      timeoutPromise,
    ])
  } catch (e) {
    latest = undefined
  }

  if (
    !latest ||
    !(latest as JsonObject).created_at ||
    getMillisecondTimestamp(latest as Rumor) < getMillisecondTimestamp(event)
  ) {
    localState.get("sessions").get(id).get("latest").put(event)
  }
}

function handleEventNotification(id: string, event: Rumor) {
  // If visible, update lastSeen. If not, show notification.
  if (
    window.location.pathname.includes(`/messages`) &&
    window.history.state?.id === id && // TODO this is always false. figure out how to check it.
    document.visibilityState !== "visible"
  ) {
    localState.get("sessions").get(id).get("lastSeen").put(Date.now())
  } else if (event.created_at * 1000 > openedAt) {
    showEventNotification(id, event)
  }
}

async function showEventNotification(id: string, event: Rumor) {
  const sender = id.split(":").shift()!
  let profile = profileCache.get(sender)

  if (!profile) {
    try {
      profile = await ndk().getUser({pubkey: sender}).fetchProfile({closeOnEose: true})
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
    body:
      event.content.length > 100 ? event.content.slice(0, 100) + "..." : event.content,
    icon: profile?.picture
      ? generateProxyUrl(String(profile.picture), {width: 128, square: true})
      : "/favicon.png",
    data: {url: `/messages`}, // TODO add session id state param
  })
}

export const getSessions = () => sessions
