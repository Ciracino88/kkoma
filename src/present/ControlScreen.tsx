import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  FileUp,
  Film,
  ListMusic,
  ListVideo,
  Music,
  Pause,
  Play,
  Plus,
  Presentation,
  SkipForward,
  Square,
  Upload,
  Video,
  X,
} from 'lucide-react'
import { useDeck } from './useDeck'
import { usePresentChannel, type OutputMode, type PresentMsg } from './channel'
import { SortablePlaylist } from './SortablePlaylist'
import {
  embeddedId,
  libraryVideoId,
  musicItemId,
  musicItemFromLibrary,
  videoItemFromEmbedded,
  videoItemFromLibrary,
  videoItemFromLocal,
  type MusicItem,
  type VideoItem,
} from './playlist'
import { useMediaLibrary } from '../hooks/useMediaLibrary'
import { formatBytes, isAudio, isVideo, type MediaFile } from '../lib'

type Tab = 'video' | 'music'

/**
 * 2스크린 — 조작 창. PPT 넘기기 · 영상 · 음악을 제어해 출력 창(1스크린)에 지시.
 * 자기 창에는 미리보기만 렌더한다(소리/영상 재생은 출력 창에서).
 *
 * 사이드 패널은 영상/음악 탭으로 나뉘고, 각 탭은 "재생목록(수동 큐)" + "소스에서 추가"로 구성.
 * 큐 순서는 @dnd-kit 드래그로 바꾸고, 자동 연속재생 없이 항목/다음 버튼으로 하나씩 재생한다.
 */
