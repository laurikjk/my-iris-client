import {useDraftStore} from "@/stores/draft"
import {getExpirationLabel} from "@/utils/expiration"
import {RiMapPinLine, RiTimeLine} from "@remixicon/react"

interface GeohashDisplayProps {
  draftKey: string
  expirationDelta: number | null
  disabled: boolean
}

export function GeohashDisplay({
  draftKey,
  expirationDelta,
  disabled,
}: GeohashDisplayProps) {
  const draftStore = useDraftStore()
  const draft = draftStore.getDraft(draftKey)
  const hasGeohash = draft?.gTags && draft.gTags.length > 0
  const hasExpiration = expirationDelta !== null

  if (!hasGeohash && !hasExpiration) return null

  return (
    <div className="flex items-center justify-between text-sm text-base-content/70 mb-3">
      {hasGeohash ? (
        <div className="flex items-center gap-2">
          <RiMapPinLine className="w-4 h-4" />
          <div className="flex gap-2 flex-wrap">
            {draft.gTags.map((gh) => (
              <span key={gh} className="badge badge-sm">
                {gh}
                <button
                  onClick={() => {
                    const newGTags = draft.gTags.filter((tag) => tag !== gh)
                    draftStore.setDraft(draftKey, {gTags: newGTags})
                  }}
                  className="ml-1 hover:text-error"
                  disabled={disabled}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>
      ) : (
        <div />
      )}

      {hasExpiration && (
        <div
          className="flex items-center gap-1 text-sm text-base-content/70"
          title={`Expires: ${new Intl.DateTimeFormat(undefined, {
            dateStyle: "medium",
            timeStyle: "long",
          }).format((Math.floor(Date.now() / 1000) + expirationDelta) * 1000)}`}
        >
          <RiTimeLine className="w-4 h-4" />
          <span>Expires in {getExpirationLabel(expirationDelta)}</span>
        </div>
      )}
    </div>
  )
}
