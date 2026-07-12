import { HardDrive, Upload } from 'lucide-react'
import { formatBytes } from '../lib'
import { MONO } from './shared'

// 네이버 밴드 링크 — URL 이 정해지면 여기에 넣으세요 (예: 'https://band.us/band/xxxx').
// 비어 있으면 "준비 중" 상태로 표시됩니다.
const BAND_URL = ''

interface HeaderProps {
  storageUsed: number
  onUpload: () => void
}

/** 상단 고정 헤더: 로고 · 사용량 · 업로드 버튼 */
export function Header({ storageUsed, onUpload }: HeaderProps) {
  return (
    <header className="bg-white/80 backdrop-blur border-b border-border px-6 py-4 flex items-center justify-between sticky top-0 z-40">
      <div className="flex items-center gap-3">
        <img
          src="/icon-192.png"
          alt="kkoma"
          className="w-9 h-9 rounded-xl object-cover shadow-md shadow-primary/30"
        />
        <span className="text-lg font-bold tracking-tight text-foreground" style={MONO}>
          kkoma
        </span>
      </div>
      <div className="flex items-center gap-4">
        <a
          href={BAND_URL || undefined}
          target={BAND_URL ? '_blank' : undefined}
          rel="noreferrer"
          aria-disabled={BAND_URL ? undefined : true}
          title={BAND_URL ? '네이버 밴드로 이동' : '네이버 밴드 링크 준비 중'}
          className={`hidden sm:flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full transition-colors ${
            BAND_URL
              ? 'text-foreground bg-secondary hover:bg-secondary/70 cursor-pointer'
              : 'text-muted-foreground bg-secondary/60 cursor-default'
          }`}
        >
          <img src="/band-icon.svg" alt="" className="w-4 h-4" />
          밴드
        </a>
        <div className="text-xs text-muted-foreground hidden sm:flex items-center gap-1.5 bg-secondary px-3 py-1.5 rounded-full">
          <HardDrive className="w-3.5 h-3.5" />
          <span style={MONO}>{formatBytes(storageUsed)} 사용 중</span>
        </div>
        <button
          onClick={onUpload}
          className="flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors shadow-md shadow-primary/25"
        >
          <Upload className="w-4 h-4" />
          업로드
        </button>
      </div>
    </header>
  )
}
