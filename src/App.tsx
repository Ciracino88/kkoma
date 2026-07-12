import { useCallback, useMemo, useRef, useState } from 'react'
import { isVideo, type MediaFile } from './lib'
import { useMediaLibrary } from './hooks/useMediaLibrary'
import { useUploads } from './hooks/useUploads'
import { useToast } from './hooks/useToast'
import type { Filter } from './components/shared'
import { DragOverlay } from './components/DragOverlay'
import { Toast } from './components/Toast'
import { Header } from './components/Header'
import { StatCards } from './components/StatCards'
import { UploadDropzone } from './components/UploadDropzone'
import { UploadList } from './components/UploadList'
import { Toolbar } from './components/Toolbar'
import { FileTable } from './components/FileTable'

export default function App() {
  const { files, loading, error, refresh, removeOne, removeMany } = useMediaLibrary()
  const { uploads, start } = useUploads()
  const toast = useToast()

  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [isDragging, setIsDragging] = useState(false)
  const [playingKey, setPlayingKey] = useState<string | null>(null)
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set())
  const fileInputRef = useRef<HTMLInputElement>(null)

  const openPicker = useCallback(() => fileInputRef.current?.click(), [])

  const handleFiles = useCallback(
    (fileList: FileList | File[]) => {
      start(fileList, {
        onComplete: (name) => {
          toast.show(`"${name}" 업로드 완료`)
          void refresh()
        },
        onReject: (name) => toast.show(`"${name}" — MP3 또는 MP4 파일만 업로드 가능합니다`),
      })
    },
    [start, refresh, toast],
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
      if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files)
    },
    [handleFiles],
  )

  const toggleSelect = useCallback((key: string) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }, [])

  const togglePlay = useCallback((key: string) => {
    setPlayingKey((cur) => (cur === key ? null : key))
  }, [])

  const deleteOne = useCallback(
    async (file: MediaFile) => {
      try {
        await removeOne(file.key)
        setPlayingKey((cur) => (cur === file.key ? null : cur))
        setSelectedKeys((prev) => {
          const next = new Set(prev)
          next.delete(file.key)
          return next
        })
        toast.show(`"${file.name}" 삭제됨`)
      } catch (e) {
        toast.show(e instanceof Error ? e.message : String(e))
      }
    },
    [removeOne, toast],
  )

  const deleteSelected = useCallback(async () => {
    const keys = [...selectedKeys]
    try {
      await removeMany(keys)
      toast.show(`${keys.length}개 파일 삭제됨`)
      setSelectedKeys(new Set())
      setPlayingKey((cur) => (cur && keys.includes(cur) ? null : cur))
    } catch (e) {
      toast.show(e instanceof Error ? e.message : String(e))
    }
  }, [selectedKeys, removeMany, toast])

  const totalStorage = useMemo(() => files.reduce((sum, f) => sum + f.size, 0), [files])
  const mp3Count = useMemo(() => files.filter((f) => !isVideo(f)).length, [files])
  const mp4Count = files.length - mp3Count

  const filtered = useMemo(
    () =>
      files.filter((f) => {
        const matchSearch = f.name.toLowerCase().includes(search.toLowerCase())
        const matchFilter =
          filter === 'all' || (filter === 'mp4' ? isVideo(f) : !isVideo(f))
        return matchSearch && matchFilter
      }),
    [files, search, filter],
  )

  return (
    <div
      className="min-h-screen bg-background text-foreground"
      style={{ fontFamily: "'Inter', sans-serif" }}
      onDragOver={(e) => {
        e.preventDefault()
        setIsDragging(true)
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) setIsDragging(false)
      }}
      onDrop={handleDrop}
    >
      <DragOverlay visible={isDragging} />
      <Toast message={toast.message} onClose={toast.clear} />
      <Header storageUsed={totalStorage} onUpload={openPicker} />

      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept=".mp3,.mp4,audio/mpeg,video/mp4"
        multiple
        onChange={(e) => {
          if (e.target.files?.length) handleFiles(e.target.files)
          e.target.value = ''
        }}
      />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <StatCards total={files.length} mp3={mp3Count} mp4={mp4Count} />
        <UploadDropzone onOpen={openPicker} />
        <UploadList uploads={uploads} />
        <Toolbar
          search={search}
          onSearch={setSearch}
          filter={filter}
          onFilter={setFilter}
          onRefresh={() => void refresh()}
          selectedCount={selectedKeys.size}
          onDeleteSelected={() => void deleteSelected()}
        />
        <FileTable
          loading={loading}
          error={error}
          files={filtered}
          totalCount={files.length}
          selectedKeys={selectedKeys}
          playingKey={playingKey}
          onToggleSelect={toggleSelect}
          onTogglePlay={togglePlay}
          onDelete={(file) => void deleteOne(file)}
        />
      </main>
    </div>
  )
}
