import {useState, useEffect, useRef} from "react"
import SessionManager from "../session/SessionManager"
import {generateSecretKey, getPublicKey, VerifiedEvent} from "nostr-tools"
import {InMemoryStorageAdapter} from "../session/StorageAdapter"
import {KIND_CHAT_MESSAGE} from "../utils/constants"
import {Rumor, NostrPublish, SessionState} from "nostr-double-ratchet"
import NDK, {NDKEvent, NDKPrivateKeySigner, NDKFilter} from "@nostr-dev-kit/ndk"
import {UserRecord} from "../session/UserRecord"

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

  const aliceSecretKey = useRef(generateSecretKey())
  const bobSecretKey = useRef(generateSecretKey())
  const aliceNDK = useRef<NDK | null>(null)
  const bobNDK = useRef<NDK | null>(null)
  const aliceSeenMessages = useRef(new Set<string>())
  const bobSeenMessages = useRef(new Set<string>())

  const addEventLog = (type: string, source: string, data: unknown) => {
    const logEntry = {
      timestamp: Date.now(),
      type,
      source,
      data,
    }
    setEventLog((prev) => [...prev.slice(-19), logEntry]) // Keep last 20
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
    const initManagers = async () => {
      // Alice setup
      const aliceStorage = new InMemoryStorageAdapter()
      const alicePubkey = getPublicKey(aliceSecretKey.current)

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
        aliceStorage
      )

      aliceManager.onEvent((event: Rumor, from: string) => {
        const messageKey = `${from}-${event.content}-${event.created_at}`
        if (aliceSeenMessages.current.has(messageKey)) {
          addEventLog("DUPLICATE_MESSAGE", "alice", {event, from})
          return
        }
        aliceSeenMessages.current.add(messageKey)

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
        bobStorage
      )

      bobManager.onEvent((event: Rumor, from: string) => {
        const messageKey = `${from}-${event.content}-${event.created_at}`
        if (bobSeenMessages.current.has(messageKey)) {
          addEventLog("DUPLICATE_MESSAGE", "bob", {event, from})
          return
        }
        bobSeenMessages.current.add(messageKey)

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
      // Close NDK connections - NDK doesn't have destroy method
      // Connections will be cleaned up automatically
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
    setBobInput("")
  }

  const resetAll = () => {
    setAliceMessages([])
    setBobMessages([])
    setEventLog([])
    aliceSeenMessages.current.clear()
    bobSeenMessages.current.clear()
    // Recreate managers would require reloading - for now just clear UI
  }

  // Helper to truncate hex keys for display
  const truncateKey = (key: string | undefined, length = 16) => {
    if (!key) return "none"
    return key.length > length ? `${key.slice(0, length)}...` : key
  }

  // Helper to format Uint8Array keys
  const formatUint8Array = (arr: Uint8Array | undefined) => {
    if (!arr) return "none"
    const hex = Array.from(arr)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
    return truncateKey(hex)
  }

  // Session state renderer
  const SessionStateDisplay = ({
    state,
    title,
  }: {
    state: SessionState | undefined
    title: string
  }) => {
    if (!state) return <div className="text-gray-500">No state</div>

    return (
      <div className="border rounded p-2 bg-gray-50 text-xs">
        <div className="font-semibold mb-2 text-black">{title}</div>
        <div className="space-y-1 text-gray-700">
          <div>
            <span className="font-medium">Root Key:</span>{" "}
            {formatUint8Array(state.rootKey)}
          </div>
          <div>
            <span className="font-medium">Their Current PubKey:</span>{" "}
            {truncateKey(state.theirCurrentNostrPublicKey)}
          </div>
          <div>
            <span className="font-medium">Their Next PubKey:</span>{" "}
            {truncateKey(state.theirNextNostrPublicKey)}
          </div>
          <div>
            <span className="font-medium">Our Current PubKey:</span>{" "}
            {truncateKey(state.ourCurrentNostrKey?.publicKey)}
          </div>
          <div>
            <span className="font-medium">Our Current PrivKey:</span>{" "}
            {formatUint8Array(state.ourCurrentNostrKey?.privateKey)}
          </div>
          <div>
            <span className="font-medium">Our Next PubKey:</span>{" "}
            {truncateKey(state.ourNextNostrKey.publicKey)}
          </div>
          <div>
            <span className="font-medium">Our Next PrivKey:</span>{" "}
            {formatUint8Array(state.ourNextNostrKey.privateKey)}
          </div>
          <div>
            <span className="font-medium">Receiving Chain Key:</span>{" "}
            {formatUint8Array(state.receivingChainKey)}
          </div>
          <div>
            <span className="font-medium">Sending Chain Key:</span>{" "}
            {formatUint8Array(state.sendingChainKey)}
          </div>
          <div>
            <span className="font-medium">Send Chain Msg #:</span>{" "}
            {state.sendingChainMessageNumber}
          </div>
          <div>
            <span className="font-medium">Recv Chain Msg #:</span>{" "}
            {state.receivingChainMessageNumber}
          </div>
          <div>
            <span className="font-medium">Prev Send Chain Count:</span>{" "}
            {state.previousSendingChainMessageCount}
          </div>
          <div>
            <span className="font-medium">Skipped Keys:</span>{" "}
            {Object.keys(state.skippedKeys || {}).length}
          </div>
        </div>
      </div>
    )
  }

  // Manager state renderer
  const ManagerStateDisplay = ({
    manager,
    title,
  }: {
    manager: SessionManager | null
    title: string
  }) => {
    if (!manager) return <div className="text-gray-500">Manager not initialized</div>

    // Access private fields through type assertion (for debugging only)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const userRecords = (manager as any).userRecords as Map<string, UserRecord>
    const deviceId = manager.getDeviceId()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const invite = (manager as any).invite

    return (
      <div className="border rounded p-3 bg-white">
        <div className="font-semibold mb-3 text-lg text-black">{title} Manager State</div>

        {/* Manager info */}
        <div className="mb-3 p-2 bg-blue-50 rounded text-sm text-gray-700">
          <div>
            <span className="font-medium">Device ID:</span> {deviceId}
          </div>
          <div>
            <span className="font-medium">Invite Present:</span> {invite ? "Yes" : "No"}
          </div>
          <div>
            <span className="font-medium">User Records:</span> {userRecords.size}
          </div>
        </div>

        {/* User records */}
        {Array.from(userRecords.entries()).map(([pubkey, userRecord]) => (
          <div key={pubkey} className="mb-4 p-2 border-l-4 border-green-400 bg-green-50">
            <div className="font-medium text-black mb-2">
              User: {truncateKey(pubkey, 20)}
            </div>

            {/* Device records */}
            <div className="mb-2">
              <span className="text-sm font-medium text-gray-600">
                Devices ({userRecord.getDeviceCount()}):
              </span>
              {userRecord.getAllDevices().map((device) => (
                <div
                  key={device.deviceId}
                  className="ml-4 mt-1 p-2 bg-white rounded border text-xs"
                >
                  <div>
                    <span className="font-medium">Device ID:</span> {device.deviceId}
                  </div>
                  <div>
                    <span className="font-medium">Public Key:</span>{" "}
                    {truncateKey(device.publicKey)}
                  </div>
                  <div>
                    <span className="font-medium">Active Session:</span>{" "}
                    {device.activeSession ? "Yes" : "No"}
                  </div>
                  <div>
                    <span className="font-medium">Inactive Sessions:</span>{" "}
                    {device.inactiveSessions.length}
                  </div>
                  <div>
                    <span className="font-medium">Last Activity:</span>{" "}
                    {device.lastActivity
                      ? new Date(device.lastActivity).toLocaleString()
                      : "Never"}
                  </div>
                  <div>
                    <span className="font-medium">Stale:</span>{" "}
                    {device.isStale ? "Yes" : "No"}
                  </div>

                  {/* Active session state */}
                  {device.activeSession && (
                    <div className="mt-2">
                      <SessionStateDisplay
                        state={device.activeSession.state}
                        title={`Active Session (${device.activeSession.name})`}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Session summary */}
            <div className="text-sm text-gray-600">
              <div>Active Sessions: {userRecord.getActiveSessionCount()}</div>
              <div>Sendable Sessions: {userRecord.getSendableSessions().length}</div>
              <div>Total Sessions: {userRecord.getAllSessions().length}</div>
            </div>
          </div>
        ))}
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

      {/* Session Details Panel */}
      {showSessionDetails && (
        <div className="mb-6 border rounded-lg p-4 bg-gray-50 max-h-96 overflow-y-auto">
          <h2 className="font-semibold text-lg mb-4 text-black">Session Manager State</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ManagerStateDisplay manager={aliceManager} title="Alice" />
            <ManagerStateDisplay manager={bobManager} title="Bob" />
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
