interface SpotifyTrackComponentProps {
  match: string
}

function SpotifyTrackComponent({match}: SpotifyTrackComponentProps) {
  return (
    <iframe
      scrolling="no"
      width="650"
      height="200"
      src={`https://open.spotify.com/embed/track/${match}?utm_source=oembed`}
      frameBorder="0"
      allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
      allowFullScreen
    />
  )
}

export default SpotifyTrackComponent
