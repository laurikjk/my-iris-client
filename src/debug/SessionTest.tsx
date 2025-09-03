import {useState, useEffect, useRef} from "react"
import SessionManager from "../session/SessionManager"
import {generateSecretKey, getPublicKey} from "nostr-tools"
import {InMemoryStorageAdapter} from "../session/StorageAdapter"
import {KIND_CHAT_MESSAGE} from "../utils/constants"
import {Rumor} from "nostr-double-ratchet"
import NDK, {NDKEvent, NDKPrivateKeySigner, NDKFilter} from "@nostr-dev-kit/ndk"

type EventLog = {
  timestamp: number
  type: string
  source: string
  data: any
}

type Message = {
  content: string
  from: string
  timestamp: number
  isOwn: boolean
}

export default function SessionTest() {
  const [aliceManager, setAliceManager] = useState<SessionManager | null>(null)
  const [bobManager, setBobManager] = useState<SessionManager | null>(null)
  const [aliceMessages, setAliceMessages] = useState<Message[]>([])
  const [bobMessages, setBobMessages] = useState<Message[]>([])
  const [aliceInput, setAliceInput] = useState("")
  const [bobInput, setBobInput] = useState("")
  const [eventLog, setEventLog] = useState<EventLog[]>([])
  const [aliceInfo, setAliceInfo] = useState({pubkey: "", deviceId: "alice-device-1"})
  const [bobInfo, setBobInfo] = useState({pubkey: "", deviceId: "bob-device-1"})

  const aliceSecretKey = useRef(generateSecretKey())
  const bobSecretKey = useRef(generateSecretKey())
  const aliceNDK = useRef<NDK | null>(null)
  const bobNDK = useRef<NDK | null>(null)

  const addEventLog = (type: string, source: string, data: any) => {
    const logEntry = {
      timestamp: Date.now(),
      type,
      source,
      data,
    }
    setEventLog((prev) => [...prev.slice(-19), logEntry]) // Keep last 20
  }

  // Create NDK instances for Alice and Bob
  const createNDK = (secretKey: Uint8Array, name: string) => {
    const signer = new NDKPrivateKeySigner(secretKey)
    const ndk = new NDK({
      explicitRelayUrls: [
        "wss://temp.iris.to/",
        "wss://nos.lol", 
        "wss://relay.nostr.band",
        "wss://relay.f7z.io",
        "wss://relay.damus.io"
      ],
      signer: signer,
    })

    // Add event listeners for debugging
    ndk.on("connect", () => {
      addEventLog("NDK_CONNECT", name.toLowerCase(), "Connected to relay")
    })

    ndk.on("disconnect", () => {
      addEventLog("NDK_DISCONNECT", name.toLowerCase(), "Disconnected from relay")
    })

    ndk.on("event", (event: NDKEvent) => {
      addEventLog("NDK_EVENT", name.toLowerCase(), {
        kind: event.kind,
        pubkey: event.pubkey?.slice(0, 16),
        content: event.content?.slice(0, 100),
      })
    })

    return ndk
  }

  // NDK-compatible subscribe function
  const createSubscribe = (ndk: NDK, name: string) => {
    return (filter: NDKFilter, onEvent: (event: any) => void) => {
      addEventLog("SUBSCRIBE", name.toLowerCase(), filter)

      const subscription = ndk.subscribe(filter)

      subscription.on("event", (event: NDKEvent) => {
        addEventLog("SUB_EVENT", name.toLowerCase(), {
          kind: event.kind,
          pubkey: event.pubkey?.slice(0, 16),
          id: event.id?.slice(0, 16),
        })
        onEvent(event.rawEvent())
      })

      subscription.on("eose", () => {
        addEventLog("EOSE", name.toLowerCase(), "End of stored events")
      })

      subscription.start()

      return () => {
        addEventLog("UNSUBSCRIBE", name.toLowerCase(), "Closing subscription")
        subscription.stop()
      }
    }
  }

  // NDK-compatible publish function
  const createPublish = (ndk: NDK, name: string) => {
    return async (event: any) => {
      addEventLog("PUBLISH", name.toLowerCase(), {
        kind: event.kind,
        content: event.content?.slice(0, 100),
        tags: event.tags?.length,
      })

      const ndkEvent = new NDKEvent(ndk, event)
      await ndkEvent.sign()

      try {
        const result = await ndkEvent.publish()
        addEventLog("PUBLISH_SUCCESS", name.toLowerCase(), {
          eventId: ndkEvent.id?.slice(0, 16),
          relaysPublished: result.size,
        })
        return ndkEvent.rawEvent()
      } catch (error) {
        addEventLog("PUBLISH_ERROR", name.toLowerCase(), error)
        throw error
      }
    }
  }

  useEffect(() => {
    const initManagers = async () => {
      // Alice setup
      const aliceStorage = new InMemoryStorageAdapter()
      const alicePubkey = getPublicKey(aliceSecretKey.current)

      aliceNDK.current = createNDK(aliceSecretKey.current, "Alice")
      await aliceNDK.current.connect()

      const aliceManager = new SessionManager(
        aliceSecretKey.current,
        "alice-device-1",
        createSubscribe(aliceNDK.current, "Alice"),
        createPublish(aliceNDK.current, "Alice"),
        aliceStorage
      )

      aliceManager.onEvent((event: Rumor, from: string) => {
        addEventLog("MESSAGE_RECEIVED", "alice", {event, from})
        setAliceMessages((prev) => [
          ...prev,
          {
            content: event.content || "",
            from,
            timestamp: Date.now(),
            isOwn: from === alicePubkey,
          },
        ])
      })

      await aliceManager.init()
      setAliceManager(aliceManager)
      setAliceInfo({pubkey: alicePubkey, deviceId: "alice-device-1"})

      // Bob setup
      const bobStorage = new InMemoryStorageAdapter()
      const bobPubkey = getPublicKey(bobSecretKey.current)

      bobNDK.current = createNDK(bobSecretKey.current, "Bob")
      await bobNDK.current.connect()

      const bobManager = new SessionManager(
        bobSecretKey.current,
        "bob-device-1",
        createSubscribe(bobNDK.current, "Bob"),
        createPublish(bobNDK.current, "Bob"),
        bobStorage
      )

      bobManager.onEvent((event: Rumor, from: string) => {
        addEventLog("MESSAGE_RECEIVED", "bob", {event, from})
        setBobMessages((prev) => [
          ...prev,
          {
            content: event.content || "",
            from,
            timestamp: Date.now(),
            isOwn: from === bobPubkey,
          },
        ])
      })

      await bobManager.init()
      setBobManager(bobManager)
      setBobInfo({pubkey: bobPubkey, deviceId: "bob-device-1"})
    }

    initManagers().catch(console.error)

    return () => {
      aliceManager?.close()
      bobManager?.close()
      // Close NDK connections
      aliceNDK.current?.destroy()
      bobNDK.current?.destroy()
    }
  }, [])

  const sendAliceMessage = async () => {
    if (!aliceManager || !aliceInput.trim()) return

    const message = {
      kind: KIND_CHAT_MESSAGE,
      content: aliceInput,
      created_at: Math.floor(Date.now() / 1000),
    }

    addEventLog("SENDING_MESSAGE", "alice", message)
    await aliceManager.sendEvent(bobInfo.pubkey, message)

    setAliceMessages((prev) => [
      ...prev,
      {
        content: aliceInput,
        from: aliceInfo.pubkey,
        timestamp: Date.now(),
        isOwn: true,
      },
    ])
    setAliceInput("")
  }

  const sendBobMessage = async () => {
    if (!bobManager || !bobInput.trim()) return

    const message = {
      kind: KIND_CHAT_MESSAGE,
      content: bobInput,
      created_at: Math.floor(Date.now() / 1000),
    }

    addEventLog("SENDING_MESSAGE", "bob", message)
    await bobManager.sendEvent(aliceInfo.pubkey, message)

    setBobMessages((prev) => [
      ...prev,
      {
        content: bobInput,
        from: bobInfo.pubkey,
        timestamp: Date.now(),
        isOwn: true,
      },
    ])
    setBobInput("")
  }

  const resetAll = () => {
    setAliceMessages([])
    setBobMessages([])
    setEventLog([])
    // Recreate managers would require reloading - for now just clear UI
  }

  return (
    <div className="p-4 max-w-6xl mx-auto">
      <div className="flex items-center gap-4 mb-4">
        <h1 className="text-2xl font-bold">SessionManager Debug Chat (NDK)</h1>
        <button onClick={resetAll} className="btn btn-sm btn-secondary">
          Reset
        </button>
      </div>

      {/* Status */}
      <div className="mb-4 p-4 bg-white border rounded text-sm text-black">
        <div className="font-medium">Connection Status:</div>
        <div>
          Alice NDK:{" "}
          <span
            className={
              aliceNDK.current
                ? "text-green-600 font-semibold"
                : "text-red-600 font-semibold"
            }
          >
            {aliceNDK.current ? "Connected" : "Disconnected"}
          </span>
        </div>
        <div>
          Bob NDK:{" "}
          <span
            className={
              bobNDK.current
                ? "text-green-600 font-semibold"
                : "text-red-600 font-semibold"
            }
          >
            {bobNDK.current ? "Connected" : "Disconnected"}
          </span>
        </div>
        <div>
          Relays: <span className="font-mono">Public Nostr relays (damus.io, nos.lol, etc.)</span>
        </div>
      </div>

      {/* Chat Interface */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        {/* Alice Column */}
        <div className="border rounded-lg p-4 bg-white">
          <h2 className="font-semibold text-lg mb-2 text-black">Alice</h2>
          <div className="text-xs text-gray-700 mb-4">
            <div>
              Device: <span className="font-mono">{aliceInfo.deviceId}</span>
            </div>
            <div>
              Pubkey:{" "}
              <span className="font-mono">{aliceInfo.pubkey.slice(0, 16)}...</span>
            </div>
          </div>

          {/* Messages */}
          <div className="h-64 border rounded bg-gray-50 p-2 mb-4 overflow-y-auto">
            {aliceMessages.map((msg, i) => (
              <div
                key={i}
                className={`mb-2 ${msg.isOwn ? "text-blue-600" : "text-green-600"}`}
              >
                <span className="text-xs text-gray-500">
                  {new Date(msg.timestamp).toLocaleTimeString()}
                </span>
                <div>{msg.content}</div>
              </div>
            ))}
          </div>

          {/* Input */}
          <div className="flex gap-2">
            <input
              type="text"
              value={aliceInput}
              onChange={(e) => setAliceInput(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && sendAliceMessage()}
              className="flex-1 border border-gray-300 rounded px-3 py-2 text-black bg-white focus:outline-none focus:border-blue-500"
              placeholder="Type message..."
            />
            <button
              onClick={sendAliceMessage}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 font-medium"
            >
              Send
            </button>
          </div>
        </div>

        {/* Bob Column */}
        <div className="border rounded-lg p-4 bg-white">
          <h2 className="font-semibold text-lg mb-2 text-black">Bob</h2>
          <div className="text-xs text-gray-700 mb-4">
            <div>
              Device: <span className="font-mono">{bobInfo.deviceId}</span>
            </div>
            <div>
              Pubkey: <span className="font-mono">{bobInfo.pubkey.slice(0, 16)}...</span>
            </div>
          </div>

          {/* Messages */}
          <div className="h-64 border rounded bg-gray-50 p-2 mb-4 overflow-y-auto">
            {bobMessages.map((msg, i) => (
              <div
                key={i}
                className={`mb-2 ${msg.isOwn ? "text-blue-600" : "text-green-600"}`}
              >
                <span className="text-xs text-gray-500">
                  {new Date(msg.timestamp).toLocaleTimeString()}
                </span>
                <div>{msg.content}</div>
              </div>
            ))}
          </div>

          {/* Input */}
          <div className="flex gap-2">
            <input
              type="text"
              value={bobInput}
              onChange={(e) => setBobInput(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && sendBobMessage()}
              className="flex-1 border border-gray-300 rounded px-3 py-2 text-black bg-white focus:outline-none focus:border-green-500"
              placeholder="Type message..."
            />
            <button
              onClick={sendBobMessage}
              className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 font-medium"
            >
              Send
            </button>
          </div>
        </div>
      </div>

      {/* Event Log */}
      <div className="border rounded-lg p-4">
        <h2 className="font-semibold text-lg mb-2">Event Log (NDK)</h2>
        <div className="h-96 bg-gray-900 text-green-400 font-mono text-xs p-2 overflow-y-auto">
          {eventLog.map((log, i) => (
            <div key={i} className="mb-1">
              <span className="text-gray-500">
                {new Date(log.timestamp).toLocaleTimeString()}
              </span>{" "}
              <span
                className={`font-semibold ${
                  log.source === "alice"
                    ? "text-blue-400"
                    : log.source === "bob"
                      ? "text-green-400"
                      : "text-yellow-400"
                }`}
              >
                [{log.source.toUpperCase()}]
              </span>{" "}
              <span className="text-white">{log.type}</span>
              <div className="ml-4 text-gray-400">
                {JSON.stringify(log.data, null, 2).slice(0, 200)}
                {JSON.stringify(log.data).length > 200 ? "..." : ""}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
