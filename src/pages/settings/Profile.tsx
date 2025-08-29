import {SettingsGroup} from "@/shared/components/settings/SettingsGroup"
import {SettingsGroupItem} from "@/shared/components/settings/SettingsGroupItem"
import {SettingsInputItem} from "@/shared/components/settings/SettingsInputItem"
import {SettingsButton} from "@/shared/components/settings/SettingsButton"
import {Avatar} from "@/shared/components/user/Avatar"
import {Name} from "@/shared/components/user/Name"
import {useFileUpload} from "@/shared/hooks/useFileUpload"
import useProfile from "@/shared/hooks/useProfile"
import {useEffect, useMemo, useState} from "react"
import {NDKUserProfile} from "@nostr-dev-kit/ndk"
import {useUserStore} from "@/stores/user"
import {useNavigate} from "@/navigation"
import {ndk} from "@/utils/ndk"
import ProxyImg from "@/shared/components/ProxyImg"

export function ProfileSettings() {
  const [publicKeyState, setPublicKeyState] = useState("")
  const myPubKey = useUserStore((state) => state.publicKey)
  const navigate = useNavigate()

  const profileUpload = useFileUpload({
    onUpload: (url: string) => setProfileField("picture", url),
    accept: "image/*",
  })

  const bannerUpload = useFileUpload({
    onUpload: (url: string) => setProfileField("banner", url),
    accept: "image/*",
  })

  useEffect(() => {
    if (myPubKey) {
      setPublicKeyState(myPubKey)
    }
  }, [myPubKey])

  const existingProfile = useProfile(publicKeyState)

  const user = useMemo(() => {
    if (!myPubKey) {
      return null
    }
    return ndk().getUser({pubkey: myPubKey})
  }, [myPubKey])

  const [newProfile, setNewProfile] = useState<NDKUserProfile>(user?.profile || {})

  useEffect(() => {
    if (existingProfile) {
      setNewProfile(existingProfile)
    }
  }, [existingProfile])

  function setProfileField(field: keyof NDKUserProfile, value: string) {
    setNewProfile((prev) => {
      return {
        ...prev,
        [field]: value,
      }
    })
  }

  function onSaveProfile() {
    if (!user || !newProfile) {
      return
    }
    user.profile = newProfile
    user.publish()
  }

  const isEdited = useMemo(() => {
    if (!newProfile) {
      return false
    }
    return JSON.stringify(newProfile) !== JSON.stringify(existingProfile)
  }, [newProfile, existingProfile])

  const getUploadButtonLabel = (upload: typeof profileUpload, defaultLabel: string) => {
    if (upload.uploading) {
      return `Uploading... ${upload.progress}%`
    }
    if (upload.error) {
      return `Upload failed: ${upload.error}`
    }
    return defaultLabel
  }

  if (!myPubKey) {
    return null
  }

  return (
    <div className="bg-base-200 min-h-full">
      <div className="p-4">
        <div className="flex flex-col items-center mb-6">
          <div className="mb-4">
            <Avatar
              width={128}
              pubKey={myPubKey || ""}
              showBadge={false}
              showTooltip={false}
            />
          </div>
          <div className="text-center">
            <h2 className="text-2xl font-semibold">
              <Name pubKey={myPubKey} />
            </h2>
            {(newProfile?.nip05 || existingProfile?.nip05) && (
              <p className="text-base-content/70 text-sm">
                {newProfile?.nip05 || existingProfile?.nip05}
              </p>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <SettingsGroup>
            <SettingsButton
              label="Save Changes"
              onClick={onSaveProfile}
              disabled={!isEdited}
              isLast
            />
          </SettingsGroup>

          <SettingsGroup title="Personal Information">
            <SettingsInputItem
              label="Name"
              value={String(newProfile?.display_name || "")}
              placeholder="Your name"
              onChange={(value) => setProfileField("display_name", value)}
            />

            <SettingsGroupItem>
              <div className="flex flex-col space-y-2">
                <label className="text-base font-normal">About</label>
                <textarea
                  placeholder="About yourself"
                  className="bg-transparent border-none p-0 text-base focus:outline-none placeholder:text-base-content/40 resize-none min-h-[4em] w-full"
                  value={newProfile?.about || ""}
                  onChange={(e) => setProfileField("about", e.target.value)}
                />
              </div>
            </SettingsGroupItem>

            <SettingsInputItem
              label="Website"
              value={newProfile?.website || ""}
              placeholder="https://example.com"
              onChange={(value) => setProfileField("website", value)}
              type="url"
              isLast
            />
          </SettingsGroup>

          <SettingsGroup title="Profile Picture">
            <SettingsInputItem
              label="Image URL"
              value={newProfile?.picture || ""}
              placeholder="https://example.com/image.jpg"
              onChange={(value) => setProfileField("picture", value)}
              type="url"
            />

            {newProfile?.picture && (
              <SettingsGroupItem>
                <div className="w-10 h-10 rounded-full overflow-hidden">
                  <ProxyImg
                    src={newProfile.picture}
                    alt="Profile preview"
                    className="w-full h-full object-cover"
                    width={40}
                    square={true}
                  />
                </div>
              </SettingsGroupItem>
            )}

            <SettingsButton
              label={getUploadButtonLabel(profileUpload, "Upload Profile Picture")}
              onClick={profileUpload.triggerUpload}
              disabled={profileUpload.uploading}
              variant={profileUpload.error ? "destructive" : "default"}
              isLast
            />
          </SettingsGroup>

          <SettingsGroup title="Banner Image">
            <SettingsInputItem
              label="Image URL"
              value={newProfile?.banner || ""}
              placeholder="https://example.com/banner.jpg"
              onChange={(value) => setProfileField("banner", value)}
              type="url"
            />

            {newProfile?.banner && (
              <SettingsGroupItem>
                <div className="w-16 h-8 rounded overflow-hidden">
                  <ProxyImg
                    src={newProfile.banner}
                    alt="Banner preview"
                    className="w-full h-full object-cover"
                    width={64}
                  />
                </div>
              </SettingsGroupItem>
            )}

            <SettingsButton
              label={getUploadButtonLabel(bannerUpload, "Upload Banner Image")}
              onClick={bannerUpload.triggerUpload}
              disabled={bannerUpload.uploading}
              variant={bannerUpload.error ? "destructive" : "default"}
              isLast
            />
          </SettingsGroup>

          <SettingsGroup title="Verification & Payment">
            <SettingsInputItem
              label="Lightning Address"
              value={newProfile?.lud16 || ""}
              placeholder="user@wallet.com"
              onChange={(value) => setProfileField("lud16", value)}
              type="email"
            />

            <SettingsInputItem
              label="user@domain verification (NIP-05)"
              value={newProfile?.nip05 || ""}
              placeholder="user@example.com"
              onChange={(value) => setProfileField("nip05", value)}
              type="email"
            />

            <SettingsButton
              label="Get free username @ iris.to"
              onClick={() => navigate("/settings/iris")}
              isLast
            />
          </SettingsGroup>
        </div>
      </div>
    </div>
  )
}
