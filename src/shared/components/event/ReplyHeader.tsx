import {RiReplyLine} from "@remixicon/react"

function ReplyHeader() {
  return (
    <div className="flex items-center font-bold text-sm text-base-content/50">
      <RiReplyLine className="w-4 h-4 mr-1" />
      <span>Reply</span>
    </div>
  )
}

export default ReplyHeader
