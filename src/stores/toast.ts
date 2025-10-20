import {create} from "zustand"

export type ToastType = "success" | "error" | "info" | "warning"

export interface Toast {
  id: string
  message: string
  type: ToastType
  duration?: number
  linkTo?: string
  timestamp?: number
}

interface ToastState {
  toasts: Toast[]
  dismissedToasts: Toast[]
  addToast: (message: string, type: ToastType, duration?: number, linkTo?: string) => void
  removeToast: (id: string) => void
  clearDismissed: () => void
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  dismissedToasts: [],

  addToast: (message: string, type: ToastType, duration = 5000, linkTo?: string) => {
    const id = `${Date.now()}-${Math.random()}`
    const toast: Toast = {id, message, type, duration, linkTo, timestamp: Date.now()}

    set((state) => ({
      toasts: [...state.toasts, toast],
    }))

    if (duration > 0) {
      setTimeout(() => {
        set((state) => {
          const dismissedToast = state.toasts.find((t) => t.id === id)
          return {
            toasts: state.toasts.filter((t) => t.id !== id),
            dismissedToasts: dismissedToast
              ? [dismissedToast, ...state.dismissedToasts]
              : state.dismissedToasts,
          }
        })
      }, duration)
    }
  },

  removeToast: (id: string) => {
    set((state) => {
      const dismissedToast = state.toasts.find((t) => t.id === id)
      return {
        toasts: state.toasts.filter((t) => t.id !== id),
        dismissedToasts: dismissedToast
          ? [dismissedToast, ...state.dismissedToasts]
          : state.dismissedToasts,
      }
    })
  },

  clearDismissed: () => {
    set({dismissedToasts: []})
  },
}))
