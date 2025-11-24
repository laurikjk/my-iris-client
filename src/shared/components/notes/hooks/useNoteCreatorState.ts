import {useReducer, Dispatch} from "react"
import {ImetaTag} from "@/stores/draft"
import {KIND_TEXT_NOTE} from "@/utils/constants"

export interface NoteCreatorState {
  text: string
  imeta: ImetaTag[]
  eventKind: number
  price: {
    amount: string
    currency: string
    frequency?: string
  }
  title: string
  expirationDelta: number | null
}

export type NoteCreatorAction =
  | {type: "SET_TEXT"; payload: string}
  | {type: "SET_IMETA"; payload: ImetaTag[]}
  | {type: "ADD_IMETA"; payload: ImetaTag}
  | {type: "SET_EVENT_KIND"; payload: number}
  | {type: "SET_PRICE"; payload: NoteCreatorState["price"]}
  | {type: "SET_TITLE"; payload: string}
  | {type: "SET_EXPIRATION_DELTA"; payload: number | null}
  | {type: "RESET"}
  | {type: "LOAD_DRAFT"; payload: Partial<NoteCreatorState>}

const initialState: NoteCreatorState = {
  text: "",
  imeta: [],
  eventKind: KIND_TEXT_NOTE,
  price: {amount: "", currency: "USD", frequency: ""},
  title: "",
  expirationDelta: null,
}

function noteCreatorReducer(
  state: NoteCreatorState,
  action: NoteCreatorAction
): NoteCreatorState {
  switch (action.type) {
    case "SET_TEXT":
      return {...state, text: action.payload}
    case "SET_IMETA":
      return {...state, imeta: action.payload}
    case "ADD_IMETA":
      return {...state, imeta: [...state.imeta, action.payload]}
    case "SET_EVENT_KIND":
      return {...state, eventKind: action.payload}
    case "SET_PRICE":
      return {...state, price: action.payload}
    case "SET_TITLE":
      return {...state, title: action.payload}
    case "SET_EXPIRATION_DELTA":
      return {...state, expirationDelta: action.payload}
    case "RESET":
      return initialState
    case "LOAD_DRAFT":
      return {...state, ...action.payload}
    default:
      return state
  }
}

export function useNoteCreatorState(
  initialOverrides?: Partial<NoteCreatorState>
): [NoteCreatorState, Dispatch<NoteCreatorAction>] {
  return useReducer(noteCreatorReducer, {...initialState, ...initialOverrides})
}
