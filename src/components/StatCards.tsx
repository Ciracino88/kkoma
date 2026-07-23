import { FolderOpen, Music, Video, type LucideIcon } from 'lucide-react'

interface StatCardsProps {
  total: number
  mp3: number
  mp4: number
}

interface Stat {
  label: string
  value: number
  icon: LucideIcon
  color: string
  bg: string
}

/** 전체 / MP3 / MP4 개수 통계 카드 */
export function StatCards({ total, mp3, mp4 }: StatCardsProps) {
  const stats: Stat[] = [
    { label: '전체 파일', value: total, icon: FolderOpen, color: 'text-accent', bg: 'bg-accent-soft' },
    { label: 'MP3 오디오', value: mp3, icon: Music, color: 'text-success', bg: 'bg-success-soft' },
    { label: 'MP4 비디오', value: mp4, icon: Video, color: 'text-info', bg: 'bg-info-soft' },
  ]

  return (
    <div className="grid grid-cols-3 gap-4 mb-8">
      {stats.map(({ label, value, icon: Icon, color, bg }) => (
        <div key={label} className="bg-card rounded-2xl p-5 shadow-sm border border-border">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-muted-foreground font-medium">{label}</span>
            <div className={`w-8 h-8 ${bg} rounded-lg flex items-center justify-center`}>
              <Icon className={`w-4 h-4 ${color}`} />
            </div>
          </div>
          <div className="text-3xl font-bold text-foreground tabular-nums">
            {String(value).padStart(2, '0')}
          </div>
        </div>
      ))}
    </div>
  )
}