export default function ControlScreen() {
  const previewRef = useRef<HTMLDivElement>(null)
  const nextPreviewRef = useRef<HTMLDivElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [outputMode, setOutputMode] = useState<OutputMode>('ppt')
  const [tab, setTab] = useState<Tab>('video')

  // 재생목록(수동 큐)
  const [videoQueue, setVideoQueue] = useState<VideoItem[]>([])
  const [musicQueue, setMusicQueue] = useState<MusicItem[]>([])
  const [currentVideoId, setCurrentVideoId] = useState<string | null>(null)
  const [playingMusicId, setPlayingMusicId] = useState<string | null>(null)
  const [musicPaused, setMusicPaused] = useState(false)

  const deck = useDeck(file, previewRef)

  // R2 라이브러리에서 오디오(mp3)·영상(mp4)을 소스 목록으로 사용
  const { files: libraryFiles, loading: mediaLoading, error: mediaError, refresh: refreshMedia } =
    useMediaLibrary()
  const musicLibrary = libraryFiles.filter((f: MediaFile) => isAudio(f))
  const libraryVideos = libraryFiles.filter((f: MediaFile) => isVideo(f))

  // HELLO 응답에 필요한 최신값 참조
  const fileRef = useRef<File | null>(null)
  const currentRef = useRef(0)
  const modeRef = useRef<OutputMode>('ppt')
  const postRef = useRef<(m: PresentMsg) => void>(() => {})

  const onMessage = useCallback((msg: PresentMsg) => {
    // 출력 창이 (재)연결되면 현재 상태를 재전송
    if (msg.type === 'HELLO') {
      if (fileRef.current) {
        postRef.current({ type: 'DECK', file: fileRef.current })
        postRef.current({ type: 'GOTO', index: currentRef.current })
      }
      postRef.current({ type: 'MODE', mode: modeRef.current })
    }
  }, [])
  const post = usePresentChannel(onMessage)

  // HELLO 응답에 쓰는 최신값을 렌더 후 ref 에 동기화
  useEffect(() => {
    fileRef.current = file
    currentRef.current = deck.current
    modeRef.current = outputMode
    postRef.current = post
  })

  // 출력 화면 모드 전환. video→ppt 로 돌아갈 때는 재생 중인 영상을 정지한다.
  const changeMode = useCallback(
    (mode: OutputMode) => {
      setOutputMode(mode)
      post({ type: 'MODE', mode })
      if (mode === 'ppt') {
        post({ type: 'VIDEO_STOP' })
        setCurrentVideoId(null)
      }
    },
    [post],
  )

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

  // ── 영상 재생목록 ─────────────────────────────────────────────
  const addVideo = useCallback((item: VideoItem) => {
    // 안정적 id(PPT 내장·라이브러리)는 중복 추가 방지. 로컬 파일은 매번 고유 id.
    setVideoQueue((q) => (q.some((v) => v.id === item.id) ? q : [...q, item]))
  }, [])
  const removeVideo = useCallback((id: string) => {
    setVideoQueue((q) => q.filter((v) => v.id !== id))
    setCurrentVideoId((cur) => (cur === id ? null : cur))
  }, [])

  // 한 항목을 출력 창에 재생. 소스 종류에 맞는 채널 메시지를 보낸다.
  const playVideo = useCallback(
    (item: VideoItem) => {
      const s = item.source
      if (s.kind === 'embedded') post({ type: 'VIDEO_PLAY', path: s.path })
      else if (s.kind === 'library') post({ type: 'VIDEO_PLAY_URL', url: s.url, label: item.label })
      else post({ type: 'VIDEO_PLAY_FILE', file: s.file, label: item.label })
      setCurrentVideoId(item.id)
      setOutputMode('video')
      post({ type: 'MODE', mode: 'video' })
    },
    [post],
  )
  // 다음 영상: 재생 중이 없으면 첫 항목, 있으면 그 다음 항목(마지막이면 정지).
  const playNextVideo = useCallback(() => {
    if (videoQueue.length === 0) return
    const idx = videoQueue.findIndex((v) => v.id === currentVideoId)
    const next = idx < 0 ? videoQueue[0] : videoQueue[idx + 1]
    if (next) playVideo(next)
  }, [videoQueue, currentVideoId, playVideo])

  // ── 음악 재생목록 ─────────────────────────────────────────────
  const addMusic = useCallback((item: MusicItem) => {
    setMusicQueue((q) => (q.some((m) => m.id === item.id) ? q : [...q, item]))
  }, [])
  const removeMusic = useCallback(
    (id: string) => {
      setMusicQueue((q) => q.filter((m) => m.id !== id))
      if (playingMusicId === id) {
        post({ type: 'MUSIC_STOP' })
        setPlayingMusicId(null)
        setMusicPaused(false)
      }
    },
    [playingMusicId, post],
  )
  const playMusic = useCallback(
    (item: MusicItem) => {
      post({ type: 'MUSIC_PLAY', url: item.url, label: item.label })
      setPlayingMusicId(item.id)
      setMusicPaused(false)
    },
    [post],
  )
  const playNextMusic = useCallback(() => {
    if (musicQueue.length === 0) return
    const idx = musicQueue.findIndex((m) => m.id === playingMusicId)
    const next = idx < 0 ? musicQueue[0] : musicQueue[idx + 1]
    if (next) playMusic(next)
  }, [musicQueue, playingMusicId, playMusic])
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
    setPlayingMusicId(null)
    setMusicPaused(false)
  }, [post])

  // 다음 슬라이드 미리보기(썸네일). 현재 슬라이드/개수가 바뀔 때마다 다시 렌더.
  useEffect(() => {
    const container = nextPreviewRef.current
    if (!container) return
    const nextIndex = deck.current + 1
    if (!deck.ready || nextIndex >= deck.slideCount) {
      container.replaceChildren()
      return
    }
    const handle = deck.renderThumb(nextIndex, container, 216)
    return () => handle?.dispose()
  }, [deck.ready, deck.current, deck.slideCount, deck.renderThumb])

  const hasNext = deck.ready && deck.current + 1 < deck.slideCount
  const showNext = !!file && deck.slideCount > 0
  const embeddedVideos = deck.media?.all ?? []
  const inVideoQueue = (id: string) => videoQueue.some((v) => v.id === id)
  const inMusicQueue = (id: string) => musicQueue.some((m) => m.id === id)

  const sourceBadge = (item: VideoItem): string => {
    if (item.source.kind === 'embedded') return `PPT 슬라이드 ${item.source.slideIndex + 1}`
    if (item.source.kind === 'library') return '라이브러리'
    return '로컬'
  }

  const tabClass = (active: boolean, tone: 'info' | 'success') =>
    `flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
      active
        ? `bg-card shadow-sm ${tone === 'info' ? 'text-info' : 'text-success'}`
        : 'text-muted-foreground hover:text-foreground'
    }`

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

      <div className="flex-1 grid lg:grid-cols-[1fr_380px] gap-5 p-4 sm:p-6 items-start">
        {/* 슬라이드 미리보기 + 네비 */}
        <section className="flex flex-col gap-3 min-w-0 lg:h-[calc(100vh-7rem)]">
          {/* 출력 화면 모드 토글 */}
          <div className="flex items-center justify-between shrink-0">
            <span className="text-xs font-medium text-muted-foreground">출력 화면</span>
            <div className="inline-flex bg-secondary rounded-lg p-1 gap-1">
              <button
                onClick={() => changeMode('ppt')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-semibold transition-colors ${
                  outputMode === 'ppt'
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Presentation className="w-4 h-4" /> PPT
              </button>
              <button
                onClick={() => changeMode('video')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-semibold transition-colors ${
                  outputMode === 'video'
                    ? 'bg-card text-info shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Video className="w-4 h-4" /> 영상
              </button>
            </div>
          </div>

          {/* 현재 슬라이드(좌, 크게) + 다음 슬라이드(우, 작게) 가로 배치 */}
          <div
            className={`flex-1 min-h-0 grid gap-3 items-stretch ${
              showNext ? 'sm:grid-cols-[1fr_248px]' : 'grid-cols-1'
            }`}
          >
            {/* 현재 슬라이드 + 네비 */}
            <div className="flex flex-col gap-3 min-w-0 min-h-0">
              <div className="relative flex-1 min-h-[280px] flex items-center justify-center bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
                {!file && (
                  <p className="text-sm text-muted-foreground px-4 text-center">
                    “PPT 열기”로 이번 주 예배 PPT를 선택하세요
                  </p>
                )}
                <div
                  ref={previewRef}
                  className="w-full"
                  style={{ display: file && !deck.error ? 'block' : 'none' }}
                />
                {deck.error && <p className="text-sm text-destructive px-4">{deck.error}</p>}
                <div className="absolute top-2 left-2 flex items-center gap-1.5 bg-foreground/70 text-background text-xs font-semibold px-2.5 py-1 rounded-full">
                  현재 슬라이드
                </div>
                {outputMode === 'video' && (
                  <div className="absolute top-2 right-2 flex items-center gap-1.5 bg-info-soft text-info text-xs font-semibold px-2.5 py-1 rounded-full">
                    <Video className="w-3.5 h-3.5" /> 출력: 영상 모드
                  </div>
                )}
              </div>

              {deck.slideCount > 0 && (
                <div className="flex items-center justify-center gap-4 shrink-0">
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
            </div>

            {/* 다음 슬라이드 */}
            {showNext && (
              <div className="self-start flex flex-col bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
                <div className="px-4 py-2 border-b border-border shrink-0">
                  <span className="text-xs font-semibold text-muted-foreground">다음 슬라이드</span>
                </div>
                <div className="p-3 flex items-center justify-center min-h-[148px]">
                  <div
                    ref={nextPreviewRef}
                    className="overflow-hidden rounded-lg"
                    style={{ display: hasNext ? 'block' : 'none' }}
                  />
                  {!hasNext && (
                    <p className="text-xs text-muted-foreground text-center">마지막 슬라이드입니다</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* 사이드: 영상/음악 탭 패널 */}
        <aside className="flex flex-col gap-3 lg:sticky lg:top-24 lg:self-start lg:h-[calc(100vh-7rem)]">
          {/* 탭 */}
          <div className="inline-flex bg-secondary rounded-xl p-1 gap-1">
            <button onClick={() => setTab('video')} className={tabClass(tab === 'video', 'info')}>
              <ListVideo className="w-4 h-4" /> 영상
              {videoQueue.length > 0 && <span className="text-xs font-normal opacity-70">· {videoQueue.length}</span>}
            </button>
            <button onClick={() => setTab('music')} className={tabClass(tab === 'music', 'success')}>
              <ListMusic className="w-4 h-4" /> 음악
              {musicQueue.length > 0 && <span className="text-xs font-normal opacity-70">· {musicQueue.length}</span>}
            </button>
          </div>

          <div className="flex-1 min-h-0 bg-card rounded-2xl border border-border shadow-sm flex flex-col overflow-hidden">
            {tab === 'video' ? (
              /* ── 영상 패널 ─────────────────────────────── */
              <>
                <div className="px-4 py-3 border-b border-border flex items-center justify-between shrink-0">
                  <span className="text-sm font-semibold flex items-center gap-2">
                    <ListVideo className="w-4 h-4 text-info" /> 재생목록
                  </span>
                  <button
                    onClick={playNextVideo}
                    disabled={videoQueue.length === 0}
                    className="flex items-center gap-1 rounded-lg bg-info-soft text-info px-2.5 py-1.5 text-xs font-semibold hover:brightness-95 disabled:opacity-40 disabled:bg-secondary disabled:text-muted-foreground transition"
                  >
                    <SkipForward className="w-3.5 h-3.5" /> 다음
                  </button>
                </div>

                {/* 큐 — DnD 순서 변경 */}
                <div className="flex-1 min-h-0 overflow-y-auto p-2">
                  {videoQueue.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center gap-2 py-10 px-4 text-muted-foreground">
                      <ListVideo className="w-8 h-8 opacity-30" />
                      <p className="text-sm font-medium">재생목록이 비어 있어요</p>
                      <p className="text-xs">아래 소스에서 영상을 담아보세요</p>
                    </div>
                  ) : (
                    <SortablePlaylist
                      items={videoQueue}
                      onReorder={setVideoQueue}
                      renderItem={(item) => {
                        const active = currentVideoId === item.id
                        return (
                          <div
                            className={`flex items-center gap-2 pr-1 rounded-lg transition-colors ${
                              active ? 'bg-info-soft' : 'hover:bg-secondary'
                            }`}
                          >
                            <button
                              onClick={() => playVideo(item)}
                              className="w-8 h-8 shrink-0 rounded-lg flex items-center justify-center text-info hover:bg-card transition-colors"
                              title="재생"
                            >
                              {active ? <Video className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                            </button>
                            <div className="min-w-0 flex-1 py-1.5">
                              <p className="text-sm truncate leading-tight">{item.label}</p>
                              <p className="text-xs text-muted-foreground tabular-nums truncate">
                                {sourceBadge(item)}
                                {item.size > 0 && ` · ${formatBytes(item.size)}`}
                              </p>
                            </div>
                            <button
                              onClick={() => removeVideo(item.id)}
                              className="shrink-0 text-muted-foreground/50 hover:text-destructive p-1.5 rounded-md hover:bg-card transition-colors"
                              title="목록에서 제거"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        )
                      }}
                    />
                  )}
                </div>

                {/* 소스에서 추가 */}
                <div className="border-t border-border shrink-0 flex flex-col max-h-[46%]">
                  <div className="px-4 py-2 flex items-center justify-between shrink-0">
                    <p className="text-xs font-semibold text-muted-foreground">소스에서 추가</p>
                    <label className="flex items-center gap-1.5 text-xs text-info font-semibold hover:underline cursor-pointer">
                      <Upload className="w-3.5 h-3.5" /> 로컬 파일
                      <input
                        type="file"
                        accept="video/*,.mp4"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0]
                          if (f) addVideo(videoItemFromLocal(f))
                          e.target.value = ''
                        }}
                      />
                    </label>
                  </div>

                  <div className="overflow-y-auto border-t border-border">
                    {/* PPT 내장 영상 */}
                    {embeddedVideos.length > 0 && (
                      <p className="px-4 pt-2 pb-1 text-xs font-medium text-muted-foreground/80">PPT 내장</p>
                    )}
                    {embeddedVideos.map((v) => {
                      const added = inVideoQueue(embeddedId(v))
                      return (
                        <div key={v.path} className="flex items-center gap-3 px-4 py-2 hover:bg-secondary/60 transition-colors">
                          <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center shrink-0">
                            <Film className="w-4 h-4 text-muted-foreground" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm truncate leading-tight">{v.name}</p>
                            <p className="text-xs text-muted-foreground tabular-nums">
                              슬라이드 {v.slideIndex + 1}
                              {v.sizeBytes > 0 && ` · ${formatBytes(v.sizeBytes)}`}
                            </p>
                          </div>
                          <AddButton added={added} tone="info" onClick={() => addVideo(videoItemFromEmbedded(v))} />
                        </div>
                      )
                    })}

                    {/* R2 라이브러리 영상 */}
                    {libraryVideos.length > 0 && (
                      <p className="px-4 pt-2 pb-1 text-xs font-medium text-muted-foreground/80">
                        라이브러리 · {libraryVideos.length}
                      </p>
                    )}
                    {libraryVideos.map((v) => {
                      const added = inVideoQueue(libraryVideoId(v))
                      return (
                        <div key={v.key} className="flex items-center gap-3 px-4 py-2 hover:bg-secondary/60 transition-colors">
                          <div className="w-8 h-8 rounded-lg bg-info-soft flex items-center justify-center shrink-0">
                            <Video className="w-4 h-4 text-info" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm truncate leading-tight">{v.name}</p>
                            {v.size > 0 && (
                              <p className="text-xs text-muted-foreground tabular-nums">{formatBytes(v.size)}</p>
                            )}
                          </div>
                          <AddButton added={added} tone="info" onClick={() => addVideo(videoItemFromLibrary(v))} />
                        </div>
                      )
                    })}

                    {!deck.media && file && (
                      <p className="px-4 py-3 text-xs text-muted-foreground">PPT 내장 영상 확인 중…</p>
                    )}
                    {embeddedVideos.length === 0 && libraryVideos.length === 0 && !mediaLoading && (
                      <p className="px-4 py-3 text-xs text-muted-foreground leading-relaxed">
                        담을 영상이 없습니다. “로컬 파일”을 열거나 라이브러리에 mp4를 업로드하세요.
                      </p>
                    )}
                  </div>
                </div>
              </>
            ) : (
              /* ── 음악 패널 ─────────────────────────────── */
              <>
                <div className="px-4 py-3 border-b border-border flex items-center justify-between shrink-0">
                  <span className="text-sm font-semibold flex items-center gap-2">
                    <ListMusic className="w-4 h-4 text-success" /> 재생목록
                  </span>
                  <button
                    onClick={playNextMusic}
                    disabled={musicQueue.length === 0}
                    className="flex items-center gap-1 rounded-lg bg-success-soft text-success px-2.5 py-1.5 text-xs font-semibold hover:brightness-95 disabled:opacity-40 disabled:bg-secondary disabled:text-muted-foreground transition"
                  >
                    <SkipForward className="w-3.5 h-3.5" /> 다음
                  </button>
                </div>

                {/* 현재 재생 트랜스포트 */}
                {playingMusicId && (
                  <div className="px-4 py-2.5 border-b border-border flex items-center gap-2 bg-success-soft shrink-0">
                    <Music className="w-4 h-4 text-success shrink-0" />
                    <span className="text-xs text-foreground/80 flex-1 truncate">
                      {musicQueue.find((m) => m.id === playingMusicId)?.label}
                    </span>
                    <button
                      onClick={toggleMusic}
                      className="w-7 h-7 rounded-md flex items-center justify-center text-success hover:bg-card transition-colors"
                    >
                      {musicPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={stopMusic}
                      className="w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-card transition-colors"
                    >
                      <Square className="w-4 h-4" />
                    </button>
                  </div>
                )}

                {/* 큐 — DnD 순서 변경 */}
                <div className="flex-1 min-h-0 overflow-y-auto p-2">
                  {musicQueue.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center gap-2 py-10 px-4 text-muted-foreground">
                      <ListMusic className="w-8 h-8 opacity-30" />
                      <p className="text-sm font-medium">재생목록이 비어 있어요</p>
                      <p className="text-xs">아래 라이브러리에서 음악을 담아보세요</p>
                    </div>
                  ) : (
                    <SortablePlaylist
                      items={musicQueue}
                      onReorder={setMusicQueue}
                      renderItem={(item) => {
                        const active = playingMusicId === item.id
                        return (
                          <div
                            className={`flex items-center gap-2 pr-1 rounded-lg transition-colors ${
                              active ? 'bg-success-soft' : 'hover:bg-secondary'
                            }`}
                          >
                            <button
                              onClick={() => playMusic(item)}
                              className="w-8 h-8 shrink-0 rounded-lg flex items-center justify-center text-success hover:bg-card transition-colors"
                              title="재생"
                            >
                              {active && !musicPaused ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                            </button>
                            <div className="min-w-0 flex-1 py-1.5">
                              <p className="text-sm truncate leading-tight">{item.label}</p>
                              {item.size > 0 && (
                                <p className="text-xs text-muted-foreground tabular-nums">{formatBytes(item.size)}</p>
                              )}
                            </div>
                            <button
                              onClick={() => removeMusic(item.id)}
                              className="shrink-0 text-muted-foreground/50 hover:text-destructive p-1.5 rounded-md hover:bg-card transition-colors"
                              title="목록에서 제거"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        )
                      }}
                    />
                  )}
                </div>

                {/* 소스에서 추가: R2 라이브러리 mp3 */}
                <div className="border-t border-border shrink-0 flex flex-col max-h-[46%]">
                  <div className="px-4 py-2 flex items-center justify-between shrink-0">
                    <p className="text-xs font-semibold text-muted-foreground">
                      라이브러리 음악{musicLibrary.length > 0 ? ` · ${musicLibrary.length}` : ''}
                    </p>
                    <button
                      onClick={() => void refreshMedia()}
                      disabled={mediaLoading}
                      className="text-xs text-primary font-semibold hover:underline disabled:opacity-40"
                    >
                      새로고침
                    </button>
                  </div>

                  <div className="overflow-y-auto border-t border-border">
                    {musicLibrary.map((m) => {
                      const added = inMusicQueue(musicItemId(m))
                      return (
                        <div key={m.key} className="flex items-center gap-3 px-4 py-2 hover:bg-secondary/60 transition-colors">
                          <div className="w-8 h-8 rounded-lg bg-success-soft flex items-center justify-center shrink-0">
                            <Music className="w-4 h-4 text-success" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm truncate leading-tight">{m.name}</p>
                            {m.size > 0 && (
                              <p className="text-xs text-muted-foreground tabular-nums">{formatBytes(m.size)}</p>
                            )}
                          </div>
                          <AddButton added={added} tone="success" onClick={() => addMusic(musicItemFromLibrary(m))} />
                        </div>
                      )
                    })}
                    {mediaLoading && musicLibrary.length === 0 && (
                      <p className="px-4 py-3 text-xs text-muted-foreground">음악 불러오는 중…</p>
                    )}
                    {mediaError && <p className="px-4 py-3 text-xs text-destructive">{mediaError}</p>}
                    {!mediaLoading && !mediaError && musicLibrary.length === 0 && (
                      <p className="px-4 py-3 text-xs text-muted-foreground leading-relaxed">
                        업로드된 음악(mp3)이 없습니다. 라이브러리에서 먼저 업로드하세요.
                      </p>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </aside>
      </div>
    </div>
  )
}

/** 소스 항목을 재생목록에 담는 + 버튼. 이미 담긴 항목은 비활성. */
function AddButton({
  added,
  tone,
  onClick,
}: {
  added: boolean
  tone: 'info' | 'success'
  onClick: () => void
}) {
  const toneClass = tone === 'info' ? 'text-info hover:bg-info-soft' : 'text-success hover:bg-success-soft'
  return (
    <button
      onClick={onClick}
      disabled={added}
      className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-colors disabled:opacity-30 disabled:hover:bg-transparent ${toneClass}`}
      title={added ? '이미 담김' : '재생목록에 담기'}
    >
      <Plus className="w-4 h-4" />
    </button>
  )
}
