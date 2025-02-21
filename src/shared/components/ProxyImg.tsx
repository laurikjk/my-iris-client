import {CSSProperties, useEffect, useState, MouseEvent} from "react"
import * as utils from "@noble/curves/abstract/utils"
import {sha256} from "@noble/hashes/sha256"
import {hmac} from "@noble/hashes/hmac"
import {base64} from "@scure/base"

type Props = {
  src: string
  className?: string
  style?: CSSProperties
  width?: number
  square?: boolean
  onError?: () => void
  onClick?: (ev: MouseEvent) => void
  alt?: string
  hideBroken?: boolean
}

const safeOrigins = [
  "data:image",
  "https://imgur.com/",
  "https://i.imgur.com/",
  "https://imgproxy.iris.to/",
  "https://imgproxy.snort.social/",
]

const DefaultImgProxy = {
  url: "https://imgproxy.snort.social",
  key: "a82fcf26aa0ccb55dfc6b4bd6a1c90744d3be0f38429f21a8828b43449ce7cebe6bdc2b09a827311bef37b18ce35cb1e6b1c60387a254541afa9e5b4264ae942",
  salt: "a897770d9abf163de055e9617891214e75a9016d748f8ef865e6ffbcb9ed932295659549773a22a019a5f06d0b440c320be411e3fddfe784e199e4f03d74bd9b",
}

const shouldSkipProxy = (url: string) => {
  return safeOrigins.some((origin) => url.startsWith(origin))
}

function urlSafe(s: string) {
  return s.replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_")
}

function hmacSha256(key: Uint8Array, ...messages: Uint8Array[]) {
  return hmac(sha256, key, utils.concatBytes(...messages))
}

function signUrl(path: string, key: string, salt: string) {
  const te = new TextEncoder()
  const result = hmacSha256(
    utils.hexToBytes(key),
    utils.hexToBytes(salt),
    te.encode(path)
  )
  return urlSafe(base64.encode(result))
}

const generateProxyUrl = (originalSrc: string, width?: number, square?: boolean) => {
  const te = new TextEncoder()
  const encodedUrl = urlSafe(base64.encode(te.encode(originalSrc)))

  const opts = []
  if (width) {
    const resizeType = square ? "fill" : "fit"
    opts.push(`rs:${resizeType}:${width * 2}:${width * 2}`)
    opts.push("dpr:2")
  } else {
    opts.push("dpr:2")
  }

  const path = `/${opts.join("/")}/${encodedUrl}`
  const signature = signUrl(path, DefaultImgProxy.key, DefaultImgProxy.salt)

  return `${DefaultImgProxy.url}/${signature}${path}`
}

const ProxyImg = (props: Props) => {
  const [proxyFailed, setProxyFailed] = useState(false)
  const [src, setSrc] = useState(props.src)
  const [loadFailed, setLoadFailed] = useState(false)

  useEffect(() => {
    let mySrc = props.src
    if (
      props.src &&
      !props.src.startsWith("data:image") &&
      (!shouldSkipProxy(props.src) || props.width)
    ) {
      mySrc = generateProxyUrl(props.src, props.width, props.square)
      setSrc(mySrc)
    }
  }, [props.src, props.width, props.square])

  const handleError = () => {
    if (proxyFailed) {
      console.log("original source failed too", props.src)
      setLoadFailed(true)
      props.onError && props.onError()
      if (props.hideBroken) {
        setSrc("")
      }
    } else {
      console.log("image proxy failed", src, "trying original source", props.src)
      setProxyFailed(true)
      setSrc(props.src)
    }
  }

  if (!src || loadFailed) {
    return null
  }

  return (
    <img
      src={src}
      onError={handleError}
      onClick={props.onClick}
      className={props.className}
      style={props.style}
      alt={props.alt}
    />
  )
}

export default ProxyImg
