import {useSubscriptionStatus} from "@/shared/hooks/useSubscriptionStatus"
import {ChangeEvent, useState, useEffect} from "react"
import {useUserStore} from "@/stores/user"

const DEFAULT_SERVERS = ["https://nostr.build"]

function stripHttps(url: string) {
  return url.replace(/^https?:\/\//, "")
}

function MediaServers() {
  const {
    blossomServers,
    defaultBlossomServer,
    setDefaultBlossomServer,
    addBlossomServer,
    removeBlossomServer,
    setBlossomServers,
    publicKey,
  } = useUserStore()
  const [newServer, setNewServer] = useState("")
  const {isSubscriber, isLoading} = useSubscriptionStatus(publicKey)

  // Set default server based on subscription status
  useEffect(() => {
    console.log("Subscription status:", {isSubscriber, isLoading, publicKey})
    if (!isLoading && isSubscriber) {
      const irisServer = "https://blossom.iris.to"
      console.log("Adding iris server:", irisServer)
      if (!blossomServers.includes(irisServer)) {
        addBlossomServer(irisServer)
      }
      setDefaultBlossomServer(irisServer)
    }
  }, [
    isSubscriber,
    isLoading,
    blossomServers,
    addBlossomServer,
    setDefaultBlossomServer,
    publicKey,
  ])

  function handleDefaultServerChange(e: ChangeEvent<HTMLSelectElement>) {
    setDefaultBlossomServer(e.target.value)
  }

  function handleAddServer() {
    if (newServer && !blossomServers.includes(newServer)) {
      const serverUrl = newServer.startsWith("http") ? newServer : `https://${newServer}`
      addBlossomServer(serverUrl)
      setNewServer("")
    }
  }

  function handleRemoveServer(server: string) {
    removeBlossomServer(server)
    if (defaultBlossomServer === server) {
      // Set default to first available server or nostr.build
      const remainingServers = blossomServers.filter((s) => s !== server)
      setDefaultBlossomServer(remainingServers[0] || "https://nostr.build")
    }
  }

  function handleRestoreDefaults() {
    setBlossomServers(DEFAULT_SERVERS)
    setDefaultBlossomServer(DEFAULT_SERVERS[0])
  }

  return (
    <div>
      <h1 className="text-2xl mb-4">Blossom Media Servers</h1>
      <div className="flex flex-col gap-4">
        <div>
          <p>Select default Blossom server</p>
          <select
            aria-label="Select default server"
            className="select select-primary mt-2"
            value={defaultBlossomServer}
            onChange={handleDefaultServerChange}
          >
            {blossomServers.map((server) => (
              <option key={server} value={server}>
                {stripHttps(server)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <p>Add new Blossom server</p>
          <div className="flex gap-2 mt-2">
            <input
              type="url"
              className="input input-bordered flex-1"
              placeholder="blossom.example.com"
              value={newServer}
              onChange={(e) => setNewServer(e.target.value)}
            />
            <button
              className="btn btn-primary"
              onClick={handleAddServer}
              disabled={!newServer}
            >
              Add
            </button>
          </div>
        </div>

        <div>
          <div className="flex justify-between items-center mb-2">
            <p>Configured Blossom servers</p>
            <button className="btn btn-sm btn-outline" onClick={handleRestoreDefaults}>
              Restore Defaults
            </button>
          </div>
          <div className="flex flex-col gap-2 mt-2">
            {blossomServers.map((server) => (
              <div key={server} className="flex items-center gap-2">
                <a
                  href={server}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 link"
                >
                  {stripHttps(server)}
                </a>
                <button
                  className="btn btn-sm btn-error"
                  onClick={() => handleRemoveServer(server)}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="text-sm text-gray-500">
          <p>
            <a
              href="https://github.com/hzrd149/blossom"
              target="_blank"
              rel="noopener noreferrer"
              className="link"
            >
              Blossom
            </a>{" "}
            is a specification for storing content addressed files on media servers.
          </p>
        </div>
      </div>
    </div>
  )
}

export default MediaServers
