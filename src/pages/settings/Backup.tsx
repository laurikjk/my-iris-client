import CopyButton from "@/shared/components/button/CopyButton.tsx"
import {useLocalState} from "irisdb-hooks/src/useLocalState"
import {hexToBytes} from "@noble/hashes/utils"
import {nip19} from "nostr-tools"

function Backup() {
  const [myPrivateKey] = useLocalState("user/privateKey", "")

  return (
    <div>
      <h1 className="text-2xl mb-4">Backup</h1>
      <div className="flex flex-col gap-4">
        {myPrivateKey && (
          <div>
            <p>Backup your Nostr key</p>
            <small>Copy and securely store your secret key.</small>
            <div className="mt-2">
              <CopyButton
                className="btn btn-primary"
                copyStr={nip19.nsecEncode(hexToBytes(myPrivateKey))}
                text="Copy secret key"
              />
            </div>
          </div>
        )}
        <div>
          <p>Backup your Notes</p>
          <small>Export all your notes for safekeeping.</small>
          <div className="mt-2">
            <button className="btn btn-primary" disabled>
              Coming soon
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Backup
