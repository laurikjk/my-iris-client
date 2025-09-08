import {useParams} from "@/navigation"
import {useState, useEffect} from "react"
import SearchTabSelector from "@/shared/components/search/SearchTabSelector"
import MapWithEvents from "@/shared/components/map/MapWithEvents"

export default function MapFilters() {
  const {query} = useParams()
  const [selectedGeohashes, setSelectedGeohashes] = useState<string[]>(
    query ? [query.toLowerCase()] : []
  )

  // Update state when route parameter changes
  useEffect(() => {
    if (query) {
      setSelectedGeohashes([query.toLowerCase()])
    } else {
      setSelectedGeohashes([])
    }
  }, [query])

  return (
    <div className="flex flex-col h-full">
      <div className="flex-shrink-0">
        <SearchTabSelector activeTab="map" />
      </div>

      <div className="flex-1 min-h-0 pt-2">
        <MapWithEvents
          selectedGeohashes={selectedGeohashes}
          height="calc(100vh - 128px)"
          className="w-full"
        />
      </div>
    </div>
  )
}
