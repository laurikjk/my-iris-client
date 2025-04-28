import {useState, MouseEvent} from "react"
import ProxyImg from "../../ProxyImg"
import {localState} from "irisdb/src"

import classNames from "classnames"

import {NDKEvent} from "@nostr-dev-kit/ndk"

interface SmallImageComponentProps {
  match: string
  event: NDKEvent | undefined
  size?: number
}

function SmallImageComponent({match, event, size = 80}: SmallImageComponentProps) {
  let blurNSFW = true
  localState.get("settings/blurNSFW").on((value) => {
    if (typeof value === "boolean") {
      blurNSFW = value
    }
  })

  const [hasError, setHasError] = useState(false)
  const [blur, setBlur] = useState(
    blurNSFW &&
      (!!event?.content.toLowerCase().includes("#nsfw") ||
        event?.tags.some((t) => t[0] === "content-warning"))
  )

  const onClick = (event: MouseEvent) => {
    if (blur) {
      setBlur(false)
      event.stopPropagation()
    }
  }

  const urls = match.trim().split(/\s+/)

  return (
    <div className="flex flex-wrap justify-start items-center gap-2">
      {urls.map((url, index) => (
        <div key={index} className="flex justify-start items-center">
          {hasError ? (
            <div className="my-2 text-sm break-all">{url}</div>
          ) : (
            <ProxyImg
              square={true}
              width={size}
              onError={() => setHasError(true)}
              onClick={onClick}
              className={classNames(
                "mt-2 rounded cursor-pointer aspect-square object-cover",
                {
                  "blur-xl": blur,
                }
              )}
              style={{width: size, height: size}}
              src={url}
            />
          )}
        </div>
      ))}
    </div>
  )
}

export default SmallImageComponent
