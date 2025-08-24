import {useEffect, useRef, useState, useCallback} from "react"
import L, {type Map as LeafletMap} from "leaflet"
import worldGeoJSON from "./world-110m.json"
import {decodeGeohash} from "@/utils/geohash"

interface GeohashMapContentProps {
  geohashes?: string[]
  onGeohashSelect?: (geohash: string) => void
  height?: string
}

// Proper geohash grid structure
const GEOHASH_EVEN_DICT = "bcfguvyz89destwx2367kmqr0145hjnp"
const GEOHASH_ODD_DICT = "prxznqwyjmtvhksu57eg46df139c028b"

interface GridCell {
  geohash: string
  bounds: [[number, number], [number, number]]
}

function getGeohashGrid(
  bounds: [[number, number], [number, number]],
  parentGeohash: string = ""
): GridCell[] {
  const [[startLat, startLng], [endLat, endLng]] = bounds
  const offset = parentGeohash.length
  const odd = offset % 2

  const rowsNumber = odd ? 8 : 4
  const columnsNumber = odd ? 4 : 8
  const geohashDict = odd ? GEOHASH_ODD_DICT : GEOHASH_EVEN_DICT

  const lngStep = (endLng - startLng) / columnsNumber
  const latStep = (endLat - startLat) / rowsNumber

  const cells: GridCell[] = []

  for (let y = 0; y < rowsNumber; y++) {
    const rectLatStart = startLat + y * latStep
    const rectLatEnd = startLat + (y + 1) * latStep

    for (let x = 0; x < columnsNumber; x++) {
      const rectLngStart = startLng + x * lngStep
      const rectLngEnd = startLng + (x + 1) * lngStep
      const letter = geohashDict.charAt(columnsNumber * (rowsNumber - 1 - y) + x)

      cells.push({
        geohash: parentGeohash + letter,
        bounds: [
          [rectLatStart, rectLngStart],
          [rectLatEnd, rectLngEnd],
        ],
      })
    }
  }

  return cells
}

