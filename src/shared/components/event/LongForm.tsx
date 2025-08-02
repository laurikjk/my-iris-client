import {NDKEvent} from "@nostr-dev-kit/ndk"
import {useEffect, useState} from "react"
import Markdown from "markdown-to-jsx"
import ProxyImg from "../ProxyImg"
import {useNavigate} from "react-router"
import {nip19} from "nostr-tools"

interface LongFormProps {
  event: NDKEvent
  standalone: boolean | undefined
}

function LongForm({event, standalone}: LongFormProps) {
  const [title, setTitle] = useState<string>("")
  const [topics, setTopics] = useState<string>()
  const [textBody, setTextBody] = useState<string>("")
  const [summary, setSummary] = useState<string>("")
  const [imageUrl, setImageUrl] = useState<string>("")
  const navigate = useNavigate()

  useEffect(() => {
    const title = event.tagValue("title")
    if (title) setTitle(title)

    const hashtags = event.tagValue("t")
    if (hashtags) setTopics(hashtags)

    const textBody = event.content
    setTextBody(textBody)

    const summaryTag = event.tagValue("summary")
    if (summaryTag) setSummary(summaryTag)

    const imageTag = event.tagValue("image")
    if (imageTag) setImageUrl(imageTag)
  }, [event])

  const getDisplayContent = () => {
    if (standalone) {
      return textBody
    }

    if (summary) {
      return summary.length > 250 ? `${summary.substring(0, 250)}...` : summary
    }

    return `${textBody.substring(0, 250)}...`
  }

  const titleSize = standalone ? "text-3xl my-4" : "text-xl my-2";

  return (
    <>
      {imageUrl && standalone && (
        <ProxyImg
          src={imageUrl}
          alt={title || "Article image"}
          className="w-full object-cover h-64 lg:h-96 my-4"
          width={800}
        />
      )}
      <div className="flex flex-col gap-2 px-5">
        {imageUrl && !standalone && (
          <div
            className="cursor-pointer"
            onClick={(e) => {
              e.stopPropagation()
              navigate(`/${nip19.noteEncode(event.id)}`)
            }}
          >
            <ProxyImg
              src={imageUrl}
              alt={title || "Article preview"}
              className="rounded-lg max-h-48 w-full object-cover hover:opacity-90 transition-opacity"
              width={400}
            />
          </div>
        )}
        <h1 className={`flex items-center gap-2 ${titleSize}`}>{title}</h1>
        <Markdown
          className="prose leading-relaxed tracking-wide text-gray-450 whitespace-pre-wrap break-words [overflow-wrap:anywhere]"
          options={{forceBlock: true}}
        >
          {getDisplayContent()}
        </Markdown>
        {topics && <small className="text-custom-accent">#{topics}</small>}
      </div>
    </>
  )
}

export default LongForm
