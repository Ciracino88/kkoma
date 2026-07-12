import { useCallback, useRef, useState } from 'react'

/** 우측 상단 토스트 알림 상태 관리 */
export function useToast(timeout = 3500) {
  const [message, setMessage] = useState<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const show = useCallback(
    (msg: string) => {
      setMessage(msg)
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => setMessage(null), timeout)
    },
    [timeout],
  )

  const clear = useCallback(() => {
    if (timer.current) clearTimeout(timer.current)
    setMessage(null)
  }, [])

  return { message, show, clear }
}
