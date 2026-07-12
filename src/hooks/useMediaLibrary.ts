import { useCallback, useEffect, useState } from 'react'
import { deleteFile, listFiles, type MediaFile } from '../lib'

/** R2 파일 목록 로딩 + 삭제 관리 */
export function useMediaLibrary() {
  const [files, setFiles] = useState<MediaFile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      setError(null)
      setFiles(await listFiles())
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const removeOne = useCallback(
    async (key: string) => {
      await deleteFile(key)
      await refresh()
    },
    [refresh],
  )

  const removeMany = useCallback(
    async (keys: string[]) => {
      await Promise.all(keys.map((k) => deleteFile(k)))
      await refresh()
    },
    [refresh],
  )

  return { files, loading, error, refresh, removeOne, removeMany }
}
