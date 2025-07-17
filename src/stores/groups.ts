import {createJSONStorage, persist} from "zustand/middleware"
import localforage from "localforage"
import {create} from "zustand"

export interface Group {
  id: string
  name: string
  description: string
  picture: string
  members: string[]
  createdAt: number
}

interface GroupsStore {
  groups: Record<string, Group>
  addGroup: (group: Group) => void
  removeGroup: (groupId: string) => void
  updateGroup: (groupId: string, data: Partial<Group>) => void
}

const store = create<GroupsStore>()(
  persist(
    (set) => ({
      groups: {},
      addGroup: (group) =>
        set((state) => ({
          groups: {
            ...state.groups,
            [group.id]: group,
          },
        })),
      removeGroup: (groupId) =>
        set((state) => {
          const rest = {...state.groups}
          delete rest[groupId]
          return {groups: rest}
        }),
      updateGroup: (groupId, data) =>
        set((state) => ({
          groups: {
            ...state.groups,
            [groupId]: {
              ...state.groups[groupId],
              ...data,
            },
          },
        })),
    }),
    {
      name: "groups",
      storage: createJSONStorage(() => localforage),
    }
  )
)

export const useGroupsStore = store
