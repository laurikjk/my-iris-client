import {ReactNode} from "react"
import {
  RiChat1Fill,
  RiHeartFill,
  RiRepeatFill,
  RiFlashlightFill,
  RiArticleFill,
  RiStoreFill,
  RiUserFollowFill,
  RiMailFill,
  RiDeleteBinFill,
  RiFileListFill,
  RiPushpinFill,
  RiServerFill,
  RiBookmarkFill,
  RiImageFill,
} from "@remixicon/react"
import {
  KIND_TEXT_NOTE,
  KIND_REPOST,
  KIND_REACTION,
  KIND_ZAP_RECEIPT,
  KIND_LONG_FORM_CONTENT,
  KIND_CHANNEL_MESSAGE,
  KIND_CLASSIFIED,
  KIND_PICTURE_FIRST,
  KIND_EPHEMERAL,
} from "@/utils/constants"

export interface EventKindInfo {
  label: string
  description?: string
  icon?: ReactNode
  iconLarge?: ReactNode
  color?: string
}

export const EVENT_KIND_INFO: Record<number, EventKindInfo> = {
  [KIND_TEXT_NOTE]: {
    label: "Post",
    description: "Text notes",
    icon: <RiChat1Fill className="w-3 h-3" />,
    iconLarge: <RiChat1Fill className="w-4 h-4" />,
    color: "text-blue-500",
  },
  [KIND_REPOST]: {
    label: "Repost",
    description: "Reposts",
    icon: <RiRepeatFill className="w-3 h-3" />,
    iconLarge: <RiRepeatFill className="w-4 h-4" />,
    color: "text-green-500",
  },
  [KIND_REACTION]: {
    label: "Like",
    description: "Reactions",
    icon: <RiHeartFill className="w-3 h-3" />,
    iconLarge: <RiHeartFill className="w-4 h-4" />,
    color: "text-pink-500",
  },
  [KIND_ZAP_RECEIPT]: {
    label: "Zap",
    description: "Lightning zaps",
    icon: <RiFlashlightFill className="w-3 h-3" />,
    iconLarge: <RiFlashlightFill className="w-4 h-4" />,
    color: "text-yellow-500",
  },
  [KIND_LONG_FORM_CONTENT]: {
    label: "Article",
    description: "Long-form content",
    icon: <RiArticleFill className="w-3 h-3" />,
    iconLarge: <RiArticleFill className="w-4 h-4" />,
    color: "text-purple-500",
  },
  [KIND_CHANNEL_MESSAGE]: {
    label: "Chat",
    description: "Channel messages",
    icon: <RiChat1Fill className="w-3 h-3" />,
    iconLarge: <RiChat1Fill className="w-4 h-4" />,
    color: "text-cyan-500",
  },
  [KIND_CLASSIFIED]: {
    label: "Market",
    description: "Classified listings",
    icon: <RiStoreFill className="w-3 h-3" />,
    iconLarge: <RiStoreFill className="w-4 h-4" />,
    color: "text-orange-500",
  },
  [KIND_PICTURE_FIRST]: {
    label: "Picture",
    description: "Picture-first posts",
    icon: <RiImageFill className="w-3 h-3" />,
    iconLarge: <RiImageFill className="w-4 h-4" />,
    color: "text-blue-600",
  },
  3: {
    label: "Follows",
    icon: <RiUserFollowFill className="w-3 h-3" />,
    color: "text-indigo-500",
  },
  4: {
    label: "DM",
    icon: <RiMailFill className="w-3 h-3" />,
    color: "text-violet-500",
  },
  1059: {
    label: "DM Request",
    icon: <RiMailFill className="w-3 h-3" />,
    color: "text-violet-400",
  },
  1060: {
    label: "DM",
    icon: <RiMailFill className="w-3 h-3" />,
    color: "text-violet-500",
  },
  5: {
    label: "Delete",
    icon: <RiDeleteBinFill className="w-3 h-3" />,
    color: "text-red-500",
  },
  10000: {
    label: "Mute List",
    icon: <RiFileListFill className="w-3 h-3" />,
    color: "text-gray-500",
  },
  10001: {
    label: "Pin List",
    icon: <RiPushpinFill className="w-3 h-3" />,
    color: "text-amber-500",
  },
  10002: {
    label: "Relay List",
    icon: <RiServerFill className="w-3 h-3" />,
    color: "text-teal-500",
  },
  30001: {
    label: "Bookmark",
    icon: <RiBookmarkFill className="w-3 h-3" />,
    color: "text-rose-500",
  },
  [KIND_EPHEMERAL]: {
    label: "Ephemeral",
    description: "Ephemeral events",
    color: "text-gray-400",
  },
}

export function getEventKindInfo(kind: number): EventKindInfo {
  return EVENT_KIND_INFO[kind] || {label: kind.toString()}
}

// Common event kinds for selector UI
export const COMMON_EVENT_KINDS = [
  KIND_TEXT_NOTE,
  KIND_REPOST,
  KIND_REACTION,
  KIND_ZAP_RECEIPT,
  KIND_LONG_FORM_CONTENT,
  KIND_CHANNEL_MESSAGE,
  KIND_CLASSIFIED,
  KIND_PICTURE_FIRST,
]
