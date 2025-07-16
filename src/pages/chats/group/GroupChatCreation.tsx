import {
  subscribeToDoubleRatchetUsers,
  DoubleRatchetUser,
} from "../utils/doubleRatchetUsers"
import {MemberSelection, GroupDetailsStep} from "./components"
import {useState, useEffect, FormEvent} from "react"
import {GroupDetails} from "./types"
import {useUserStore} from "@/stores/user"
import {useNavigate} from "react-router"
import useHistoryState from "@/shared/hooks/useHistoryState"

const GroupChatCreation = () => {
  const navigate = useNavigate()
  const [currentStep, setCurrentStep] = useState<"members" | "details">("members")
  const [groupDetails, setGroupDetails] = useState<GroupDetails>({
    name: "",
    description: "",
    picture: "",
  })
  const [selectedMembers, setSelectedMembers] = useHistoryState<string[]>(
    [],
    "groupChatMembers"
  )
  const [createError, setCreateError] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const myPubKey = useUserStore((state) => state.publicKey)

  useEffect(() => {
    if (myPubKey) {
      subscribeToDoubleRatchetUsers(myPubKey)
    }
  }, [myPubKey])

  // Handle browser back button
  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      if (event.state?.step === "details") {
        setCurrentStep("details")
      } else {
        setCurrentStep("members")
      }
    }

    window.addEventListener("popstate", handlePopState)
    return () => window.removeEventListener("popstate", handlePopState)
  }, [])

  const handleAddMember = (user: DoubleRatchetUser) => {
    const isAlreadySelected = selectedMembers.includes(user.pubkey)
    if (!isAlreadySelected) {
      setSelectedMembers((prev) => [...prev, user.pubkey])
    }
  }

  const handleRemoveMember = (pubkey: string) => {
    setSelectedMembers((prev) => prev.filter((member) => member !== pubkey))
  }

  const handleNextStep = () => {
    if (selectedMembers.length === 0) {
      setCreateError("Please add at least one member to the group")
      return
    }
    setCreateError(null)
    setCurrentStep("details")
    // Push a new history entry for the details step
    window.history.pushState({step: "details"}, "", window.location.pathname)
  }

  const handleBackToMembers = () => {
    setCurrentStep("members")
    // Go back in history
    window.history.back()
  }

  const handleCreateGroup = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()

    if (!groupDetails.name.trim()) {
      setCreateError("Group name is required")
      return
    }

    if (!myPubKey) {
      setCreateError("You need to be logged in to create a group")
      return
    }

    try {
      setIsCreating(true)
      setCreateError(null)

      // TODO: Implement actual group creation logic
      console.log("Creating group:", {
        ...groupDetails,
        members: selectedMembers,
        creator: myPubKey,
      })

      // Simulate API call delay
      await new Promise((resolve) => setTimeout(resolve, 1000))

      // Navigate to the new group chat
      const groupId = `group_${Date.now()}`
      navigate("/chats/group", {state: {id: groupId}})
    } catch (err) {
      console.error("Error creating group:", err)
      setCreateError("Failed to create group")
    } finally {
      setIsCreating(false)
    }
  }

  if (!myPubKey) {
    return (
      <div className="m-4 p-4 md:p-8 rounded-lg bg-base-100">
        <p className="text-center text-base-content/70">
          Please sign in to create group chats
        </p>
      </div>
    )
  }

  if (currentStep === "members") {
    return (
      <MemberSelection
        selectedMembers={selectedMembers}
        onAddMember={handleAddMember}
        onRemoveMember={handleRemoveMember}
        onNext={handleNextStep}
        error={createError}
        myPubKey={myPubKey}
      />
    )
  }

  return (
    <GroupDetailsStep
      selectedMembers={selectedMembers}
      groupDetails={groupDetails}
      onGroupDetailsChange={setGroupDetails}
      onBack={handleBackToMembers}
      onSubmit={handleCreateGroup}
      error={createError}
      isCreating={isCreating}
      myPubKey={myPubKey}
    />
  )
}

export default GroupChatCreation
