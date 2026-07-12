import { CheckCircle, X } from 'lucide-react'

interface ToastProps {
  message: string | null
  onClose: () => void
}

/** 우측 상단 토스트 알림 */
export function Toast({ message, onClose }: ToastProps) {
  if (!message) return null
  return (
    <div className="fixed top-5 right-5 z-50 flex items-center gap-3 bg-white rounded-2xl shadow-xl border border-border px-5 py-3.5 max-w-[90vw]">
      <CheckCircle className="w-4 h-4 text-primary shrink-0" />
      <span className="text-sm text-foreground">{message}</span>
      <button onClick={onClose} className="ml-1">
        <X className="w-4 h-4 text-muted-foreground hover:text-foreground transition-colors" />
      </button>
    </div>
  )
}
