import {Avatar} from "@/shared/components/user/Avatar"
import {Name} from "@/shared/components/user/Name"

interface MemberChipProps {
  pubkey: string
  onRemove?: (pubkey: string) => void
  variant?: "default" | "highlight"
}

const MemberChip = ({pubkey, onRemove, variant = "default"}: MemberChipProps) => {
  const baseClasses = "flex items-center gap-2 rounded-full px-3 py-1"
  const variantClasses = {
    default: "bg-base-200",
    highlight: "bg-primary/20",
  }

  return (
    <div className={`${baseClasses} ${variantClasses[variant]}`}>
      <Avatar pubKey={pubkey} width={24} />
      <span className="text-sm font-medium">
        <Name pubKey={pubkey} />
      </span>
      {onRemove && (
        <button
          type="button"
          onClick={() => onRemove(pubkey)}
          className="btn btn-ghost btn-xs text-error hover:bg-error hover:text-error-content"
        >
          ×
        </button>
      )}
    </div>
  )
}

export default MemberChip
