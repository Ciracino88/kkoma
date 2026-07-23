import { Upload } from 'lucide-react'

/** 파일을 드래그 중일 때 표시되는 전체 화면 오버레이 */
export function DragOverlay({ visible }: { visible: boolean }) {
  if (!visible) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm pointer-events-none">
      <div className="text-center bg-card rounded-3xl p-12 shadow-lg border-2 border-dashed border-primary">
        <Upload className="w-16 h-16 text-primary mx-auto mb-4" />
        <p className="text-2xl font-bold text-primary">파일을 놓으세요</p>
        <p className="text-muted-foreground mt-2">MP3 / MP4 파일 지원</p>
      </div>
    </div>
  )
}
