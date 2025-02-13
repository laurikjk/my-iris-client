interface AppleMusicComponentProps {
  match: string
}

function AppleMusicComponent({match}: AppleMusicComponentProps) {
  return (
    <iframe
      className="applemusic"
      scrolling="no"
      width="650"
      height="150"
      style={{maxWidth: "100%"}}
      src={`https://embed.music.apple.com/${match}`}
      frameBorder="0"
      allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
      allowFullScreen
    />
  )
}

export default AppleMusicComponent
