import {createContext, Dispatch, SetStateAction} from "react"

export const PublicChatContext = createContext<{
  setPublicChatTimestamps: Dispatch<SetStateAction<Record<string, number>>> | null
}>({setPublicChatTimestamps: null})
