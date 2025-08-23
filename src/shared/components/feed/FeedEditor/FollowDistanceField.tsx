interface FollowDistanceFieldProps {
  value: number | undefined
  onChange: (distance: number | undefined) => void
  label?: string
  showLabel?: boolean
}

export function FollowDistanceField({
  value,
  onChange,
  label = "Follow Distance",
  showLabel = true,
}: FollowDistanceFieldProps) {
  return (
    <div className="flex items-start gap-2">
      {showLabel && (
        <span className="text-sm text-base-content/70 min-w-[7rem] pt-2">{label}</span>
      )}
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={value !== undefined}
            onChange={(e) => {
              if (e.target.checked) {
                // Enable with default value of 3
                onChange(3)
              } else {
                // Disable by setting to undefined
                onChange(undefined)
              }
            }}
            className="checkbox checkbox-sm"
          />
          <input
            type="number"
            min="0"
            max="10"
            value={value !== undefined ? value : ""}
            onChange={(e) =>
              onChange(e.target.value ? parseInt(e.target.value) : undefined)
            }
            className="input input-sm w-20 text-sm"
            disabled={value === undefined}
          />
        </div>
        <span className="text-xs text-base-content/50 mt-1 block">
          Max degrees of separation (0=only yourself, 1=follows only, 2=friends of
          friends, etc.)
        </span>
      </div>
    </div>
  )
}
