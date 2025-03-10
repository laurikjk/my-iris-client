import {useEffect, useRef, useState} from "react"
import {useNavigate} from "react-router"
import classNames from "classnames"
import {nip19} from "nostr-tools"

import socialGraph, {
  searchIndex,
  SearchResult,
  shouldSocialHide,
} from "@/utils/socialGraph"
import {UserRow} from "@/shared/components/user/UserRow"
import Icon from "../Icons/Icon"
import {ndk} from "@/utils/ndk"

const NOSTR_REGEX = /(npub|note|nevent|naddr)1[a-zA-Z0-9]{58,300}/gi
const HEX_REGEX = /[0-9a-fA-F]{64}/gi
const NIP05_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MAX_RESULTS = 6

// Search ranking constants
const DISTANCE_PENALTY = 0.01 // Penalty per step of social distance
const FRIEND_BOOST = 0.005 // Boost per friend following the result
const DEFAULT_DISTANCE = 999 // Default distance for users not in social graph
const FUSE_MULTIPLIER = 5 // Multiplier to emphasize text match
const PREFIX_MATCH_BOOST = 0.5

interface CustomSearchResult extends SearchResult {
  query?: string
}

// this component is used for global search in the Header.tsx
// and for searching assignees in Issues & PRs
interface SearchBoxProps {
  onSelect?: (pubKey: string) => void
  redirect?: boolean
  className?: string
  searchNotes?: boolean
  maxResults?: number
}

function SearchBox({
  redirect = true,
  onSelect,
  className,
  searchNotes = false,
  maxResults = MAX_RESULTS,
}: SearchBoxProps) {
  const [searchResults, setSearchResults] = useState<CustomSearchResult[]>([])
  const [activeResult, setActiveResult] = useState<number>(0)
  const [value, setValue] = useState<string>("")
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()

  onSelect =
    onSelect ||
    ((pubKey: string) => {
      try {
        navigate(`/${nip19.npubEncode(pubKey)}`)
      } catch (error) {
        console.error("Error encoding pubkey:", error)
        navigate(`/${pubKey}`)
      }
    })

  useEffect(() => {
    const v = value.trim()
    if (v) {
      if (v.match(NOSTR_REGEX)) {
        let result
        try {
          result = nip19.decode(v)
          if (result.type === "npub") {
            onSelect(result.data)
          } else {
            navigate(`/${v}`)
          }
        } catch (e) {
          navigate(`/${v}`)
        }
        setValue("")
        return
      } else if (v.match(HEX_REGEX)) {
        onSelect(v)
        setValue("")
        return
      } else if (v.match(NIP05_REGEX)) {
        ndk()
          .getUserFromNip05(v)
          .then((user) => {
            if (user) {
              onSelect(user.pubkey)
              setValue("")
            }
          })
      }

      const query = v.trim().toLowerCase()
      const results = searchIndex.search(query)
      const resultsWithAdjustedScores = results
        .filter(
          (result) =>
            !shouldSocialHide(result.item.pubKey) &&
            socialGraph().getFollowDistance(result.item.pubKey) !== 0
        )
        .map((result) => {
          const fuseScore = 1 - (result.score ?? 1)
          const followDistance =
            socialGraph().getFollowDistance(result.item.pubKey) ?? DEFAULT_DISTANCE
          const friendsFollowing =
            socialGraph().followedByFriends(result.item.pubKey).size || 0

          // Split name by word boundaries and check if any word starts with query
          const nameWords = result.item.name.toLowerCase().match(/\b\w+\b/g) || []
          const nameStartsWith = nameWords.some((word) => word.startsWith(query))
          const nip05StartsWith =
            result.item.nip05?.toLowerCase().startsWith(query) ?? false
          const prefixBoost = nameStartsWith || nip05StartsWith ? PREFIX_MATCH_BOOST : 0

          const adjustedScore =
            fuseScore * FUSE_MULTIPLIER -
            DISTANCE_PENALTY * (followDistance - 1) +
            FRIEND_BOOST * friendsFollowing +
            prefixBoost

          return {...result, adjustedScore}
        })

      // Sort by adjustedScore in DESCENDING order (higher is better)
      resultsWithAdjustedScores.sort((a, b) => b.adjustedScore - a.adjustedScore)

      if (!redirect) {
        setActiveResult(1)
      } else {
        setActiveResult(0)
      }
      setSearchResults([
        ...(searchNotes
          ? [{pubKey: "search-notes", name: `search notes: ${v}`, query: v}]
          : []),
        ...resultsWithAdjustedScores.map((result) => result.item),
      ])
    } else {
      setSearchResults([])
    }
  }, [value, navigate, searchNotes])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!value) return

      if (e.key === "ArrowDown") {
        e.preventDefault()
        setActiveResult((prev) => (prev + 1) % maxResults)
      } else if (e.key === "ArrowUp") {
        e.preventDefault()
        setActiveResult((prev) => (prev - 1 + maxResults) % maxResults)
      } else if (e.key === "Escape") {
        setValue("")
        setSearchResults([])
      } else if (e.key === "Enter" && searchResults.length > 0) {
        const activeItem = searchResults[activeResult]
        if (activeItem.pubKey === "search-notes" && activeItem.query && redirect) {
          navigate(`/search/${activeItem.query}`)
        } else {
          onSelect(activeItem.pubKey)
        }
        setValue("")
        setSearchResults([])
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [searchResults, activeResult, navigate, maxResults])

  // autofocus the input field when not redirecting
  useEffect(() => {
    if (!redirect && inputRef.current) {
      inputRef.current.focus()
    }
  }, [redirect])

  const handleSearchResultClick = (pubKey: string, query?: string) => {
    setValue("")
    setSearchResults([])
    if (pubKey === "search-notes" && query) {
      navigate(`/search/${query}`)
    } else {
      onSelect(pubKey)
    }
  }

  return (
    <div className={"dropdown dropdown-open"}>
      <label className={classNames("input flex items-center gap-2", className)}>
        <input
          type="text"
          className="grow"
          placeholder="Search"
          value={value}
          ref={inputRef}
          onChange={(e) => setValue(e.target.value)}
        />
        <Icon name="search-outline" className="text-neutral-content/60" />
      </label>
      {searchResults.length > 0 && (
        <ul className="dropdown-content menu shadow bg-base-100 rounded-box z-10 w-full">
          {searchResults.slice(0, maxResults).map((result, index) => (
            <li
              key={result.pubKey}
              className={classNames("cursor-pointer rounded-md", {
                "bg-primary text-primary-content": index === activeResult,
                "hover:bg-primary/50": index !== activeResult,
              })}
              onClick={() => handleSearchResultClick(result.pubKey, result.query)}
            >
              {result.pubKey === "search-notes" && searchNotes ? (
                <div className={classNames("inline", {hidden: !redirect})}>
                  Search notes: <span className="font-bold">{result.query}</span>
                </div>
              ) : (
                <div className="flex gap-1">
                  <UserRow pubKey={result.pubKey} linkToProfile={redirect} />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default SearchBox
