import {useState} from "react"

interface TwitchClipComponentProps {
  match: string
}

export default function TwitchClipComponent({match}: TwitchClipComponentProps) {
  const [error, setError] = useState(false)

  if (error) {
    return (
      <div className="p-4 border rounded-lg bg-base-200">
        <p className="text-sm text-error">Failed to load Twitch clip</p>
        <a
          href={match}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline text-sm"
        >
          Watch on Twitch
        </a>
      </div>
    )
  }

  // Extract clip ID from the full URL
  const clipMatch = match.match(/\/clip\/([\w-]+)/)
  const clipId = clipMatch?.[1]

  if (!clipId) {
    return (
      <a
        href={match.startsWith('http') ? match : `https://${match}`}
        target="_blank"
        rel="noopener noreferrer"
        className="text-primary hover:underline"
      >
        {match}
      </a>
    )
  }

  return (
    <div className="w-full aspect-video max-w-2xl">
      <iframe
        src={`https://clips.twitch.tv/embed?clip=${clipId}&parent=${window.location.hostname}`}
        allowFullScreen
        width="100%"
        height="360"
        style={{minWidth: "400px", minHeight: "300px"}}
        className="rounded-lg"
        onError={() => setError(true)}
      />
    </div>
  )
}