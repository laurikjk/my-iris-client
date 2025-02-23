interface YoutubeComponentProps {
  match: string
}

function YoutubeComponent({match}: YoutubeComponentProps) {
  return (
    <iframe
      className="w-full"
      width="650"
      height="400"
      src={`https://youtube.com/embed/${match}`}
      frameBorder="0"
      allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
      allowFullScreen
    />
  )
}

export default YoutubeComponent
