import Icon from "../Icons/Icon"

interface MediaGridPlaceholderProps {
  count?: number
  showError?: boolean
  onRetry?: () => void
  errorMessage?: string
}

export const MediaGridPlaceholder = ({
  count = 1,
  showError = false,
  onRetry,
  errorMessage = "Failed to load",
}: MediaGridPlaceholderProps) => {
  if (showError) {
    return (
      <div className="aspect-square bg-gray-100 flex flex-col items-center justify-center gap-2 p-4">
        <Icon name="error-outline" className="text-gray-400 text-xl" />
        <span className="text-xs text-gray-500 text-center">{errorMessage}</span>
        {onRetry && (
          <button
            onClick={onRetry}
            className="text-xs text-blue-500 hover:text-blue-600 underline"
          >
            Retry
          </button>
        )}
      </div>
    )
  }

  return (
    <>
      {Array.from({length: count}).map((_, i) => (
        <div key={i} className="aspect-square bg-gray-200 animate-pulse rounded-sm" />
      ))}
    </>
  )
}

export default MediaGridPlaceholder
