import {useParams, useNavigate} from "react-router"
import Header from "@/shared/components/header/Header"
import {RiShareLine, RiChat1Line} from "@remixicon/react"
import {useEffect, useState} from "react"
import {fetchChannelMetadata, ChannelMetadata} from "../utils/channelMetadata"
import ProxyImg from "@/shared/components/ProxyImg"
import {UserRow} from "@/shared/components/user/UserRow"
import {nip19} from "nostr-tools"

const PublicChatDetails = () => {
  const {id} = useParams()
  const navigate = useNavigate()
  const [metadata, setMetadata] = useState<ChannelMetadata | null>(null)

  useEffect(() => {
    const loadMetadata = async () => {
      if (!id) return
      try {
        const data = await fetchChannelMetadata(id)
        setMetadata(data)
      } catch (error) {
        console.error("Failed to load chat metadata:", error)
      }
    }

    loadMetadata()
  }, [id])

  const shareLink = `https://iris.to/chats/${id}`

  return (
    <>
      <Header title="Chat Details" showBack />
      <div className="p-4">
        {!metadata && (
          <div className="text-center">Chat not found</div>
        )}
        {metadata && (
          <div className="space-y-4">
            <div className="card bg-base-100 shadow-xl">
              <div className="card-body">
                <div className="flex items-center gap-4 mb-4">
                  {metadata.picture ? (
                    <ProxyImg
                      src={metadata.picture}
                      alt={metadata.name}
                      className="w-16 h-16 rounded-full object-cover"
                      square={true}
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-base-300 flex items-center justify-center">
                      <span className="text-2xl">#</span>
                    </div>
                  )}
                  <div>
                    <h2 className="card-title text-xl">{metadata.name}</h2>
                    {metadata.about && (
                      <p className="text-base-content/70">{metadata.about}</p>
                    )}
                  </div>
                </div>
                <button
                  className="btn btn-primary gap-2 w-full mb-4"
                  onClick={() => navigate(`/chats/${id}`)}
                >
                  <RiChat1Line className="w-5 h-5" />
                  View Chat
                </button>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm text-base-content/70">Channel ID</label>
                    <div className="font-mono text-sm break-all bg-base-200 p-2 rounded">
                      {id ? nip19.noteEncode(id) : ''}
                    </div>
                  </div>
                  <div>
                    <label className="text-sm text-base-content/70">Channel ID (Hex)</label>
                    <div className="font-mono text-sm break-all bg-base-200 p-2 rounded">
                      {id}
                    </div>
                  </div>
                  <div>
                    <label className="text-sm text-base-content/70">Share Link</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        readOnly
                        value={shareLink}
                        className="input input-bordered flex-1"
                      />
                      <button
                        className="btn btn-square"
                        onClick={() => navigator.clipboard.writeText(shareLink)}
                      >
                        <RiShareLine className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                  {metadata.relays && metadata.relays.length > 0 && (
                    <div>
                      <label className="text-sm text-base-content/70">Relays</label>
                      <div className="space-y-1">
                        {metadata.relays.map((relay, index) => (
                          <div key={index} className="font-mono text-sm break-all bg-base-200 p-2 rounded">
                            {relay}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <div>
                    <label className="text-sm text-base-content/70">Created by</label>
                    <div className="mt-2">
                      <UserRow pubKey={metadata.founderPubkey} />
                    </div>
                  </div>
                  <div>
                    <label className="text-sm text-base-content/70">Created At</label>
                    <div className="font-mono text-sm break-all bg-base-200 p-2 rounded">
                      {metadata?.createdAt ? new Date(metadata.createdAt * 1000).toLocaleString() : 'Unknown'}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}

export default PublicChatDetails