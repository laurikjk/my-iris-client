import {useSettingsStore} from "@/stores/settings"
import {RiVideoLine} from "@remixicon/react"
import {useState, MouseEvent} from "react"
import ProxyImg from "../../ProxyImg"
import classNames from "classnames"
import {EmbedEvent} from "../index"

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

  const onClick = (e: MouseEvent) => {
    if (isBlurred) {
      setIsBlurred(false)
      e.stopPropagation()
    }
  }

  return (
    <div className="my-2">
      {error ? (
        <RiVideoLine className="w-24 h-24" />
      ) : (
        <ProxyImg
          square={true}
          onClick={onClick}
          onError={() => setError(true)}
          className={classNames("rounded object-cover w-24 h-24", {"blur-xl": isBlurred})}
          src={match}
          width={90}
          alt="thumbnail"
        />
      )}
    </div>
  )
}

export default SmallThumbnailComponent
