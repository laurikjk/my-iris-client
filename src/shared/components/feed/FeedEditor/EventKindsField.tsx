import EventKindsSelector from "@/shared/components/ui/EventKindsSelector"

interface EventKindsFieldProps {
  value: number[] | undefined
  onChange: (kinds: number[] | undefined) => void
  label?: string
  showLabel?: boolean
}

export function EventKindsField({
  value = [],
  onChange,
  label = "Event Kinds",
  showLabel = true,
}: EventKindsFieldProps) {
  return (
    <div className="flex items-start gap-2 overflow-hidden">
      {showLabel && (
        <span className="text-sm text-base-content/70 min-w-[7rem] pt-2 flex-shrink-0">
          {label}
        </span>
      )}
      <div className="flex-1 min-w-0 overflow-hidden">
        <EventKindsSelector
          selectedKinds={value}
          onKindsChange={(kinds) => onChange(kinds.length > 0 ? kinds : undefined)}
        />
        <span className="text-xs text-base-content/50 mt-1 block">
          Select event types to include in this feed. Select none to display all.
        </span>
      </div>
    </div>
  )
}
