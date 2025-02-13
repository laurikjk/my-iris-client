interface InstagramComponentProps {
  match: string
}

function InstagramComponent({match}: InstagramComponentProps) {
  return (
    <iframe
      className="instagram"
      width="650"
      height="400"
      style={{maxWidth: "100%"}}
      src={`https://instagram.com/${match}/embed`}
      frameBorder="0"
      allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
      allowFullScreen
    />
  )
}

export default InstagramComponent
