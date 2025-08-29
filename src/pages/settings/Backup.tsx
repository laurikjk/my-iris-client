import CopyButton from "@/shared/components/button/CopyButton.tsx"
import {SettingsGroup} from "@/shared/components/settings/SettingsGroup"
import {SettingsGroupItem} from "@/shared/components/settings/SettingsGroupItem"
import {hexToBytes} from "@noble/hashes/utils"
import {useUserStore} from "@/stores/user"
import {nip19} from "nostr-tools"

function Backup() {
  const privateKey = useUserStore((state) => state.privateKey)

  return (
    <div className="bg-base-200 min-h-full">
      <div className="p-4">
        <div className="space-y-6">
          <SettingsGroup title="Private Key">
            {privateKey ? (
              <SettingsGroupItem isLast>
                <div className="flex flex-col space-y-3">
                  <div>
                    <p className="text-base font-medium">Backup your Nostr key</p>
                    <p className="text-sm text-base-content/60 mt-1">
                      Copy and securely store your secret key. Keep this safe and never
                      share it.
                    </p>
                  </div>
                  <CopyButton
                    className="btn btn-primary"
                    copyStr={nip19.nsecEncode(hexToBytes(privateKey))}
                    text="Copy secret key"
                  />
                </div>
              </SettingsGroupItem>
            ) : (
              <SettingsGroupItem isLast>
                <div className="text-center py-4 text-base-content/70">
                  No private key available to backup.
                </div>
              </SettingsGroupItem>
            )}
          </SettingsGroup>
        </div>
      </div>
    </div>
  )
}

export default Backup
