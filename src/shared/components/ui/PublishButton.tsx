import {RiAddLine} from "@remixicon/react"
import {usePublicKey} from "@/stores/user"
import {useUIStore} from "@/stores/ui"
import {useCallback} from "react"

function PublishButton() {
  const {newPostOpen, setNewPostOpen} = useUIStore()
  const myPubKey = usePublicKey()

  const handlePress = useCallback(
    () => setNewPostOpen(!newPostOpen),
    [newPostOpen, setNewPostOpen]
  )

  if (!myPubKey) return null

  return (
    <div className="ml-2 md:ml-0 xl:px-2 md:mt-2 hidden md:block xl:w-full">
      <button
        data-testid="new-post-button"
        className="btn btn-primary btn-circle xl:w-full xl:rounded-full text-lg"
        onClick={handlePress}
      >
        <RiAddLine className="xl:hidden" />
        <span className="hidden xl:inline">Post</span>
      </button>
    </div>
  )
}

export default PublishButton
