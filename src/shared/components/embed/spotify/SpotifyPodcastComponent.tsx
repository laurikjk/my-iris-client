interface SpotifyPodcastComponentProps {
  match: string
}

function SpotifyPodcastComponent({match}: SpotifyPodcastComponentProps) {
  return (
    <iframe
      scrolling="no"
      width="650"
      height="200"
      style={{maxWidth: "100%"}}
      src={`https://open.spotify.com/embed/episode/${match}`}
      frameBorder="0"
      allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
      allowFullScreen
    />
  )
}

export default SpotifyPodcastComponent
