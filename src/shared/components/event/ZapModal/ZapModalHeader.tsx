import {Avatar} from "@/shared/components/user/Avatar"
import {Name} from "@/shared/components/user/Name"

interface ZapModalHeaderProps {
  pubKey: string
}

export function ZapModalHeader({pubKey}: ZapModalHeaderProps) {
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex items-center gap-3">
        <Avatar pubKey={pubKey} width={40} showBadge={false} />
        <div className="flex flex-col">
          <span className="text-sm opacity-70">Send zap to</span>
          <Name pubKey={pubKey} className="font-semibold" />
        </div>
      </div>
      <h3 className="font-semibold uppercase">Zap amount in bits</h3>
    </div>
  )
}
