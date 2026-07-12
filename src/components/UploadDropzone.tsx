import { Upload } from 'lucide-react'

/** 클릭/드래그 업로드 영역 (드롭 처리는 상위 App 에서) */
export function UploadDropzone({ onOpen }: { onOpen: () => void }) {
  return (
    <div
      onClick={onOpen}
      className="bg-white border-2 border-dashed border-border hover:border-primary/40 hover:bg-primary/[0.02] transition-all cursor-pointer p-8 mb-6 rounded-2xl flex items-center justify-center gap-4 group"
    >
      <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center group-hover:bg-primary/15 transition-colors">
        <Upload className="w-6 h-6 text-primary" />
      </div>
      <div>
        <p className="text-sm font-semibold text-foreground">클릭하거나 파일을 여기로 드래그하세요</p>
        <p className="text-xs text-muted-foreground mt-0.5">MP3, MP4 파일 지원 · 파일당 최대 5GB</p>
      </div>
    </div>
  )
}
