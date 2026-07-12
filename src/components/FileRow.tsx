import { Download, Music, Pause, Play, Trash2, Video } from 'lucide-react'
import { fileUrl, formatBytes, formatDate, isVideo, type MediaFile } from '../lib'
import { MONO } from './shared'

interface FileRowProps {
  file: MediaFile
  isSelected: boolean
  isPlaying: boolean
  onToggleSelect: () => void
  onTogglePlay: () => void
  onDelete: () => void
}

/** 파일 한 줄: 선택 · 이름 · 크기 · 날짜 · 액션 + 인라인 플레이어 */
export function FileRow({
  file,
  isSelected,
  isPlaying,
  onToggleSelect,
  onTogglePlay,
  onDelete,
}: FileRowProps) {
  const video = isVideo(file)

  return (
    <div className={isSelected ? 'bg-primary/5' : 'hover:bg-secondary/40 transition-colors'}>
      <div className="group sm:grid sm:grid-cols-[auto_1fr_auto_auto_auto] gap-4 items-center px-5 py-3.5 flex justify-between">
        {/* Checkbox */}
        <div onClick={onToggleSelect} className="cursor-pointer">
          <div
            className={`w-4 h-4 rounded-md border-2 flex items-center justify-center transition-all ${
              isSelected ? 'bg-primary border-primary' : 'border-border group-hover:border-primary/40'
            }`}
          >
            {isSelected && <div className="w-1.5 h-1.5 bg-white rounded-sm" />}
          </div>
        </div>

        {/* Name */}
        <div className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer" onClick={onTogglePlay}>
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
              video ? 'bg-blue-50' : 'bg-emerald-50'
            }`}
          >
            {video ? (
              <Video className="w-4 h-4 text-blue-500" />
            ) : (
              <Music className="w-4 h-4 text-emerald-500" />
            )}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">
              {file.name}
            </p>
            <div className="flex items-center gap-2 mt-0.5">
              <span
                className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                  video ? 'bg-blue-50 text-blue-600' : 'bg-emerald-50 text-emerald-600'
                }`}
                style={MONO}
              >
                {video ? 'MP4' : 'MP3'}
              </span>
              <span className="text-xs text-muted-foreground sm:hidden">{formatBytes(file.size)}</span>
            </div>
          </div>
        </div>

        {/* Size */}
        <div className="w-16 text-right hidden sm:block">
          <span className="text-xs text-muted-foreground" style={MONO}>
            {formatBytes(file.size)}
          </span>
        </div>

        {/* Date */}
        <div className="w-32 text-right hidden lg:block">
          <span className="text-xs text-muted-foreground">{formatDate(file.uploaded)}</span>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 w-20 justify-end">
          <button
            onClick={onTogglePlay}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all"
            title={isPlaying ? '닫기' : '재생'}
          >
            {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
          </button>
          <a
            href={fileUrl(file.key, true)}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all"
            title="다운로드"
          >
            <Download className="w-3.5 h-3.5" />
          </a>
          <button
            onClick={onDelete}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-red-500 hover:bg-red-50 transition-all"
            title="삭제"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Inline player */}
      {isPlaying && (
        <div className="px-5 pb-4 -mt-1">
          {video ? (
            <video src={fileUrl(file.key)} controls autoPlay className="w-full max-h-[60vh] rounded-xl bg-black" />
          ) : (
            <audio src={fileUrl(file.key)} controls autoPlay className="w-full" />
          )}
        </div>
      )}
    </div>
  )
}
