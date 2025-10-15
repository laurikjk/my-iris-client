import {DoubleRatchetUser} from "../../utils/doubleRatchetUsers"
import MemberChip from "./MemberChip"
import DoubleRatchetInfo from "./DoubleRatchetInfo"
import {DoubleRatchetUserSearch} from "../../../chats/components/DoubleRatchetUserSearch"

interface MemberSelectionProps {
  selectedMembers: string[]
  onAddMember: (user: DoubleRatchetUser) => void
  onRemoveMember: (pubkey: string) => void
  onNext: () => void
  error: string | null
  myPubKey: string
}

const MemberSelection = ({
  selectedMembers,
  onAddMember,
  onRemoveMember,
  onNext,
  error,
}: MemberSelectionProps) => {
  const handleUserSelect = (user: DoubleRatchetUser) => {
    onAddMember(user)
  }

  return (
    <>
      <div className="m-4 p-4 md:p-8 rounded-lg bg-base-100 flex flex-col gap-6">
        <div>
          <h2 className="text-xl font-semibold mb-4">Add Members</h2>
          <DoubleRatchetUserSearch
            placeholder="Search for users to add"
            onUserSelect={handleUserSelect}
            maxResults={10}
            showCount={true}
            className="mb-4"
          />
          {/* Selected Members */}
          {selectedMembers.length > 0 && (
            <div>
              <h3 className="text-lg font-medium mb-3">
                Selected Members ({selectedMembers.length})
              </h3>
              <div className="flex flex-wrap gap-2">
                {selectedMembers.map((pubkey) => (
                  <MemberChip key={pubkey} pubkey={pubkey} onRemove={onRemoveMember} />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Error Display */}
        {error && (
          <div className="alert alert-error">
            <span>{error}</span>
          </div>
        )}

        {/* Next Button */}
        <button type="button" className="btn btn-primary" onClick={onNext}>
          Next ({selectedMembers.length} members)
        </button>
      </div>

      <hr className="mx-4 my-6 border-base-300" />
      <div className="px-2">
        <DoubleRatchetInfo />
      </div>
    </>
  )
}

export default MemberSelection
