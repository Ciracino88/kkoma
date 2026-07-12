import { AlertCircle, Music, Video } from 'lucide-react'
import type { Upload } from '../hooks/useUploads'
import { MONO } from './shared'

/** 진행 중/실패한 업로드 목록 */
export function UploadList({ uploads }: { uploads: Upload[] }) {
  if (uploads.length === 0) return null
  return (
    <div className="mb-6 space-y-3">
      {uploads.map((f) => (
        <div key={f.id} className="bg-white rounded-2xl border border-border p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3 min-w-0">
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                  f.video ? 'bg-blue-50' : 'bg-emerald-50'
                }`}
              >
                {f.video ? (
                  <Video className="w-4 h-4 text-blue-500" />
                ) : (
                  <Music className="w-4 h-4 text-emerald-500" />
                )}
              </div>
              <span className="text-sm font-medium truncate">{f.name}</span>
            </div>
            {f.error ? (
              <span className="text-xs text-red-500 font-medium flex items-center gap-1 shrink-0">
                <AlertCircle className="w-3.5 h-3.5" /> 실패
              </span>
            ) : (
              <span className="text-xs text-muted-foreground font-medium shrink-0" style={MONO}>
                {Math.round(f.progress)}%
              </span>
            )}
          </div>
          {f.error ? (
            <p className="text-xs text-red-500">{f.error}</p>
          ) : (
            <div className="w-full h-1.5 bg-secondary rounded-full overflow-hidden">
              <div
                className="h-1.5 bg-primary rounded-full transition-all duration-200"
                style={{ width: `${f.progress}%` }}
              />
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
