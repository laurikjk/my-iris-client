import {useState, MouseEvent} from "react"
import ProxyImg from "../../ProxyImg"
import classNames from "classnames"

interface ImageComponentProps {
  match: string
  index: number
  onClickImage: () => void
  blur?: boolean
  limitHeight?: boolean
}

const ImageComponent = ({
  match,
  index,
  onClickImage,
  blur,
  limitHeight,
}: ImageComponentProps) => {
  const [hasError, setHasError] = useState(false)

  const onClick = (event: MouseEvent) => {
    event.stopPropagation()
    onClickImage()
  }

  return (
    <div
      key={match + index}
      className={classNames("flex justify-center items-center md:justify-start my-2", {
        "h-[600px]": limitHeight,
      })}
    >
      {hasError ? (
        <div className="my-2 text-sm break-all">{match}</div>
      ) : (
        <ProxyImg
          width={Math.min(650, window.innerWidth)}
          onError={() => setHasError(true)}
          onClick={onClick}
          className={classNames("my-2 max-w-full cursor-pointer object-contain", {
            "blur-md": blur,
            "h-full max-h-[600px]": limitHeight,
            "max-h-[90vh] lg:max-h-[600px]": !limitHeight,
          })}
          src={match}
        />
      )}
    </div>
  )
}

export default ImageComponent
