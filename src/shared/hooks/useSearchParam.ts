import {useSearchParams} from "react-router"

export default function useSearchParam(param: string, defaultValue: string) {
  const [searchParams] = useSearchParams()
  return searchParams.get(param) ?? defaultValue
}
