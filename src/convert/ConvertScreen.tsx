import { useCallback, useMemo, useRef, useState } from 'react'
import { ArrowLeft, Check, FileVideo, Loader2, Music, RefreshCw, Search } from 'lucide-react'
import { FFmpeg } from '@ffmpeg/ffmpeg'
import coreURL from '@ffmpeg/core?url'
import wasmURL from '@ffmpeg/core/wasm?url'
import { useMediaLibrary } from '../hooks/useMediaLibrary'
import { fileUrl, formatBytes, isVideo, uploadFile, type MediaFile } from '../lib'

type JobStatus = 'idle' | 'downloading' | 'converting' | 'uploading' | 'done' | 'error'
interface Job {
  status: JobStatus
  progress: number // 0~100 (현재 단계 기준)
  error?: string
}

type EngineState = 'unloaded' | 'loading' | 'ready' | 'error'

/** "파일명.mp4" → "파일명" (확장자 제거) */
function baseName(name: string): string {
  return name.replace(/\.[^./\\]+$/, '')
}

/**
 * mp4 → mp3 변환 화면.
 * R2 라이브러리의 mp4 를 브라우저(ffmpeg.wasm, 싱글스레드)에서 오디오만 추출해
 * mp3 로 만든 뒤 다시 R2 로 업로드한다. 서버(Vercel 함수)는 거치지 않는다.
 */
