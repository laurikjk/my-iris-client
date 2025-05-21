import React, {FormEvent, useState} from "react"
import {SubscriberBadge} from "@/shared/components/user/SubscriberBadge"
import {useUserStore} from "@/stores/user"
import AccountName from "./AccountName"
import {Link} from "react-router"

interface RegisterFormProps {
  minLength: number
  subscriptionPlan: string | null
  onRegister: (username: string) => void
}

function RegisterForm({minLength, subscriptionPlan, onRegister}: RegisterFormProps) {
  const [username, setUsername] = useState("")
  const [isValid, setIsValid] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const pubKey = useUserStore.getState().publicKey

  const handleInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value
    setUsername(name)

    if (!name) {
      setIsValid(false)
      setErrorMessage("")
      return
    }

    // Length check
    if (name.length < minLength || name.length > 15) {
      setIsValid(false)
      setErrorMessage(`Name must be between ${minLength} and 15 characters`)
      return
    }

    // Format check
    if (!name.match(/^[a-z0-9_.]+$/)) {
      setIsValid(false)
      setErrorMessage("Username must only contain lowercase letters and numbers")
      return
    }

    setErrorMessage("")
    checkAvailability(name)
  }

  const checkAvailability = async (name: string) => {
    const url = `${CONFIG.defaultSettings.irisApiUrl}/user/available?name=${encodeURIComponent(name)}&public_key=${pubKey}`
    const res = await fetch(url)

    if (name !== username) return

    if (res.status < 500) {
      const json = await res.json()
      setIsValid(json.available)
      if (!json.available) setErrorMessage(json.message)
    } else {
      setIsValid(false)
      setErrorMessage("Error checking username availability")
    }
  }

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (isValid) onRegister(username)
  }

  return (
    <div>
      <SubscriberBadge className="mt-2" pubkey={pubKey} />
      <p>Register an Iris username (iris.to/username)</p>

      <div className="flex flex-row justify-between items-center mb-2">
        <div>
          Current subscription: {subscriptionPlan || "None"}
          (Min length: {minLength})
        </div>
      </div>

      <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
        <div className="flex flex-row gap-4">
          <input
            className="input input-bordered"
            type="text"
            placeholder="Username"
            value={username}
            onInput={handleInputChange}
          />
          <button className="btn btn-primary" type="submit">
            Register
          </button>
        </div>

        <div>
          {isValid ? (
            <>
              <span className="success">Username is available</span>
              <AccountName name={username} link={false} />
            </>
          ) : (
            <span className="error">{errorMessage}</span>
          )}

          {errorMessage && errorMessage.includes("must be at least") && (
            <div className="mt-2">
              <Link to="/settings/subscription" className="text-primary">
                Get a subscription to choose shorter usernames
              </Link>
            </div>
          )}
        </div>
      </form>
    </div>
  )
}

export default RegisterForm