export default function GeohashMapContent({
  geohashes = [],
  onGeohashSelect,
  height = "24rem",
}: GeohashMapContentProps) {
  const mapRef = useRef<LeafletMap | null>(null)
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const gridLayerRef = useRef<L.LayerGroup | null>(null)
  const [hoveredGeohash, setHoveredGeohash] = useState<string>("")
  const [currentView, setCurrentView] = useState<string>("")

  // Draw grid function
  const drawGrid = useCallback(() => {
    if (!gridLayerRef.current || !mapRef.current) return

    gridLayerRef.current.clearLayers()

    // Determine the precision level based on zoom
    const zoom = mapRef.current.getZoom()
    const targetPrecision = Math.min(Math.max(1, Math.floor((zoom + 2) / 3)), 6)

    // Start with the visible bounds
    const mapBounds = mapRef.current.getBounds()
    const viewBounds: [[number, number], [number, number]] = [
      [Math.max(-90, mapBounds.getSouth()), Math.max(-180, mapBounds.getWest())],
      [Math.min(90, mapBounds.getNorth()), Math.min(180, mapBounds.getEast())],
    ]

    // Build grid hierarchy from current view
    const gridCells: GridCell[] = []
    const queue: {bounds: [[number, number], [number, number]]; geohash: string}[] = [
      {
        bounds: [
          [-90, -180],
          [90, 180],
        ],
        geohash: "",
      },
    ]

    // For selected geohashes, we want to show their children too
    const selectedPrefixes = new Set<string>()
    geohashes.forEach((gh) => {
      for (let i = 1; i <= gh.length; i++) {
        selectedPrefixes.add(gh.substring(0, i))
      }
    })

    while (queue.length > 0) {
      const current = queue.shift()!

      // Check if this geohash is exactly selected
      const isExactlySelected = geohashes.includes(current.geohash)
      // Check if any selected geohash starts with this one (this is a parent of selection)
      const isParentOfSelected = geohashes.some(
        (gh) => gh.startsWith(current.geohash) && gh !== current.geohash
      )
      // Check if this starts with any selected geohash (this is a child of selection)
      const isChildOfSelected = geohashes.some(
        (gh) => current.geohash.startsWith(gh) && current.geohash !== gh
      )

      const maxDepth = isExactlySelected
        ? current.geohash.length + 1
        : isParentOfSelected
          ? Math.max(
              ...geohashes
                .filter((gh) => gh.startsWith(current.geohash))
                .map((gh) => gh.length)
            )
          : targetPrecision

      // Add this cell if it's at the right level or is related to selection
      if (
        current.geohash.length === targetPrecision ||
        isExactlySelected ||
        isChildOfSelected ||
        isParentOfSelected
      ) {
        // Check if this cell is visible
        const [[lat1, lng1], [lat2, lng2]] = current.bounds
        if (
          lat2 >= viewBounds[0][0] &&
          lat1 <= viewBounds[1][0] &&
          lng2 >= viewBounds[0][1] &&
          lng1 <= viewBounds[1][1]
        ) {
          gridCells.push({geohash: current.geohash, bounds: current.bounds})
        }
      }

      // Generate children if needed
      if (current.geohash.length < maxDepth) {
        const children = getGeohashGrid(current.bounds, current.geohash)
        for (const child of children) {
          // Only process children that might be visible
          const [[lat1, lng1], [lat2, lng2]] = child.bounds
          if (
            lat2 >= viewBounds[0][0] &&
            lat1 <= viewBounds[1][0] &&
            lng2 >= viewBounds[0][1] &&
            lng1 <= viewBounds[1][1]
          ) {
            queue.push({bounds: child.bounds, geohash: child.geohash})
          }
        }
      }
    }

    // Also add selected geohashes if they're not in the grid
    geohashes.forEach((gh) => {
      if (!gridCells.find((cell) => cell.geohash === gh)) {
        const bounds = decodeGeohash(gh)
        gridCells.push({
          geohash: gh,
          bounds: [
            [bounds[0], bounds[2]],
            [bounds[1], bounds[3]],
          ],
        })
      }
    })

    // Sort grid cells by geohash length (shortest first) so parents are drawn before children
    // This ensures children tiles are on top and clickable
    const sortedCells = [...gridCells].sort((a, b) => a.geohash.length - b.geohash.length)

    // Draw the grid cells
    sortedCells.forEach(({geohash, bounds}) => {
      const isSelected = geohashes.includes(geohash)
      const isHovered = hoveredGeohash === geohash
      const isCurrentView = currentView === geohash
      const isChildOfSelected = geohashes.some(
        (gh) => geohash.startsWith(gh) && geohash !== gh
      )
      const isParentOfSelected = geohashes.some(
        (gh) => gh.startsWith(geohash) && geohash !== gh
      )

      let color = "#4a9eff"
      let weight = 0.5
      let fillOpacity = 0.02

      if (isSelected) {
        color = "#ff7800"
        weight = 3
        fillOpacity = 0.3
      } else if (isChildOfSelected) {
        // Sub-tiles of selected geohash
        color = "#ff7800"
        weight = 1
        fillOpacity = 0.05
      } else if (isParentOfSelected) {
        // Parent tiles - make them visually distinct but clickable
        color = "#ff7800"
        weight = 2
        fillOpacity = 0.1
      } else if (isCurrentView) {
        color = "#00ff00"
        weight = 2
        fillOpacity = 0.2
      }

      if (isHovered) {
        fillOpacity = Math.min(fillOpacity + 0.15, 0.4)
        weight = Math.max(weight, 1.5)
      }

      const rect = L.rectangle(bounds, {
        color,
        weight,
        fillOpacity,
        fillColor: color,
      })

      rect.on("mouseover", () => setHoveredGeohash(geohash))
      rect.on("mouseout", () => setHoveredGeohash(""))
      rect.on("click", (e) => {
        L.DomEvent.stopPropagation(e)
        setCurrentView(geohash)
        if (onGeohashSelect) {
          onGeohashSelect(geohash)
        }
      })

      rect.bindTooltip(geohash, {
        permanent: false,
        direction: "center",
      })

      rect.addTo(gridLayerRef.current!)
      
      // Ensure parent tiles stay behind children
      if (isParentOfSelected) {
        rect.bringToBack()
      }
    })
  }, [geohashes, hoveredGeohash, currentView, onGeohashSelect])

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return

    const map = L.map(mapContainerRef.current, {
      center: [20, 0],
      zoom: 2,
      maxBounds: [
        [90, -180],
        [-90, 180],
      ],
      maxBoundsViscosity: 1.0,
      doubleClickZoom: false,
    })

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://openstreetmap.org">OpenStreetMap</a>',
      maxZoom: 18,
    }).addTo(map)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    L.geoJSON(worldGeoJSON as any, {
      style: {
        fillColor: "#e0e0e0",
        fillOpacity: 0.2,
        color: "#999",
        weight: 1,
      },
    }).addTo(map)

    gridLayerRef.current = L.layerGroup().addTo(map)
    mapRef.current = map

    return () => {
      map.remove()
      mapRef.current = null
      gridLayerRef.current = null
    }
  }, [])

  // Update grid on map changes and state changes
  useEffect(() => {
    if (!mapRef.current || !gridLayerRef.current) return

    drawGrid()

    // Set up event listeners
    const handleUpdate = () => drawGrid()

    mapRef.current.on("moveend", handleUpdate)
    mapRef.current.on("zoomend", handleUpdate)

    return () => {
      if (mapRef.current) {
        mapRef.current.off("moveend", handleUpdate)
        mapRef.current.off("zoomend", handleUpdate)
      }
    }
  }, [drawGrid])

  // Fit bounds only when geohashes actually change (not on every state update)
  useEffect(() => {
    if (!mapRef.current || geohashes.length === 0) return

    const bounds: L.LatLngBoundsExpression = []
    geohashes.forEach((gh) => {
      const [latMin, latMax, lonMin, lonMax] = decodeGeohash(gh)
      bounds.push([latMin, lonMin])
      bounds.push([latMax, lonMax])
    })
    mapRef.current.fitBounds(bounds, {padding: [50, 50]})
  }, [geohashes.join(",")]) // Only trigger when the actual geohash values change

  return <div ref={mapContainerRef} className="w-full overflow-hidden" style={{height}} />
}
