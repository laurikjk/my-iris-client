import {useNavigate} from "@/navigation"
import {SettingsGroupItem} from "@/shared/components/settings/SettingsGroupItem"

interface AccountNameProps {
  name?: string
  link?: boolean
}

export default function AccountName({name = "", link = true}: AccountNameProps) {
  const navigate = useNavigate()
  return (
    <>
      <SettingsGroupItem>
        <div className="flex justify-between items-center">
          <span>Username</span>
          <span className="font-semibold">{name}</span>
        </div>
      </SettingsGroupItem>
      <SettingsGroupItem>
        <div className="flex justify-between items-center">
          <span>Short link</span>
          {link ? (
            <a
              href={`https://iris.to/${name}`}
              onClick={(e) => {
                e.preventDefault()
                navigate(`/${name}`)
              }}
              className="link link-primary"
            >
              iris.to/{name}
            </a>
          ) : (
            <span>iris.to/{name}</span>
          )}
        </div>
      </SettingsGroupItem>
      <SettingsGroupItem isLast>
        <div className="flex justify-between items-center">
          <span>Nostr address</span>
          <span className="font-semibold">{name}@iris.to</span>
        </div>
      </SettingsGroupItem>
    </>
  )
}
