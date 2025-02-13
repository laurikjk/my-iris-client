interface ApplePodcastComponentProps {
  match: string
}

function ApplePodcastComponent({match}: ApplePodcastComponentProps) {
  const cssClass = match.includes("?i=") ? "applepodcast-small" : "applepodcast-large"
  return (
    <iframe
      // class="applepodcast"
      className={cssClass}
      scrolling="no"
      width="650"
      height="175"
      style={{maxWidth: "100%"}}
      src={`https://embed.${match}`}
      frameBorder="0"
      allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
      allowFullScreen
    />
  )
}

export default ApplePodcastComponent
