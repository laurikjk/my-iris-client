import {NDKEvent} from "@nostr-dev-kit/ndk"
import {useEffect, useState} from "react"
import Markdown from "markdown-to-jsx"
import ProxyImg from "../ProxyImg"

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

  return (
    <div className="flex flex-col gap-2 px-5">
      <h1 className="flex items-center gap-2 text-lg">{title}</h1>
      {imageUrl && !standalone && (
        <ProxyImg
          src={imageUrl}
          alt={title || "Article preview"}
          className="rounded-lg max-h-48 w-full object-cover"
          width={400}
        />
      )}
      <Markdown
        className="prose leading-relaxed tracking-wide text-gray-450 whitespace-pre-wrap break-words [overflow-wrap:anywhere]"
        options={{forceBlock: true}}
      >
        {getDisplayContent()}
      </Markdown>
      {topics && <small className="text-custom-accent">#{topics}</small>}
    </div>
  )
}

export default LongForm
