import {useLocation, useNavigate} from "@/navigation"

interface SearchTabSelectorProps {
  activeTab?: "people" | "posts" | "market" | "map" | "relay"
}

export default function SearchTabSelector({activeTab}: SearchTabSelectorProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const path = location.pathname

  // Determine active tab based on current route if not provided
  const currentTab =
    activeTab ||
    (() => {
      if (path.startsWith("/u")) return "people"
      if (path.startsWith("/m")) return "market"
      if (path.startsWith("/map")) return "map"
      if (path.startsWith("/relay")) return "relay"
      if (path.startsWith("/search")) return "posts"
      return "posts"
    })()

  return (
    <div className="flex gap-2 overflow-x-auto p-2">
      <button
        className={`btn btn-sm ${currentTab === "people" ? "btn-primary" : "btn-neutral"}`}
        onClick={() => navigate("/u")}
      >
        People
      </button>
      <button
        className={`btn btn-sm ${currentTab === "posts" ? "btn-primary" : "btn-neutral"}`}
        onClick={() => navigate("/search")}
      >
        Posts
      </button>
      <button
        className={`btn btn-sm ${currentTab === "market" ? "btn-primary" : "btn-neutral"}`}
        onClick={() => navigate("/m")}
      >
        Market
      </button>
      <button
        className={`btn btn-sm ${currentTab === "map" ? "btn-primary" : "btn-neutral"}`}
        onClick={() => navigate("/map")}
      >
        Map
      </button>
      <button
        className={`btn btn-sm ${currentTab === "relay" ? "btn-primary" : "btn-neutral"}`}
        onClick={() => navigate("/relay")}
      >
        Relay
      </button>
    </div>
  )
}
