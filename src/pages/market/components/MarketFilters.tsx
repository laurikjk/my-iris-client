import {useParams, useNavigate} from "@/navigation"
import {useRef, useState, useEffect, FormEvent} from "react"
import SearchTabSelector from "@/shared/components/search/SearchTabSelector"
import Icon from "@/shared/components/Icons/Icon"
import {marketStore} from "@/stores/marketstore"

export default function MarketFilters() {
  const {category} = useParams()
  const navigate = useNavigate()
  const searchInputRef = useRef<HTMLInputElement>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [availableTags, setAvailableTags] = useState<string[]>([])

  useEffect(() => {
    const loadTags = async () => {
      const tags = await marketStore.getTags()
      setAvailableTags(tags)
    }
    loadTags()
  }, [])

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (searchTerm.trim()) {
      navigate(`/m/${encodeURIComponent(searchTerm.trim())}`)
    }
  }

  const hasCategory = Boolean(category?.trim())

  return (
    <div className="flex flex-col gap-2">
      <SearchTabSelector activeTab="market" />

      <div className="w-full p-2">
        <form onSubmit={handleSubmit} className="w-full">
          <label className="input input-bordered flex items-center gap-2 w-full">
            <input
              ref={searchInputRef}
              type="text"
              className="grow"
              placeholder="Search market..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <Icon name="search-outline" className="text-neutral-content/60" />
          </label>
        </form>
      </div>

      <div className="mb-6 px-2">
        <div className="flex items-center gap-3 mb-3">
          <h3 className="text-lg font-semibold text-base-content">Categories</h3>
          {hasCategory && (
            <button
              onClick={() => navigate("/m")}
              className="text-sm text-base-content/60 hover:text-base-content"
            >
              Clear
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-2 content-start">
          {availableTags.map((tag) => (
            <button
              key={tag}
              onClick={() => {
                navigate(`/m/${encodeURIComponent(tag)}`)
              }}
              className={`badge cursor-pointer transition-colors h-fit ${
                category === tag
                  ? "badge-primary"
                  : "badge-outline hover:bg-primary hover:text-primary-content hover:border-primary"
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
