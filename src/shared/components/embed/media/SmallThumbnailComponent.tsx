import {useSettingsStore} from "@/stores/settings"
import {RiVideoLine} from "@remixicon/react"
import {useState, MouseEvent, useMemo} from "react"
import ProxyImg from "../../ProxyImg"
import classNames from "classnames"
import {EmbedEvent} from "../index"
import {generateBlurhashUrl, calculateDimensions} from "./mediaUtils"

interface SmallThumbnailComponentProps {
  match: string
  event: EmbedEvent | undefined
}

function SmallThumbnailComponent({match, event}: SmallThumbnailComponentProps) {
  const {content} = useSettingsStore()
  const [isBlurred, setIsBlurred] = useState(
    content.blurNSFW &&
      (!!event?.content.toLowerCase().includes("#nsfw") ||
        event?.tags.some((t) => t[0] === "content-warning"))
  )
  const [error, setError] = useState(false)

  // Extract imeta tag for this URL
  const imetaTag = useMemo(() => {
    if (!event?.tags) return undefined
    return event.tags.find(
      (tag) => tag[0] === "imeta" && tag[1] && tag[1].includes(match)
    )
  }, [event?.tags, match])

  // Extract dimensions from imeta tag if available
  const dimensions = imetaTag?.find((tag) => tag.startsWith("dim "))?.split(" ")[1]
  const [originalWidth, originalHeight] = dimensions
    ? dimensions.split("x").map(Number)
    : [null, null]

  // Extract blurhash from imeta tag if available
  const blurhash = imetaTag?.find((tag) => tag.startsWith("blurhash "))?.split(" ")[1]

  // Extract alt text from imeta name field and truncate it
  const altText = useMemo(() => {
    const namePart = imetaTag?.find((tag) => tag.startsWith("name "))
    if (!namePart) return "thumbnail"
    const name = namePart.substring(5) // Remove "name " prefix
    return name.length > 30 ? name.substring(0, 30) + "..." : name
  }, [imetaTag])

  // Generate blurhash URL for placeholder (use original dimensions for better aspect ratio)
  const blurhashDimensions =
    originalWidth && originalHeight
      ? calculateDimensions(originalWidth, originalHeight, true)
      : undefined

  const blurhashUrl = useMemo(
    () => generateBlurhashUrl(blurhash, blurhashDimensions),
    [blurhash, blurhashDimensions]
  )

  const onClick = (e: MouseEvent) => {
    if (isBlurred) {
      setIsBlurred(false)
      e.stopPropagation()
    }
  }

  // Fixed square dimensions
  const containerStyle = {
    width: "96px", // 24 * 4 = w-24
    height: "96px", // 24 * 4 = h-24
  }

  return (
    <div className="my-2">
      {error ? (
        <div
          className="rounded bg-neutral-200 dark:bg-neutral-700 flex items-center justify-center text-neutral-500 dark:text-neutral-400"
          style={containerStyle}
        >
          {blurhashUrl ? (
            <div
              className="w-full h-full rounded flex items-center justify-center"
              style={{
                backgroundImage: `url(${blurhashUrl})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }}
            >
              <RiVideoLine className="w-6 h-6 opacity-70" />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center p-2">
              <RiVideoLine className="w-6 h-6 opacity-70 mb-1" />
              {altText !== "thumbnail" && (
                <span className="text-xs text-center leading-tight opacity-60">
                  {altText}
                </span>
              )}
            </div>
          )}
        </div>
      ) : (
        <div
          className="relative"
          style={{
            width: "96px",
            height: "96px",
          }}
        >
          <ProxyImg
            square={true}
            onClick={onClick}
            onError={() => setError(true)}
            hideBroken={true}
            loadOriginalIfProxyFails={false}
            className={classNames("rounded object-cover", {"blur-xl": isBlurred})}
            style={{
              width: "96px",
              height: "96px",
              backgroundImage: blurhashUrl ? `url(${blurhashUrl})` : undefined,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
            src={match}
            width={96}
            alt={altText}
          />
          {/* Fallback placeholder in case ProxyImg renders nothing */}
          {!error && (
            <div
              className="absolute inset-0 rounded bg-neutral-200 dark:bg-neutral-700 flex items-center justify-center text-neutral-500 dark:text-neutral-400"
              style={{
                zIndex: -1,
              }}
            >
              {blurhashUrl ? (
                <div
                  className="w-full h-full rounded flex items-center justify-center"
                  style={{
                    backgroundImage: `url(${blurhashUrl})`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                  }}
                >
                  <RiVideoLine className="w-6 h-6 opacity-70" />
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center p-2">
                  <RiVideoLine className="w-6 h-6 opacity-70 mb-1" />
                  {altText !== "thumbnail" && (
                    <span className="text-xs text-center leading-tight opacity-60">
                      {altText}
                    </span>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default SmallThumbnailComponent
