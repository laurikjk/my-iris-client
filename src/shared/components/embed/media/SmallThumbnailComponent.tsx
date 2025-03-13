import {RiVideoLine} from "@remixicon/react"
import {NDKEvent} from "@nostr-dev-kit/ndk"
import {useState, MouseEvent} from "react"
import ProxyImg from "../../ProxyImg"
import {localState} from "irisdb/src"
import classNames from "classnames"

interface SmallThumbnailComponentProps {
  match: string
  event: NDKEvent | undefined
}

function SmallThumbnailComponent({match, event}: SmallThumbnailComponentProps) {
  let blurNSFW = true
  localState.get("settings/blurNSFW").on((value) => {
    if (typeof value === "boolean") {
      blurNSFW = value
    }
  })

  const [blur, setBlur] = useState(
    blurNSFW &&
      (!!event?.content.toLowerCase().includes("#nsfw") ||
        event?.tags.some((t) => t[0] === "content-warning"))
  )
  const [error, setError] = useState(false)

  const onClick = (e: MouseEvent) => {
    if (blur) {
      setBlur(false)
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
          className={classNames("rounded object-cover w-24 h-24", {"blur-xl": blur})}
          src={match}
          width={90}
          alt="thumbnail"
        />
      )}
    </div>
  )
}

export default SmallThumbnailComponent
