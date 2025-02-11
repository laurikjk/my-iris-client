import socialGraph, {shouldSocialHide} from "@/utils/socialGraph"
import FollowList from "@/pages/user/components/FollowList"
import Modal from "@/shared/components/ui/Modal.tsx"
import {Fragment, useMemo, useState} from "react"
import {Link} from "react-router-dom"
import {nip19} from "nostr-tools"
import {Name} from "./Name"

const MAX_MUTED_BY_DISPLAY = 3

export default function MutedBy({pubkey}: {pubkey: string}) {
  const {mutedByArray, totalMutedBy} = useMemo(() => {
    const mutedBy = socialGraph().getUserMutedBy(pubkey)
    return {
      mutedByArray: Array.from(mutedBy).slice(0, MAX_MUTED_BY_DISPLAY),
      totalMutedBy: mutedBy.size,
    }
  }, [pubkey])

  const isOverMuted = totalMutedBy > 0 && shouldSocialHide(pubkey, 3)

  const [showMuterList, setShowMuterList] = useState<boolean>(false)

  const renderMutedByLinks = () => {
    return mutedByArray.map((a, index) => (
      <Fragment key={a}>
        <Link to={`/${nip19.npubEncode(a)}`} className="link inline">
          <Name pubKey={a} />
        </Link>
        {index < mutedByArray.length - 1 && ","}{" "}
      </Fragment>
    ))
  }

  return (
    <div className="text-base-content/50">
      {isOverMuted && totalMutedBy > 0 && (
        <div className="flex items-center gap-1 text-warning">
          <span role="img" aria-label="warning" className="text-warning">
            ⚠️
          </span>
          <span className="mr-1">Muted by</span>
          {renderMutedByLinks()}
          {totalMutedBy > MAX_MUTED_BY_DISPLAY && (
            <>
              and{" "}
              <span
                className="link cursor-pointer"
                onClick={() => setShowMuterList(true)}
              >
                {totalMutedBy - MAX_MUTED_BY_DISPLAY} others
              </span>
            </>
          )}
        </div>
      )}
      {showMuterList && (
        <Modal onClose={() => setShowMuterList(false)}>
          <div className="w-[400px] max-w-full">
            <h3 className="text-xl font-semibold mb-4">Muters</h3>
            <div className="overflow-y-auto max-h-[50vh]">
              <FollowList follows={Array.from(socialGraph().getUserMutedBy(pubkey))} />
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
