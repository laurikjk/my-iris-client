interface SpotifyAlbumComponentProps {
  match: string
}

function SpotifyAlbumComponent({match}: SpotifyAlbumComponentProps) {
  return (
    <iframe
      scrolling="no"
      width="650"
      height="400"
      style={{maxWidth: "100%"}}
      src={`https://open.spotify.com/embed/album/${match}`}
      frameBorder="0"
      allow="encrypted-media"
    />
  )
}

export default SpotifyAlbumComponent
