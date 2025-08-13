import {useContext} from "react"
import {ScrollContext} from "./ScrollContextValue"

export const useScrollContainer = () => {
  const ref = useContext(ScrollContext)
  return ref?.current || null
}
