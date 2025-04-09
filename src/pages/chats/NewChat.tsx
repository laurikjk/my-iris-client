import NotificationPrompt from "@/shared/components/NotificationPrompt"
import InstallPWAPrompt from "@/shared/components/InstallPWAPrompt"
import PrivateChatCreation from "./PrivateChatCreation"
import Header from "@/shared/components/header/Header"
import PublicChatCreation from "./PublicChatCreation"
import {useState} from "react"

type TabType = "private" | "public"

const TabSelector = ({
  activeTab,
  onSelect,
}: {
  activeTab: TabType
  onSelect: (tab: TabType) => void
}) => {
  const getClasses = (tabType: TabType) => {
    const baseClasses = "border-highlight cursor-pointer flex justify-center flex-1 p-3"
    return activeTab === tabType
      ? `${baseClasses} border-b border-1`
      : `${baseClasses} text-base-content/70 hover:text-base-content border-b border-1 border-transparent`
  }

  return (
    <div className="flex mb-px md:mb-1">
      <div className={getClasses("private")} onClick={() => onSelect("private")}>
        Private
      </div>
      <div className={getClasses("public")} onClick={() => onSelect("public")}>
        Public
      </div>
    </div>
  )
}

const NewChat = () => {
  const [activeTab, setActiveTab] = useState<TabType>("private")

  return (
    <>
      <Header title="New Chat" />
      <NotificationPrompt />
      <TabSelector activeTab={activeTab} onSelect={setActiveTab} />
      {activeTab === "private" ? <PrivateChatCreation /> : <PublicChatCreation />}
      <InstallPWAPrompt />
    </>
  )
}

export default NewChat
