import {useLocalState} from "irisdb-hooks/src/useLocalState"
import {useNavigate} from "react-router"
import {localState} from "irisdb/src"
import {nip19} from "nostr-tools"
import {useEffect} from "react"

import useSearchParam from "@/shared/hooks/useSearchParam.ts"

import ExplorerNode from "./ExplorerNode"

type Props = {
  p?: string
  path?: string
}

const Explorer = ({p}: Props) => {
  const [myPubKey] = useLocalState("user/publicKey", "")
  const user = useSearchParam("user", "")
  const navigate = useNavigate()

  useEffect(() => {
    if (myPubKey && !user) {
      navigate(`./?user=${nip19.npubEncode(myPubKey)}`, {replace: true})
    }
  }, [myPubKey, user])

  return (
    <div className="flex flex-col gap-2">
      <div>{p}</div>
      <div className="mb-4">
        <ExplorerNode expanded={true} name="Local data" node={localState} />
      </div>
    </div>
  )
}

export default Explorer
