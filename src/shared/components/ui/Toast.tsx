import {useToastStore, type Toast as ToastType} from "@/stores/toast"
import {RiCloseLine} from "@remixicon/react"
import {Link} from "@/navigation"

export default function Toast() {
  const {toasts, removeToast} = useToastStore()

  if (toasts.length === 0) return null

  const getAlertClass = (type: string) => {
    switch (type) {
      case "success":
        return "alert-success"
      case "error":
        return "alert-error"
      case "warning":
        return "alert-warning"
      case "info":
      default:
        return "alert-info"
    }
  }

  const renderToastContent = (toast: ToastType) => {
    if ("linkTo" in toast && toast.linkTo) {
      return (
        <Link
          to={toast.linkTo}
          className="flex-1 hover:underline cursor-pointer min-w-0 break-words"
          onClick={() => removeToast(toast.id)}
        >
          {toast.message}
        </Link>
      )
    }
    return <span className="flex-1 min-w-0 break-words">{toast.message}</span>
  }

  return (
    <div className="fixed top-[calc(4rem+env(safe-area-inset-top)+0.5rem)] md:top-[4.5rem] left-0 right-0 z-[9999] flex flex-col items-center gap-2 px-4 pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`alert ${getAlertClass(toast.type)} shadow-lg flex items-center gap-2 w-full max-w-md overflow-hidden pointer-events-auto`}
        >
          {renderToastContent(toast)}
          <button
            onClick={() => removeToast(toast.id)}
            className="btn btn-ghost btn-sm btn-circle flex-shrink-0"
          >
            <RiCloseLine className="w-5 h-5" />
          </button>
        </div>
      ))}
    </div>
  )
}
