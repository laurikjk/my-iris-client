import FeedItem from "@/shared/components/event/FeedItem/FeedItem"
import RightColumn from "@/shared/components/RightColumn.tsx"
import Trending from "@/shared/components/feed/Trending.tsx"
import {useLocalState} from "irisdb-hooks/src/useLocalState"
import FollowList from "@/pages/user/components/FollowList"
import Header from "@/shared/components/header/Header"
import {Name} from "@/shared/components/user/Name"
import Widget from "@/shared/components/ui/Widget"
import socialGraph from "@/utils/socialGraph"
import {NDKEvent} from "@nostr-dev-kit/ndk"
import {useState, useEffect} from "react"
import {getTags} from "@/utils/nostr"
import {nip19} from "nostr-tools"
import {ndk} from "@/utils/ndk"

export default function ThreadPage({
  id,
  isNaddr = false,
  naddrData = null,
}: {
  id: string
  isNaddr?: boolean
  naddrData?: nip19.AddressPointer | null
}) {
  const [relevantPeople, setRelevantPeople] = useState(new Map<string, boolean>())
  const [hideEventsByUnknownUsers] = useLocalState(
    "settings/hideEventsByUnknownUsers",
    true,
    Boolean
  )
  const [event, setEvent] = useState<NDKEvent | null>(null)
  const [loading, setLoading] = useState(isNaddr)
  const [threadAuthor, setThreadAuthor] = useState<string | null>(null)

  useEffect(() => {
    if (isNaddr && naddrData) {
      setLoading(true)
      ndk()
        .fetchEvent(
          {
            authors: [naddrData.pubkey],
            kinds: [naddrData.kind],
            "#d": [naddrData.identifier],
          },
          undefined
        )
        .then((e) => {
          if (e) {
            setEvent(e)
            if (e.pubkey) {
              setThreadAuthor(e.pubkey)
              addRelevantPerson(e.pubkey)
            }
          }
          setLoading(false)
        })
        .catch((err) => {
          console.warn("Error fetching naddr event:", err)
          setLoading(false)
        })
    }
  }, [isNaddr, naddrData])

  const addRelevantPerson = (person: string) => {
    setRelevantPeople((prev) => new Map(prev).set(person, true))
  }

  const addToThread = (event: NDKEvent) => {
    if (hideEventsByUnknownUsers && socialGraph().getFollowDistance(event.pubkey) > 5)
      return
    if (!threadAuthor) setThreadAuthor(event.pubkey)
    addRelevantPerson(event.pubkey)
    for (const user of getTags("p", event.tags)) {
      addRelevantPerson(user)
    }
  }

  return (
    <div className="flex justify-center">
      <div className="flex-1">
        <Header>
          {threadAuthor ? (
            <>
              Post by <Name className="-ml-3" pubKey={threadAuthor} />
            </>
          ) : (
            "Post"
          )}
        </Header>
        {(() => {
          if (isNaddr) {
            if (loading) {
              return (
                <div className="flex relative flex-col pt-3 px-4 min-h-[186px] pb-0 transition-colors duration-200 ease-in-out border-custom cursor-pointer border-2 pt-3 pb-3 my-2 rounded hover:bg-[var(--note-hover-color)] break-all">
                  Loading naddr:{id}
                </div>
              )
            } else if (event) {
              return (
                <FeedItem
                  event={event}
                  key={event.id}
                  standalone={true}
                  onEvent={addToThread}
                  showReplies={Infinity}
                />
              )
            } else {
              return <div className="p-4">Failed to load naddr:{id}</div>
            }
          } else {
            return (
              <FeedItem
                key={id}
                eventId={id}
                standalone={true}
                onEvent={addToThread}
                showReplies={Infinity}
              />
            )
          }
        })()}
      </div>
      <RightColumn>
        {() => (
          <>
            {relevantPeople.size > 0 && (
              <Widget title="Relevant people">
                <FollowList
                  follows={Array.from(relevantPeople.keys())}
                  showAbout={true}
                />
              </Widget>
            )}
            <Widget title="Trending posts">
              <Trending />
            </Widget>
          </>
        )}
      </RightColumn>
    </div>
  )
}
