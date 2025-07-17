import {
  searchDoubleRatchetUsers,
  DoubleRatchetUser,
  getDoubleRatchetUsersCount,
} from "../../utils/doubleRatchetUsers"
import {UserRow} from "@/shared/components/user/UserRow"
import {useState, useEffect} from "react"
import MemberChip from "./MemberChip"
import DoubleRatchetInfo from "./DoubleRatchetInfo"

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
  myPubKey,
}: MemberSelectionProps) => {
  const [searchInput, setSearchInput] = useState("")
  const [searchResults, setSearchResults] = useState<DoubleRatchetUser[]>([])
  const [doubleRatchetCount, setDoubleRatchetCount] = useState(0)

  useEffect(() => {
    if (myPubKey) {
      const interval = setInterval(() => {
        setDoubleRatchetCount(getDoubleRatchetUsersCount())
      }, 1000)
      return () => {
        clearInterval(interval)
      }
    }
  }, [myPubKey])

  const handleSearchChange = (value: string) => {
    setSearchInput(value)
    if (!value.trim()) {
      setSearchResults([])
      return
    }
    const results = searchDoubleRatchetUsers(value)
    setSearchResults(results.slice(0, 10))
  }

  const handleAddMember = (user: DoubleRatchetUser) => {
    onAddMember(user)
    setSearchInput("")
    setSearchResults([])
  }

  return (
    <>
      <div className="m-4 p-4 md:p-8 rounded-lg bg-base-100 flex flex-col gap-6">
        <div>
          Under Construction 🐒
          <h2 className="text-xl font-semibold mb-4">Add Members</h2>
          <div className="flex flex-col gap-4">
            <div>
              <input
                type="text"
                className="input input-bordered w-full"
                placeholder="Search for users to add"
                value={searchInput}
                onChange={(e) => handleSearchChange(e.target.value)}
              />
              <p className="text-sm text-base-content/70 mt-2">
                {doubleRatchetCount} followed users have enabled secure messaging
              </p>
            </div>

            {/* Search Results */}
            {searchResults.length > 0 && (
              <div className="flex flex-col gap-2 max-h-48 overflow-y-auto">
                {searchResults.map((user) => (
                  <button
                    key={user.pubkey}
                    type="button"
                    className="btn btn-ghost justify-start text-left"
                    onClick={() => handleAddMember(user)}
                  >
                    <UserRow pubKey={user.pubkey} linkToProfile={false} />
                  </button>
                ))}
              </div>
            )}

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
        </div>

        {/* Error Display */}
        {error && (
          <div className="alert alert-error">
            <span>{error}</span>
          </div>
        )}

        {/* Next Button */}
        <button
          type="button"
          className="btn btn-primary"
          onClick={onNext}
          disabled={selectedMembers.length === 0}
        >
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
