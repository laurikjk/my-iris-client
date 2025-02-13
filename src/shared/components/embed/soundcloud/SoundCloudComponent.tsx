interface SoundCloudComponentProps {
  match: string
}

function SoundCloudComponent({match}: SoundCloudComponentProps) {
  return (
    <iframe
      scrolling="no"
      width="650"
      height="380"
      style={{maxWidth: "100%"}}
      src={`https://w.soundcloud.com/player/?url=${match}`}
      frameBorder="0"
      allow="encrypted-media"
    />
  )
}

export default SoundCloudComponent
