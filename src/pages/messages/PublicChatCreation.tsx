import {NDKEvent} from "@nostr-dev-kit/ndk"
import {useState, FormEvent} from "react"
import {useNavigate} from "react-router"
import {localState} from "irisdb/src"
import {ndk} from "@/utils/ndk"

let publicKey = ""
localState.get("user/publicKey").on((k) => (publicKey = k as string))

const PublicChatCreation = () => {
  const navigate = useNavigate()
  const [channelName, setChannelName] = useState("")
  const [channelAbout, setChannelAbout] = useState("")
  const [channelPicture, setChannelPicture] = useState("")
  const [channelId, setChannelId] = useState("")
  const [joinError, setJoinError] = useState<string | null>(null)
  const [createError, setCreateError] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [isJoining, setIsJoining] = useState(false)

  const handleCreateChannel = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()

    if (!channelName.trim()) {
      setCreateError("Channel name is required")
      return
    }

    try {
      setIsCreating(true)
      setCreateError(null)

      if (!publicKey) {
        setCreateError("You need to be logged in to create a channel")
        setIsCreating(false)
        return
      }

      // Create channel metadata
      const metadata = {
        name: channelName,
        about: channelAbout,
        picture: channelPicture,
        relays: [], // Default relays will be used
      }

      // Create channel creation event (kind 40)
      const event = new NDKEvent(ndk())
      event.kind = 40 // CHANNEL_CREATE
      event.content = JSON.stringify(metadata)
      await event.publish()

      // Navigate to the new channel
      navigate(`/messages/${event.id}`)
    } catch (err) {
      console.error("Error creating channel:", err)
      setCreateError("Failed to create channel")
      setIsCreating(false)
    }
  }

  const handleJoinChannel = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()

    if (!channelId.trim()) {
      setJoinError("Channel ID is required")
      return
    }

    try {
      setIsJoining(true)
      setJoinError(null)

      // Validate the channel ID format
      if (!/^[a-f0-9]{64}$/.test(channelId)) {
        setJoinError("Invalid channel ID format")
        setIsJoining(false)
        return
      }

      // Navigate to the channel
      navigate(`/messages/${channelId}`)
    } catch (err) {
      console.error("Error joining channel:", err)
      setJoinError("Failed to join channel")
      setIsJoining(false)
    }
  }

  return (
    <div className="m-4 p-4 md:p-8 rounded-lg bg-base-100 flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold mb-4">Create a Public Channel</h2>
        <form onSubmit={handleCreateChannel} className="flex flex-col gap-4">
          <div>
            <label className="label">
              <span className="label-text">Channel Name</span>
            </label>
            <input
              type="text"
              className="input input-bordered w-full"
              placeholder="Enter channel name"
              value={channelName}
              onChange={(e) => setChannelName(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="label">
              <span className="label-text">Description (optional)</span>
            </label>
            <textarea
              className="textarea textarea-bordered w-full"
              placeholder="Enter channel description"
              value={channelAbout}
              onChange={(e) => setChannelAbout(e.target.value)}
            />
          </div>
          <div>
            <label className="label">
              <span className="label-text">Picture URL (optional)</span>
            </label>
            <input
              type="text"
              className="input input-bordered w-full"
              placeholder="Enter picture URL"
              value={channelPicture}
              onChange={(e) => setChannelPicture(e.target.value)}
            />
          </div>
          {createError && <div className="text-error">{createError}</div>}
          <button type="submit" className="btn btn-primary" disabled={isCreating}>
            {isCreating ? (
              <>
                <span className="loading loading-spinner loading-xs"></span>
                Creating...
              </>
            ) : (
              "Create Channel"
            )}
          </button>
        </form>
      </div>

      <div className="divider">OR</div>

      <div>
        <h2 className="text-xl font-semibold mb-4">Join a Public Channel</h2>
        <form onSubmit={handleJoinChannel} className="flex flex-col gap-4">
          <div>
            <label className="label">
              <span className="label-text">Channel ID</span>
            </label>
            <input
              type="text"
              className="input input-bordered w-full"
              placeholder="Enter channel ID"
              value={channelId}
              onChange={(e) => setChannelId(e.target.value)}
              required
            />
          </div>
          {joinError && <div className="text-error">{joinError}</div>}
          <button type="submit" className="btn btn-primary" disabled={isJoining}>
            {isJoining ? (
              <>
                <span className="loading loading-spinner loading-xs"></span>
                Joining...
              </>
            ) : (
              "Join Channel"
            )}
          </button>
        </form>
      </div>

      <div className="mt-4">
        <h3 className="text-lg font-semibold mb-2">About Public Channels</h3>
        <p className="text-base-content/70">
          Public channels are open chat rooms where anyone can join and participate in
          conversations. Messages are not encrypted and are visible to everyone.
        </p>
      </div>
    </div>
  )
}

export default PublicChatCreation
