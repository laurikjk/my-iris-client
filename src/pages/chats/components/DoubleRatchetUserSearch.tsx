import {useState} from "react"
import {UserRow} from "@/shared/components/user/UserRow"
import {useDoubleRatchetUsers} from "../hooks/useDoubleRatchetUsers"
import {DoubleRatchetUser} from "../utils/doubleRatchetUsers"

interface DoubleRatchetUserSearchProps {
  placeholder?: string
  onUserSelect: (user: DoubleRatchetUser) => void
  maxResults?: number
  showCount?: boolean
  className?: string
}

export const DoubleRatchetUserSearch = ({
  placeholder = "Search for users",
  onUserSelect,
  maxResults = 10,
  showCount = true,
  className = "",
}: DoubleRatchetUserSearchProps) => {
  const [searchInput, setSearchInput] = useState("")
  const [searchResults, setSearchResults] = useState<DoubleRatchetUser[]>([])
  const {count, search} = useDoubleRatchetUsers()

  const handleSearchChange = (value: string) => {
    setSearchInput(value)
    if (!value.trim()) {
      setSearchResults([])
      return
    }
    const results = search(value)
    setSearchResults(results.slice(0, maxResults))
  }

  return (
    <div className={`flex flex-col gap-4 ${className}`}>
      <div>
        <input
          type="text"
          className="input input-bordered w-full"
          placeholder={placeholder}
          value={searchInput}
          onChange={(e) => handleSearchChange(e.target.value)}
        />
        {showCount && (
          <p className="text-sm text-base-content/70 mt-2">
            {count} followed or messaged users have enabled secure messaging
          </p>
        )}
      </div>
      {searchResults.length > 0 && (
        <div className="flex flex-col gap-2">
          {searchResults.map((user) => (
            <button
              key={user.pubkey}
              className="btn btn-ghost justify-start text-left"
              onClick={() => onUserSelect(user)}
            >
              <UserRow pubKey={user.pubkey} linkToProfile={false} />
            </button>
          ))}
        </div>
      )}
    </div>
  )
} 