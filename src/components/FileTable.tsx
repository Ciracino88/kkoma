import { AlertCircle, FolderOpen, Loader2 } from 'lucide-react'
import type { MediaFile } from '../lib'
import { FileRow } from './FileRow'

interface FileTableProps {
  loading: boolean
  error: string | null
  files: MediaFile[]
  totalCount: number
  selectedKeys: Set<string>
  playingKey: string | null
  onToggleSelect: (key: string) => void
  onTogglePlay: (key: string) => void
  onDelete: (file: MediaFile) => void
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center bg-white rounded-2xl border border-border">
      {children}
    </div>
  )
}

/** 파일 목록 테이블 (로딩/에러/빈 상태 포함) */
export function FileTable({
  loading,
  error,
  files,
  totalCount,
  selectedKeys,
  playingKey,
  onToggleSelect,
  onTogglePlay,
  onDelete,
}: FileTableProps) {
  if (loading) {
    return (
      <EmptyState>
        <Loader2 className="w-8 h-8 text-primary mb-4 animate-spin" />
        <p className="text-muted-foreground text-sm">불러오는 중…</p>
      </EmptyState>
    )
  }

  if (error) {
    return (
      <EmptyState>
        <AlertCircle className="w-10 h-10 text-red-400 mb-4" />
        <p className="text-red-500 text-sm">{error}</p>
      </EmptyState>
    )
  }

  if (files.length === 0) {
    return (
      <EmptyState>
        <FolderOpen className="w-12 h-12 text-muted-foreground mb-4" />
        <p className="text-muted-foreground text-sm">
          {totalCount === 0 ? '아직 업로드된 파일이 없습니다' : '검색 결과가 없습니다'}
        </p>
      </EmptyState>
    )
  }

  return (
    <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
      {/* Header row */}
      <div className="hidden sm:grid grid-cols-[auto_1fr_auto_auto_auto] gap-4 items-center px-5 py-3 text-xs text-muted-foreground font-semibold uppercase tracking-widest border-b border-border bg-secondary/40">
        <span className="w-4" />
        <span>파일명</span>
        <span className="w-16 text-right">크기</span>
        <span className="w-32 text-right hidden lg:block">업로드</span>
        <span className="w-20 text-right">액션</span>
      </div>

      <div className="divide-y divide-border">
        {files.map((file) => (
          <FileRow
            key={file.key}
            file={file}
            isSelected={selectedKeys.has(file.key)}
            isPlaying={playingKey === file.key}
            onToggleSelect={() => onToggleSelect(file.key)}
            onTogglePlay={() => onTogglePlay(file.key)}
            onDelete={() => onDelete(file)}
          />
        ))}
      </div>
    </div>
  )
}
