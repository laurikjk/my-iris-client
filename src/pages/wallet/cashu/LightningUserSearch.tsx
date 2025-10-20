import {useState, useEffect, useMemo} from "react"
import {UserRow} from "@/shared/components/user/UserRow"
import {useSearch} from "@/shared/hooks/useSearch"
import useProfile from "@/shared/hooks/useProfile"

interface LightningUserSearchProps {
  placeholder?: string
  onUserSelect: (pubkey: string, lud16: string) => void
  maxResults?: number
  className?: string
}

// Component to display user with lightning check
function UserWithLightningCheck({
  pubkey,
  onSelect,
}: {
  pubkey: string
  onSelect: () => void
}) {
  const profile = useProfile(pubkey)

  if (!profile?.lud16 && !profile?.lud06) {
    return null
  }

  return (
    <button className="btn btn-ghost justify-start text-left w-full" onClick={onSelect}>
      <UserRow pubKey={pubkey} linkToProfile={false} />
    </button>
  )
}

export const LightningUserSearch = ({
  placeholder = "Search users with lightning address",
  onUserSelect,
  maxResults = 10,
  className = "",
}: LightningUserSearchProps) => {
  const [searchInput, setSearchInput] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const peopleSearch = useSearch({maxResults})

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchInput])

  useEffect(() => {
    if (debouncedSearch.length >= 2) {
      peopleSearch.setValue(debouncedSearch)
    }
  }, [debouncedSearch, peopleSearch])

  const showResults = useMemo(
    () => debouncedSearch.length >= 2 && peopleSearch.searchResults.length > 0,
    [debouncedSearch, peopleSearch.searchResults.length]
  )

  const handleUserSelect = (pubkey: string, lud16: string) => {
    setSearchInput("")
    setDebouncedSearch("")
    onUserSelect(pubkey, lud16)
  }

  return (
    <div className={`flex flex-col gap-4 ${className}`}>
      <input
        type="text"
        className="input input-bordered w-full"
        placeholder={placeholder}
        value={searchInput}
        onChange={(e) => setSearchInput(e.target.value)}
      />
      {showResults && (
        <div className="flex flex-col gap-2 max-h-64 overflow-y-auto">
          {peopleSearch.searchResults.map((result) => {
            return (
              <UserWithLightningCheckWrapper
                key={result.pubKey}
                pubkey={result.pubKey}
                onUserSelect={handleUserSelect}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}

// Wrapper to properly use hooks
function UserWithLightningCheckWrapper({
  pubkey,
  onUserSelect,
}: {
  pubkey: string
  onUserSelect: (pubkey: string, lud16: string) => void
}) {
  const profile = useProfile(pubkey)
  const lud16 = profile?.lud16 || profile?.lud06
  if (!lud16) return null

  return (
    <UserWithLightningCheck
      pubkey={pubkey}
      onSelect={() => onUserSelect(pubkey, lud16)}
    />
  )
}
