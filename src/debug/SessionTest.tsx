import {useState, useEffect, useRef} from "react"
import SessionManager from "../session/SessionManager"
import {generateSecretKey, getPublicKey, VerifiedEvent} from "nostr-tools"
import {LocalStorageAdapter} from "../session/StorageAdapter"
import {Rumor, NostrPublish} from "nostr-double-ratchet"
import NDK, {NDKEvent, NDKPrivateKeySigner, NDKFilter} from "@nostr-dev-kit/ndk"

type EventLog = {
  timestamp: number
  type: string
  source: string
  data: unknown
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
  const [aliceConnected, setAliceConnected] = useState(false)
  const [bobConnected, setBobConnected] = useState(false)
  const [showSessionDetails, setShowSessionDetails] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [aliceSetupBob, setAliceSetupBob] = useState(false)
  const [bobSetupAlice, setBobSetupAlice] = useState(false)

  const aliceSecretKey = useRef(generateSecretKey())
  const bobSecretKey = useRef(generateSecretKey())
  const aliceNDK = useRef<NDK | null>(null)
  const bobNDK = useRef<NDK | null>(null)
  const aliceSeenMessages = useRef(new Set<string>())
  const bobSeenMessages = useRef(new Set<string>())

  // Persistent storage instances to test session restoration
  const aliceStorage = useRef(new LocalStorageAdapter("alice_session_"))
  const bobStorage = useRef(new LocalStorageAdapter("bob_session_"))

  const addEventLog = (type: string, source: string, data: unknown) => {
    const logEntry = {
      timestamp: Date.now(),
      type,
      source,
      data,
    }
    setEventLog((prev) => [...prev, logEntry]) // Keep last 20
  }

  const getSourceColor = (source: string) => {
    if (source === "alice") return "text-blue-400"
    if (source === "bob") return "text-green-400"
    return "text-yellow-400"
  }

  // Create NDK instances for Alice and Bob
  const createNDK = (secretKey: Uint8Array) => {
    const signer = new NDKPrivateKeySigner(secretKey)
    const ndk = new NDK({
      explicitRelayUrls: [
        "wss://temp.iris.to/",
        "wss://nos.lol",
        "wss://relay.nostr.band",
        "wss://relay.f7z.io",
        "wss://relay.damus.io",
      ],
      signer: signer,
    })

    // NDK doesn't have these events - we'll track connection differently

    return ndk
  }

  // NDK-compatible subscribe function
  const createSubscribe = (ndk: NDK, name: string) => {
    return (filter: NDKFilter, onEvent: (event: VerifiedEvent) => void) => {
      addEventLog("SUBSCRIBE", name.toLowerCase(), filter)

      const subscription = ndk.subscribe(filter)

      subscription.on("event", (event: NDKEvent) => {
        addEventLog("SUB_EVENT", name.toLowerCase(), {
          kind: event.kind,
          pubkey: event.pubkey,
          id: event.id,
        })
        onEvent(event as unknown as VerifiedEvent)
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
  const createPublish = (ndk: NDK, name: string): NostrPublish => {
    return async (event) => {
      addEventLog("PUBLISH", name.toLowerCase(), {
        kind: event.kind,
        content: event.content,
        tags: Array.isArray(event.tags) ? event.tags.length : 0,
      })

      try {
        const e = new NDKEvent(ndk, event)
        e.publish()

        addEventLog("PUBLISH_SUCCESS", name.toLowerCase(), {
          published: true,
        })
        return event as VerifiedEvent
      } catch (error) {
        addEventLog("PUBLISH_ERROR", name.toLowerCase(), error)
        throw error
      }
    }
  }

  useEffect(() => {
    initManagers().catch(console.error)

    return () => {
      aliceManager?.close()
      bobManager?.close()
      // Close NDK connections - NDK doesn't have destroy method
      // Connections will be cleaned up automatically
    }
  }, [])

  const sendAliceMessage = async () => {
    if (!aliceManager || !aliceInput.trim()) return

    addEventLog("SENDING_MESSAGE", "alice", {content: aliceInput})

    const sentMessage = await aliceManager.sendMessage(bobInfo.pubkey, aliceInput)

    // Add to Alice's chat history immediately
    setAliceMessages((prev) => [
      ...prev,
      {
        content: sentMessage.content || "",
        from: aliceInfo.pubkey,
        timestamp: Date.now(),
        isOwn: true,
      },
    ])

    setAliceInput("")
  }

  const sendBobMessage = async () => {
    if (!bobManager || !bobInput.trim()) return

    addEventLog("SENDING_MESSAGE", "bob", {content: bobInput})

    const sentMessage = await bobManager.sendMessage(aliceInfo.pubkey, bobInput)

    // Add to Bob's chat history immediately
    setBobMessages((prev) => [
      ...prev,
      {
        content: sentMessage.content || "",
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
    aliceSeenMessages.current.clear()
    bobSeenMessages.current.clear()
    setAliceSetupBob(false)
    setBobSetupAlice(false)
    // Recreate managers would require reloading - for now just clear UI
  }

  const clearStorage = async () => {
    // Clear localStorage for both Alice and Bob
    const aliceKeys = await aliceStorage.current.list()
    const bobKeys = await bobStorage.current.list()

    addEventLog(
      "CLEARING_STORAGE",
      "system",
      `Clearing ${aliceKeys.length + bobKeys.length} stored sessions`
    )

    for (const key of aliceKeys) {
      await aliceStorage.current.del(key)
    }
    for (const key of bobKeys) {
      await bobStorage.current.del(key)
    }

    addEventLog("STORAGE_CLEARED", "system", "All session data cleared from storage")
  }

  const simulateRefresh = async () => {
    setIsRefreshing(true)
    addEventLog(
      "SIMULATING_REFRESH",
      "system",
      "Closing existing managers and reinitializing"
    )

    // Close existing managers
    aliceManager?.close()
    bobManager?.close()

    // Clear state
    setAliceManager(null)
    setBobManager(null)
    setAliceConnected(false)
    setBobConnected(false)
    setAliceSetupBob(false)
    setBobSetupAlice(false)

    // Wait a moment for cleanup
    await new Promise((resolve) => setTimeout(resolve, 500))

    // Reinitialize everything using the same storage and keys
    await initManagers()
    setIsRefreshing(false)
    addEventLog(
      "REFRESH_COMPLETE",
      "system",
      "Managers reinitialized, sessions should be restored from storage"
    )
  }

  const aliceSetupBobUser = async () => {
    if (!aliceManager || !bobInfo.pubkey) {
      addEventLog(
        "SETUP_ERROR",
        "alice",
        "Manager not initialized or Bob pubkey not available"
      )
      return
    }

    addEventLog("SETUP_USER", "alice", `Setting up Bob as user`)
    aliceManager.setupUser(bobInfo.pubkey)
    setAliceSetupBob(true)
    addEventLog("USER_SETUP_COMPLETE", "alice", `Set up user: ${bobInfo.pubkey}`)
  }

  const bobSetupAliceUser = async () => {
    if (!bobManager || !aliceInfo.pubkey) {
      addEventLog(
        "SETUP_ERROR",
        "bob",
        "Manager not initialized or Alice pubkey not available"
      )
      return
    }

    addEventLog("SETUP_USER", "bob", `Setting up Alice as user`)
    bobManager.setupUser(aliceInfo.pubkey)
    setBobSetupAlice(true)
    addEventLog("USER_SETUP_COMPLETE", "bob", `Set up user: ${aliceInfo.pubkey}`)
  }

  const initManagers = async () => {
    // Alice setup - using persistent storage to test restoration
    const alicePubkey = getPublicKey(aliceSecretKey.current)

    // Debug storage contents before initialization
    const aliceKeys = await aliceStorage.current.list()
    const bobKeys = await bobStorage.current.list()
    addEventLog(
      "STORAGE_STATE",
      "alice",
      `Found ${aliceKeys.length} stored keys: ${aliceKeys.join(", ")}`
    )
    addEventLog(
      "STORAGE_STATE",
      "bob",
      `Found ${bobKeys.length} stored keys: ${bobKeys.join(", ")}`
    )

    aliceNDK.current = createNDK(aliceSecretKey.current)

    // NDK connect doesn't throw errors, it connects in background
    aliceNDK.current.connect()
    addEventLog("NDK_CONNECTING", "alice", "Attempting to connect to relays")

    // Listen for when relays connect
    aliceNDK.current.pool.on("relay:connect", (relay) => {
      addEventLog("RELAY_CONNECT", "alice", `Connected to ${relay.url}`)
      setAliceConnected(true)
    })

    aliceNDK.current.pool.on("relay:disconnect", (relay) => {
      addEventLog("RELAY_DISCONNECT", "alice", `Disconnected from ${relay.url}`)
    })

    // Wait a bit for initial connections
    setTimeout(() => {
      const connectedRelays = Array.from(aliceNDK.current!.pool.relays.values()).filter(
        (r) => r.connected
      ).length
      addEventLog("CONNECTION_STATUS", "alice", `${connectedRelays} relays connected`)
      if (connectedRelays > 0) {
        setAliceConnected(true)
      }
    }, 2000)

    const aliceManager = new SessionManager(
      aliceSecretKey.current,
      "alice-device-1",
      createSubscribe(aliceNDK.current, "Alice"),
      createPublish(aliceNDK.current, "Alice"),
      aliceStorage.current
    )

    aliceManager.onEvent((event: Rumor, from: string) => {
      const messageKey = `${from}-${event.content}-${event.created_at}`
      if (aliceSeenMessages.current.has(messageKey)) {
        addEventLog("DUPLICATE_MESSAGE", "alice", {event, from})
        return
      }
      aliceSeenMessages.current.add(messageKey)

      addEventLog("MESSAGE_RECEIVED", "alice", {event, from, decrypted: true})
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

    // Bob setup - using persistent storage to test restoration
    const bobPubkey = getPublicKey(bobSecretKey.current)

    bobNDK.current = createNDK(bobSecretKey.current)

    // NDK connect doesn't throw errors, it connects in background
    bobNDK.current.connect()
    addEventLog("NDK_CONNECTING", "bob", "Attempting to connect to relays")

    // Listen for when relays connect
    bobNDK.current.pool.on("relay:connect", (relay) => {
      addEventLog("RELAY_CONNECT", "bob", `Connected to ${relay.url}`)
      setBobConnected(true)
    })

    bobNDK.current.pool.on("relay:disconnect", (relay) => {
      addEventLog("RELAY_DISCONNECT", "bob", `Disconnected from ${relay.url}`)
    })

    // Wait a bit for initial connections
    setTimeout(() => {
      const connectedRelays = Array.from(bobNDK.current!.pool.relays.values()).filter(
        (r) => r.connected
      ).length
      addEventLog("CONNECTION_STATUS", "bob", `${connectedRelays} relays connected`)
      if (connectedRelays > 0) {
        setBobConnected(true)
      }
    }, 2000)

    const bobManager = new SessionManager(
      bobSecretKey.current,
      "bob-device-1",
      createSubscribe(bobNDK.current, "Bob"),
      createPublish(bobNDK.current, "Bob"),
      bobStorage.current
    )

    bobManager.onEvent((event: Rumor, from: string) => {
      const messageKey = `${from}-${event.content}-${event.created_at}`
      if (bobSeenMessages.current.has(messageKey)) {
        addEventLog("DUPLICATE_MESSAGE", "bob", {event, from})
        return
      }
      bobSeenMessages.current.add(messageKey)

      addEventLog("MESSAGE_RECEIVED", "bob", {event, from, decrypted: true})
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

  // Helper to truncate hex keys for display
  const truncateKey = (key: string | undefined, length = 16) => {
    if (!key) return "none"
    return key.length > length ? `${key.slice(0, length)}...` : key
  }

  // Manager state renderer
  const ManagerStateDisplay = ({
    manager,
    title,
    deviceId,
    pubkey,
  }: {
    manager: SessionManager | null
    title: string
    deviceId: string
    pubkey: string
  }) => {
    if (!manager) return <div className="text-gray-500">Manager not initialized</div>

    return (
      <div className="border rounded p-3 bg-white">
        <div className="font-semibold mb-3 text-lg text-black">{title} Manager State</div>

        {/* Manager info */}
        <div className="mb-3 p-2 bg-blue-50 rounded text-sm text-gray-700">
          <div>
            <span className="font-medium">Device ID:</span> {deviceId}
          </div>
          <div>
            <span className="font-medium">Public Key:</span> {truncateKey(pubkey)}
          </div>
          <div>
            <span className="font-medium">Manager Status:</span>{" "}
            {manager ? "Initialized" : "Not Initialized"}
          </div>
          <div>
            <span className="font-medium">Setup Status:</span>{" "}
            {title === "Alice"
              ? aliceSetupBob
                ? "Bob user setup ✓"
                : "Bob user not setup"
              : bobSetupAlice
                ? "Alice user setup ✓"
                : "Alice user not setup"}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 max-w-6xl mx-auto h-screen flex flex-col">
      <div className="flex items-center gap-4 mb-4">
        <h1 className="text-2xl font-bold">SessionManager Debug Chat (NDK)</h1>
        <button onClick={resetAll} className="btn btn-sm btn-secondary">
          Reset
        </button>
        <button
          onClick={aliceSetupBobUser}
          className={`px-3 py-1 rounded text-sm font-medium ${
            aliceSetupBob
              ? "bg-green-600 text-white"
              : "bg-blue-500 text-white hover:bg-blue-600"
          }`}
          disabled={!aliceManager || !bobInfo.pubkey || aliceSetupBob}
        >
          {aliceSetupBob ? "Alice → Bob ✓" : "Alice Setup Bob"}
        </button>
        <button
          onClick={bobSetupAliceUser}
          className={`px-3 py-1 rounded text-sm font-medium ${
            bobSetupAlice
              ? "bg-green-600 text-white"
              : "bg-blue-500 text-white hover:bg-blue-600"
          }`}
          disabled={!bobManager || !aliceInfo.pubkey || bobSetupAlice}
        >
          {bobSetupAlice ? "Bob → Alice ✓" : "Bob Setup Alice"}
        </button>
        <button
          onClick={clearStorage}
          className="px-3 py-1 rounded text-sm font-medium bg-red-500 text-white hover:bg-red-600"
        >
          Clear Storage
        </button>
        <button
          onClick={simulateRefresh}
          className={`px-3 py-1 rounded text-sm font-medium ${
            isRefreshing
              ? "bg-orange-300 text-orange-800 cursor-not-allowed"
              : "bg-orange-500 text-white hover:bg-orange-600"
          }`}
          disabled={!aliceManager || !bobManager || isRefreshing}
        >
          {isRefreshing ? "Refreshing..." : "Simulate Refresh"}
        </button>
        <button
          onClick={() => setShowSessionDetails(!showSessionDetails)}
          className={`px-3 py-1 rounded text-sm font-medium ${
            showSessionDetails
              ? "bg-purple-500 text-white hover:bg-purple-600"
              : "bg-gray-200 text-gray-700 hover:bg-gray-300"
          }`}
        >
          {showSessionDetails ? "Hide Session State" : "Show Session State"}
        </button>
      </div>

      {/* Status */}
      <div className="mb-4 p-4 bg-white border rounded text-sm text-black">
        <div className="font-medium">Connection Status:</div>
        <div>
          Alice NDK:{" "}
          <span
            className={
              aliceConnected
                ? "text-green-600 font-semibold"
                : "text-red-600 font-semibold"
            }
          >
            {aliceConnected ? "Connected" : "Disconnected"}
          </span>
        </div>
        <div>
          Bob NDK:{" "}
          <span
            className={
              bobConnected ? "text-green-600 font-semibold" : "text-red-600 font-semibold"
            }
          >
            {bobConnected ? "Connected" : "Disconnected"}
          </span>
        </div>
        <div>
          Relays:{" "}
          <span className="font-mono">Public Nostr relays (damus.io, nos.lol, etc.)</span>
        </div>
      </div>

      {/* Chat Interface */}
      <div className="grid grid-cols-2 gap-4 mb-8 flex-shrink-0">
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
              <div key={i} className="mb-2 text-gray-800">
                <span className="text-xs text-gray-500">
                  {new Date(msg.timestamp).toLocaleTimeString()} -{" "}
                  <span className="font-mono">{msg.from.slice(0, 8)}...</span>
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
              <div key={i} className="mb-2 text-gray-800">
                <span className="text-xs text-gray-500">
                  {new Date(msg.timestamp).toLocaleTimeString()} -{" "}
                  <span className="font-mono">{msg.from.slice(0, 8)}...</span>
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

      {/* Session Details Panel */}
      {showSessionDetails && (
        <div className="mb-6 border rounded-lg p-4 bg-gray-50 max-h-96 overflow-y-auto">
          <h2 className="font-semibold text-lg mb-4 text-black">Session Manager State</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ManagerStateDisplay
              manager={aliceManager}
              title="Alice"
              deviceId={aliceInfo.deviceId}
              pubkey={aliceInfo.pubkey}
            />
            <ManagerStateDisplay
              manager={bobManager}
              title="Bob"
              deviceId={bobInfo.deviceId}
              pubkey={bobInfo.pubkey}
            />
          </div>
        </div>
      )}

      {/* Event Log */}
      <div className="border rounded-lg p-4 flex-1 flex flex-col min-h-0">
        <h2 className="font-semibold text-lg mb-2">Event Log (NDK)</h2>
        <div className="flex-1 bg-gray-900 text-green-400 font-mono text-xs p-2 overflow-y-auto">
          {eventLog.map((log, i) => (
            <div key={i} className="mb-1">
              <span className="text-gray-500">
                {new Date(log.timestamp).toLocaleTimeString()}
              </span>{" "}
              <span className={`font-semibold ${getSourceColor(log.source)}`}>
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
