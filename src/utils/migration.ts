import {useUserStore} from "../stores/user"

export const migrateUserState = () => {
  const migrateFromLocalStorage = <T>(key: string, defaultValue: T): T => {
    try {
      const storedValue = localStorage.getItem(`localState/${key}`)
      if (storedValue) {
        try {
          const parsedValue = JSON.parse(storedValue)
          const extractedValue =
            parsedValue && typeof parsedValue === "object" && "value" in parsedValue
              ? parsedValue.value
              : parsedValue

          console.log(`Migrated ${key} from localStorage:`, extractedValue)
          localStorage.removeItem(`localState/${key}`)
          return extractedValue
        } catch (error) {
          console.error(`Error parsing ${key} from localStorage:`, error)
        }
      }
    } catch (error) {
      console.error(`Error migrating ${key} from localStorage:`, error)
    }
    return defaultValue
  }

  const state = useUserStore.getState()
  state.setPublicKey(migrateFromLocalStorage("user/publicKey", state.publicKey))
  state.setPrivateKey(migrateFromLocalStorage("user/privateKey", state.privateKey))
  state.setNip07Login(migrateFromLocalStorage("user/nip07Login", state.nip07Login))
}
