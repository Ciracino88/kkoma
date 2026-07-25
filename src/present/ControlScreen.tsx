import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  FileUp,
  Film,
  Music,
  Pause,
  Play,
  Square,
} from 'lucide-react'
import { useDeck } from './useDeck'
import { usePresentChannel, type PresentMsg } from './channel'
import { formatBytes } from '../lib'

interface MusicItem {
  id: string
  file: File
  name: string
}

/**
 * 2스크린 — 조작 창. PPT 넘기기 · 영상 · 음악을 제어해 출력 창(1스크린)에 지시.
 * 자기 창에는 미리보기만 렌더한다(소리/영상 재생은 출력 창에서).
 */
export default function ControlScreen() {
  const previewRef = useRef<HTMLDivElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [music, setMusic] = useState<MusicItem[]>([])
  const [playingMusic, setPlayingMusic] = useState<string | null>(null)
  const [musicPaused, setMusicPaused] = useState(false)

  const deck = useDeck(file, previewRef)

  // HELLO 응답에 필요한 최신값 참조
  const fileRef = useRef<File | null>(null)
  const currentRef = useRef(0)
  const postRef = useRef<(m: PresentMsg) => void>(() => {})
  fileRef.current = file
  currentRef.current = deck.current

  const onMessage = useCallback((msg: PresentMsg) => {
    if (msg.type === 'HELLO' && fileRef.current) {
      postRef.current({ type: 'DECK', file: fileRef.current })
      postRef.current({ type: 'GOTO', index: currentRef.current })
    }
  }, [])
  const post = usePresentChannel(onMessage)
  postRef.current = post

  const openFile = useCallback(
    (f: File) => {
      if (!f.name.toLowerCase().endsWith('.pptx')) return
      setFile(f)
      post({ type: 'DECK', file: f })
    },
    [post],
  )

  const goTo = useCallback(
    (index: number) => {
      const next = Math.min(Math.max(0, index), Math.max(0, deck.slideCount - 1))
      deck.goTo(next)
      post({ type: 'GOTO', index: next })
    },
    [deck, post],
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!deck.ready) return
      if (e.key === 'ArrowRight' || e.key === 'PageDown') goTo(deck.current + 1)
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp') goTo(deck.current - 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [deck.ready, deck.current, goTo])

  const openOutput = useCallback(() => {
    const url = `${location.origin}${location.pathname}#present-output`
    window.open(url, 'kkoma-output', 'width=1280,height=720')
  }, [])

  const playMusic = useCallback(
    (m: MusicItem) => {
      post({ type: 'MUSIC_PLAY', file: m.file, label: m.name })
      setPlayingMusic(m.id)
      setMusicPaused(false)
    },
    [post],
  )
  const toggleMusic = useCallback(() => {
    if (musicPaused) {
      post({ type: 'MUSIC_RESUME' })
      setMusicPaused(false)
    } else {
      post({ type: 'MUSIC_PAUSE' })
      setMusicPaused(true)
    }
  }, [musicPaused, post])
  const stopMusic = useCallback(() => {
    post({ type: 'MUSIC_STOP' })
    setPlayingMusic(null)
    setMusicPaused(false)
  }, [post])

  const currentSlideVideos = deck.media?.bySlide.get(deck.current) ?? []

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="bg-card/80 backdrop-blur border-b border-border px-6 py-3 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <a href="#" className="text-muted-foreground hover:text-foreground transition-colors" title="라이브러리로">
            <ArrowLeft className="w-5 h-5" />
          </a>
          <span className="text-lg font-bold tracking-tight">
            예배 조작 <span className="text-muted-foreground font-medium text-sm">2스크린</span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={openOutput}
            className="flex items-center gap-2 bg-secondary text-secondary-foreground px-4 py-2 rounded-lg text-sm font-semibold hover:bg-secondary/70 transition-colors"
          >
            <ExternalLink className="w-4 h-4" /> 출력 창 열기
          </button>
          <label className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors cursor-pointer">
            <FileUp className="w-4 h-4" /> PPT 열기
            <input
              type="file"
              accept=".pptx"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) openFile(f)
                e.target.value = ''
              }}
            />
          </label>
        </div>
      </header>

      <div className="flex-1 grid lg:grid-cols-[1fr_340px] gap-4 p-4 sm:p-6">
        {/* 슬라이드 미리보기 + 네비 */}
        <section className="flex flex-col gap-3 min-w-0">
          <div className="relative flex-1 flex items-center justify-center bg-card rounded-2xl border border-border overflow-hidden min-h-[300px]">
            {!file && (
              <p className="text-sm text-muted-foreground">“PPT 열기”로 이번 주 예배 PPT를 선택하세요</p>
            )}
            <div
              ref={previewRef}
              className="w-full"
              style={{ display: file && !deck.error ? 'block' : 'none' }}
            />
            {deck.error && <p className="text-sm text-destructive px-4">{deck.error}</p>}
          </div>

          {deck.slideCount > 0 && (
            <div className="flex items-center justify-center gap-4">
              <button
                onClick={() => goTo(deck.current - 1)}
                disabled={deck.current === 0}
                className="w-11 h-11 rounded-full bg-card shadow-sm border border-border flex items-center justify-center hover:bg-secondary disabled:opacity-30 transition-all"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <span className="text-sm text-muted-foreground tabular-nums w-20 text-center">
                {deck.current + 1} / {deck.slideCount}
              </span>
              <button
                onClick={() => goTo(deck.current + 1)}
                disabled={deck.current === deck.slideCount - 1}
                className="w-11 h-11 rounded-full bg-card shadow-sm border border-border flex items-center justify-center hover:bg-secondary disabled:opacity-30 transition-all"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          )}
        </section>

        {/* 사이드: 영상 · 음악 컨트롤 */}
        <aside className="flex flex-col gap-4">
          {/* 영상 */}
          <div className="bg-card rounded-2xl border border-border overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <span className="text-sm font-semibold flex items-center gap-2">
                <Film className="w-4 h-4 text-info" /> 영상 {deck.media ? `· ${deck.media.all.length}` : ''}
              </span>
              <button
                onClick={() => post({ type: 'VIDEO_STOP' })}
                className="text-xs text-muted-foreground hover:text-destructive"
              >
                정지
              </button>
            </div>
            <div className="max-h-64 overflow-y-auto divide-y divide-border">
              {(deck.media?.all ?? []).map((v) => {
                const isCurrent = currentSlideVideos.some((c) => c.path === v.path)
                return (
                  <button
                    key={v.path}
                    onClick={() => post({ type: 'VIDEO_PLAY', path: v.path })}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-secondary transition-colors ${
                      isCurrent ? 'bg-info-soft/50' : ''
                    }`}
                  >
                    <Play className="w-4 h-4 text-info shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm truncate">{v.name}</p>
                      <p className="text-xs text-muted-foreground tabular-nums">
                        슬라이드 {v.slideIndex + 1}
                        {v.sizeBytes > 0 && ` · ${formatBytes(v.sizeBytes)}`}
                      </p>
                    </div>
                  </button>
                )
              })}
              {deck.media && deck.media.all.length === 0 && (
                <p className="px-4 py-3 text-xs text-muted-foreground">이 PPT에는 영상이 없습니다</p>
              )}
              {!deck.media && file && <p className="px-4 py-3 text-xs text-muted-foreground">영상 확인 중…</p>}
            </div>
          </div>

          {/* 음악 */}
          <div className="bg-card rounded-2xl border border-border overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <span className="text-sm font-semibold flex items-center gap-2">
                <Music className="w-4 h-4 text-success" /> 음악
              </span>
              <label className="text-xs text-primary font-semibold cursor-pointer hover:underline">
                추가
                <input
                  type="file"
                  accept="audio/*"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    const files = [...(e.target.files ?? [])]
                    setMusic((prev) => [
                      ...prev,
                      ...files.map((f) => ({ id: crypto.randomUUID(), file: f, name: f.name })),
                    ])
                    e.target.value = ''
                  }}
                />
              </label>
            </div>

            {playingMusic && (
              <div className="px-4 py-2.5 border-b border-border flex items-center gap-2 bg-success-soft/40">
                <span className="text-xs text-muted-foreground flex-1 truncate">
                  {music.find((m) => m.id === playingMusic)?.name}
                </span>
                <button onClick={toggleMusic} className="text-muted-foreground hover:text-foreground">
                  {musicPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                </button>
                <button onClick={stopMusic} className="text-muted-foreground hover:text-destructive">
                  <Square className="w-4 h-4" />
                </button>
              </div>
            )}

            <div className="max-h-56 overflow-y-auto divide-y divide-border">
              {music.map((m) => (
                <button
                  key={m.id}
                  onClick={() => playMusic(m)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-secondary transition-colors ${
                    playingMusic === m.id ? 'bg-success-soft/50' : ''
                  }`}
                >
                  <div className="w-8 h-8 rounded-lg bg-success-soft flex items-center justify-center shrink-0">
                    <Music className="w-4 h-4 text-success" />
                  </div>
                  <p className="text-sm truncate flex-1">{m.name}</p>
                  <Play className="w-4 h-4 text-muted-foreground shrink-0" />
                </button>
              ))}
              {music.length === 0 && (
                <p className="px-4 py-3 text-xs text-muted-foreground">“추가”로 음악 파일을 넣으세요</p>
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}
