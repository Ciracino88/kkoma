import { useCallback, useState } from 'react'
import { isAllowedFile, uploadFile } from '../lib'

export interface Upload {
  id: string
  name: string
  video: boolean
  progress: number
  error?: string
}

interface StartHandlers {
  onComplete?: (name: string) => void
  onReject?: (name: string) => void
}

/** presigned 직접 업로드 진행 상태 관리 */
export function useUploads() {
  const [uploads, setUploads] = useState<Upload[]>([])

  const start = useCallback(
    (fileList: FileList | File[], handlers: StartHandlers = {}) => {
      Array.from(fileList).forEach((file) => {
        if (!isAllowedFile(file)) {
          handlers.onReject?.(file.name)
          return
        }
        const id = crypto.randomUUID()
        const video = /\.mp4$/i.test(file.name)
        setUploads((prev) => [...prev, { id, name: file.name, video, progress: 0 }])

        void uploadFile(file, (frac) => {
          setUploads((prev) =>
            prev.map((u) => (u.id === id ? { ...u, progress: frac * 100 } : u)),
          )
        })
          .then(() => {
            setUploads((prev) => prev.filter((u) => u.id !== id))
            handlers.onComplete?.(file.name)
          })
          .catch((e: unknown) => {
            const msg = e instanceof Error ? e.message : String(e)
            setUploads((prev) => prev.map((u) => (u.id === id ? { ...u, error: msg } : u)))
          })
      })
    },
    [],
  )

  return { uploads, start }
}
