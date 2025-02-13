interface AudioComponentProps {
  match: string
}

function AudioComponent({match}: AudioComponentProps) {
  return <audio src={match} controls={true} loop={true} />
}

export default AudioComponent
