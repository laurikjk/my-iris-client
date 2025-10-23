import {SettingsGroup} from "@/shared/components/settings/SettingsGroup"
import {SettingsGroupItem} from "@/shared/components/settings/SettingsGroupItem"
import {CashuSeedBackup} from "@/shared/components/settings/CashuSeedBackup"
import {hexToBytes} from "@noble/hashes/utils"
import {useUserStore} from "@/stores/user"
import {nip19} from "nostr-tools"
import {useState} from "react"

function Keys() {
  const privateKey = useUserStore((state) => state.privateKey)
  const [isCopied, setIsCopied] = useState(false)
  const [isHexCopied, setIsHexCopied] = useState(false)

  const handleCopy = async () => {
    if (!privateKey) return

    await navigator.clipboard.writeText(nip19.nsecEncode(hexToBytes(privateKey)))
    setIsCopied(true)
    setTimeout(() => setIsCopied(false), 2000)
  }

  const handleCopyHex = async () => {
    if (!privateKey) return

    await navigator.clipboard.writeText(privateKey)
    setIsHexCopied(true)
    setTimeout(() => setIsHexCopied(false), 2000)
  }

  return (
    <div className="bg-base-200 min-h-full">
      <div className="p-4">
        <div className="space-y-6">
          <SettingsGroup title="Secret key">
            {privateKey ? (
              <>
                <SettingsGroupItem>
                  <div className="flex flex-col space-y-1">
                    <button onClick={handleCopy} className="text-info text-left">
                      {isCopied ? "Copied" : "Copy secret key (nsec)"}
                    </button>
                    <span className="text-xs text-base-content/60">
                      Copy and securely store your secret key. Keep this safe and never
                      share it.
                    </span>
                  </div>
                </SettingsGroupItem>
                <SettingsGroupItem isLast>
                  <div className="flex flex-col space-y-1">
                    <button onClick={handleCopyHex} className="text-info text-left">
                      {isHexCopied ? "Copied" : "Copy hex private key"}
                    </button>
                    <span className="text-xs text-base-content/60">
                      Raw hexadecimal format for advanced use cases.
                    </span>
                  </div>
                </SettingsGroupItem>
              </>
            ) : (
              <SettingsGroupItem isLast>
                <div className="text-center py-4 text-base-content/70">
                  No private key available to backup.
                </div>
              </SettingsGroupItem>
            )}
          </SettingsGroup>

          <SettingsGroup title="Cashu wallet">
            <SettingsGroupItem isLast>
              <CashuSeedBackup />
            </SettingsGroupItem>
          </SettingsGroup>
        </div>
      </div>
    </div>
  )
}

export default Keys