export default function ConvertScreen() {
  const { files, loading, error, refresh } = useMediaLibrary()

  const [engine, setEngine] = useState<EngineState>('unloaded')
  const [jobs, setJobs] = useState<Record<string, Job>>({})
  const [busy, setBusy] = useState(false)
  const [search, setSearch] = useState('')

  const ffRef = useRef<FFmpeg | null>(null)
  const currentKeyRef = useRef<string | null>(null)

  const patchJob = useCallback((key: string, patch: Partial<Job>) => {
    setJobs((prev) => {
      const base: Job = prev[key] ?? { status: 'idle', progress: 0 }
      return { ...prev, [key]: { ...base, ...patch } }
    })
  }, [])

  // ffmpeg 엔진 지연 로딩(최초 변환 시 ~25MB 코어 다운로드). 이후 재사용.
  const ensureEngine = useCallback(async (): Promise<FFmpeg> => {
    if (ffRef.current) return ffRef.current
    setEngine('loading')
    try {
      const ff = new FFmpeg()
      ff.on('progress', ({ progress }) => {
        const key = currentKeyRef.current
        if (!key) return
        const pct = Math.min(100, Math.max(0, progress * 100))
        patchJob(key, { status: 'converting', progress: pct })
      })
      await ff.load({ coreURL, wasmURL })
      ffRef.current = ff
      setEngine('ready')
      return ff
    } catch (e) {
      setEngine('error')
      throw e instanceof Error ? e : new Error(String(e))
    }
  }, [patchJob])

  const convertOne = useCallback(
    async (mp4: MediaFile) => {
      const key = mp4.key
      currentKeyRef.current = key
      try {
        // 1) R2 에서 mp4 내려받기
        patchJob(key, { status: 'downloading', progress: 0, error: undefined })
        const res = await fetch(fileUrl(key))
        if (!res.ok) throw new Error(`다운로드 실패 (${res.status})`)
        const input = new Uint8Array(await res.arrayBuffer())

        // 2) 브라우저에서 오디오만 추출 → mp3
        const ff = await ensureEngine()
        patchJob(key, { status: 'converting', progress: 0 })
        await ff.writeFile('in.mp4', input)
        await ff.exec([
          '-i', 'in.mp4',
          '-vn', // 영상 제거
          '-c:a', 'libmp3lame',
          '-b:a', '192k',
          'out.mp3',
        ])
        const out = (await ff.readFile('out.mp3')) as Uint8Array<ArrayBuffer>
        await ff.deleteFile('in.mp4')
        await ff.deleteFile('out.mp3')

        // 3) mp3 로 R2 업로드
        const outName = `${baseName(mp4.name)}.mp3`
        const outFile = new File([out], outName, { type: 'audio/mpeg' })
        patchJob(key, { status: 'uploading', progress: 0 })
        await uploadFile(outFile, (frac) => patchJob(key, { status: 'uploading', progress: frac * 100 }))

        patchJob(key, { status: 'done', progress: 100 })
        await refresh()
      } catch (e) {
        patchJob(key, { status: 'error', error: e instanceof Error ? e.message : String(e) })
      } finally {
        currentKeyRef.current = null
      }
    },
    [ensureEngine, patchJob, refresh],
  )

  const runOne = useCallback(
    async (mp4: MediaFile) => {
      if (busy) return
      setBusy(true)
      try {
        await convertOne(mp4)
      } finally {
        setBusy(false)
      }
    },
    [busy, convertOne],
  )

  const mp4s = useMemo(() => files.filter((f) => isVideo(f)), [files])
  const mp3Bases = useMemo(
    () => new Set(files.filter((f) => !isVideo(f)).map((f) => baseName(f.name))),
    [files],
  )
  const visibleMp4s = useMemo(() => {
    const q = search.trim().toLowerCase()
    return q ? mp4s.filter((f) => f.name.toLowerCase().includes(q)) : mp4s
  }, [mp4s, search])

  const runAll = useCallback(async () => {
    if (busy) return
    setBusy(true)
    try {
      // 이미 mp3 가 있거나 완료된 항목은 건너뛴다.
      for (const mp4 of mp4s) {
        if (mp3Bases.has(baseName(mp4.name))) continue
        if (jobs[mp4.key]?.status === 'done') continue
        await convertOne(mp4)
      }
    } finally {
      setBusy(false)
    }
  }, [busy, mp4s, mp3Bases, jobs, convertOne])

  const pendingCount = mp4s.filter(
    (m) => !mp3Bases.has(baseName(m.name)) && jobs[m.key]?.status !== 'done',
  ).length

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="bg-card/80 backdrop-blur border-b border-border px-6 py-3 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <a href="#" className="text-muted-foreground hover:text-foreground transition-colors" title="라이브러리로">
            <ArrowLeft className="w-5 h-5" />
          </a>
          <span className="text-lg font-bold tracking-tight">
            mp4 → mp3 변환{' '}
            <span className="text-muted-foreground font-medium text-sm">브라우저 변환</span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => void refresh()}
            className="text-muted-foreground hover:text-foreground p-2 rounded-lg hover:bg-secondary transition-colors"
            title="목록 새로고침"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => void runAll()}
            disabled={busy || pendingCount === 0}
            className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-semibold hover:bg-primary/90 disabled:opacity-40 transition-colors"
          >
            {pendingCount > 0 ? `전체 변환 (${pendingCount})` : '전체 변환'}
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-3xl w-full mx-auto px-4 sm:px-6 py-6">
        <div className="relative mb-4">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="mp4 파일 검색..."
            className="w-full bg-card border border-border rounded-xl pl-10 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/10 transition-all"
          />
        </div>

        {engine === 'loading' && (
          <div className="mb-4 flex items-center gap-2 text-sm text-info bg-info-soft/40 border border-border rounded-xl px-4 py-3">
            <Loader2 className="w-4 h-4 animate-spin" /> 변환 엔진 불러오는 중… (최초 1회, 약 25MB)
          </div>
        )}
        {engine === 'error' && (
          <div className="mb-4 text-sm text-destructive bg-destructive-soft/40 border border-border rounded-xl px-4 py-3">
            변환 엔진을 불러오지 못했습니다. 새로고침 후 다시 시도해 주세요.
          </div>
        )}

        <div className="bg-card rounded-2xl border border-border overflow-hidden">
          <div className="px-4 py-3 border-b border-border text-sm font-semibold flex items-center gap-2">
            <FileVideo className="w-4 h-4 text-info" /> mp4 파일{' '}
            {search.trim() && mp4s.length > 0
              ? `· ${visibleMp4s.length}/${mp4s.length}`
              : mp4s.length > 0
                ? `· ${mp4s.length}`
                : ''}
          </div>

          <div className="divide-y divide-border">
            {loading && (
              <p className="px-4 py-6 text-sm text-muted-foreground text-center">목록 불러오는 중…</p>
            )}
            {error && <p className="px-4 py-6 text-sm text-destructive text-center">{error}</p>}
            {!loading && !error && mp4s.length === 0 && (
              <p className="px-4 py-6 text-sm text-muted-foreground text-center">
                변환할 mp4 파일이 없습니다.
              </p>
            )}
            {!loading && !error && mp4s.length > 0 && visibleMp4s.length === 0 && (
              <p className="px-4 py-6 text-sm text-muted-foreground text-center">
                검색 결과가 없습니다.
              </p>
            )}

            {visibleMp4s.map((mp4) => {
              const job = jobs[mp4.key]
              const hasMp3 = mp3Bases.has(baseName(mp4.name))
              const running =
                job?.status === 'downloading' ||
                job?.status === 'converting' ||
                job?.status === 'uploading'
              return (
                <div key={mp4.key} className="flex items-center gap-3 px-4 py-3">
                  <div className="w-9 h-9 rounded-lg bg-info-soft flex items-center justify-center shrink-0">
                    <FileVideo className="w-4 h-4 text-info" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm truncate">{mp4.name}</p>
                    <p className="text-xs text-muted-foreground tabular-nums">
                      {formatBytes(mp4.size)}
                      {job && <StatusLabel job={job} />}
                    </p>
                  </div>

                  {job?.status === 'done' || (hasMp3 && !running && job?.status !== 'error') ? (
                    <span className="flex items-center gap-1 text-xs font-semibold text-success shrink-0">
                      <Check className="w-4 h-4" /> mp3 있음
                    </span>
                  ) : (
                    <button
                      onClick={() => void runOne(mp4)}
                      disabled={busy}
                      className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-secondary text-secondary-foreground hover:bg-secondary/70 disabled:opacity-40 transition-colors shrink-0"
                    >
                      {running ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Music className="w-3.5 h-3.5" />
                      )}
                      {job?.status === 'error' ? '다시 변환' : 'mp3로 변환'}
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </main>
    </div>
  )
}

function StatusLabel({ job }: { job: Job }) {
  switch (job.status) {
    case 'downloading':
      return <> · 다운로드 중…</>
    case 'converting':
      return <> · 변환 중 {Math.round(job.progress)}%</>
    case 'uploading':
      return <> · 업로드 중 {Math.round(job.progress)}%</>
    case 'done':
      return <span className="text-success"> · 완료</span>
    case 'error':
      return <span className="text-destructive"> · {job.error ?? '실패'}</span>
    default:
      return null
  }
}
