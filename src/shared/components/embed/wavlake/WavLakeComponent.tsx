interface WavLakeComponentProps {
  match: string
}

function WavLakeComponent({match}: WavLakeComponentProps) {
  return (
    <iframe
      height="380"
      width="100%"
      style={{maxWidth: "100%"}}
      src={`https://embed.wavlake.com/${match}`}
      frameBorder="0"
      loading="lazy"
    />
  )
}

export default WavLakeComponent
