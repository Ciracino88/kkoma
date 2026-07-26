import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Film, Maximize, Minimize } from 'lucide-react'
import { useDeck } from './useDeck'
import { usePresentChannel, type OutputMode, type PresentMsg } from './channel'

/**
 * 1스크린 — 대중이 보는 출력 창. 컨트롤 UI 없음.
 * 모드(ppt/video)에 따라 슬라이드 또는 영상 전체화면을 보여준다.
 * 슬라이드 이동·영상 재생·음악(오디오)은 조작 창(BroadcastChannel)의 지시대로 수행.
 */
export default function OutputScreen() {
  const stageRef = useRef<HTMLDivElement>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  // 로컬 파일로 만든 Blob URL 은 재생이 끝나면 해제해야 누수가 없다.
  const blobUrlRef = useRef<string | null>(null)

  const [file, setFile] = useState<File | null>(null)
  const [mode, setMode] = useState<OutputMode>('ppt')
  const [video, setVideo] = useState<{ url: string; label: string } | null>(null)

  const deck = useDeck(file, stageRef)

  const revokeBlob = useCallback(() => {
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current)
      blobUrlRef.current = null
    }
  }, [])

  const onMessage = useCallback(
    async (msg: PresentMsg) => {
      switch (msg.type) {
        case 'DECK':
          revokeBlob()
          setVideo(null)
          setMode('ppt')
          setFile(msg.file)
          break
        case 'GOTO':
          deck.goTo(msg.index)
          break
        case 'MODE':
          setMode(msg.mode)
          break
        case 'VIDEO_PLAY': {
          // PPT 내장 영상 (출력 창 자기 deck 에서 추출)
          const ref = deck.media?.all.find((v) => v.path === msg.path)
          if (ref) {
            revokeBlob()
            setVideo({ url: await ref.getUrl(), label: ref.name })
            setMode('video')
          }
          break
        }
        case 'VIDEO_PLAY_URL': {
          // R2 라이브러리 영상 (URL 은 창 간 유효)
          revokeBlob()
          setVideo({ url: msg.url, label: msg.label })
          setMode('video')
          break
        }
        case 'VIDEO_PLAY_FILE': {
          // 로컬 영상 파일 (구조화 복제로 전달됨 → 이 창에서 Blob URL 생성)
          revokeBlob()
          const url = URL.createObjectURL(msg.file)
          blobUrlRef.current = url
          setVideo({ url, label: msg.label })
          setMode('video')
          break
        }
        case 'VIDEO_STOP':
          revokeBlob()
          setVideo(null)
          break
        case 'MUSIC_PLAY': {
          if (audioRef.current) {
            audioRef.current.src = msg.url
            void audioRef.current.play()
          }
          break
        }
        case 'MUSIC_PAUSE':
          audioRef.current?.pause()
          break
        case 'MUSIC_RESUME':
          void audioRef.current?.play()
          break
        case 'MUSIC_STOP':
          if (audioRef.current) {
            audioRef.current.pause()
            audioRef.current.removeAttribute('src')
          }
          break
      }
    },
    [deck, revokeBlob],
  )

  const post = usePresentChannel(onMessage)

  // 출력 창이 열리면 조작 창에 현재 상태 재전송 요청
  useEffect(() => {
    post({ type: 'HELLO' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 언마운트 시 Blob URL 정리
  useEffect(() => revokeBlob, [revokeBlob])

  // 슬라이드를 원본 크기로 렌더한 뒤, 화면에 꽉 차도록 직접 스케일한다(레터박스).
  // 렌더러의 fitMode('contain'=너비 맞춤)에 의존하지 않아 창 비율과 무관하게 정확.
  const hasSize = deck.slideWidth > 0 && deck.slideHeight > 0
  const [scale, setScale] = useState(1)
  useLayoutEffect(() => {
    if (!hasSize) return
    const compute = () =>
      setScale(
        Math.min(window.innerWidth / deck.slideWidth, window.innerHeight / deck.slideHeight),
      )
    compute()
    window.addEventListener('resize', compute)
    return () => window.removeEventListener('resize', compute)
  }, [hasSize, deck.slideWidth, deck.slideHeight])

  // 전체화면(프로젝터 송출용). Fullscreen API 는 이 창의 사용자 제스처로만 호출 가능.
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [showFsBtn, setShowFsBtn] = useState(true)
  const hideTimerRef = useRef<number | null>(null)

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => {})
    } else {
      void document.documentElement.requestFullscreen().catch(() => {})
    }
  }, [])

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', onFsChange)
    return () => document.removeEventListener('fullscreenchange', onFsChange)
  }, [])

  // 관객 화면이므로 전체화면 버튼은 마우스가 멈추면 자동으로 숨긴다.
  useEffect(() => {
    const reveal = () => {
      setShowFsBtn(true)
      if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current)
      hideTimerRef.current = window.setTimeout(() => setShowFsBtn(false), 2500)
    }
    reveal()
    window.addEventListener('mousemove', reveal)
    return () => {
      window.removeEventListener('mousemove', reveal)
      if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current)
    }
  }, [])

  const showSlides = mode === 'ppt'

  return (
    <div className="relative h-screen w-screen bg-black text-white overflow-hidden">
      {!file && mode === 'ppt' && (
        <div className="absolute inset-0 flex items-center justify-center text-center text-white/50">
          <div>
            <p className="text-xl">출력 창 · 연결됨</p>
            <p className="text-sm mt-2">조작 창에서 PPT를 열면 여기에 표시됩니다</p>
          </div>
        </div>
      )}

      {/* 슬라이드 스테이지: 원본 크기로 렌더 → 중앙에서 scale 로 화면 채움 */}
      <div
        ref={stageRef}
        style={{
          display: file && !deck.error && showSlides ? 'block' : 'none',
          position: 'absolute',
          left: '50%',
          top: '50%',
          width: deck.slideWidth || '100vw',
          transform: `translate(-50%, -50%) scale(${scale})`,
          transformOrigin: 'center center',
        }}
      />

      {deck.error && showSlides && (
        <div className="absolute inset-0 flex items-center justify-center text-destructive text-sm">
          {deck.error}
        </div>
      )}

      {/* 영상 모드 전체화면 */}
      {mode === 'video' && (
        <div className="fixed inset-0 z-50 bg-black flex items-center justify-center">
          {video ? (
            <video src={video.url} autoPlay controls className="w-full h-full object-contain" />
          ) : (
            <div className="text-center text-white/40">
              <Film className="w-16 h-16 mx-auto mb-4" />
              <p className="text-lg">영상 모드 · 재생 대기</p>
              <p className="text-sm mt-1">조작 창에서 영상을 선택하세요</p>
            </div>
          )}
        </div>
      )}

      {/* 전체화면 토글 (마우스 멈추면 자동 숨김) */}
      <button
        onClick={toggleFullscreen}
        title={isFullscreen ? '전체화면 나가기 (Esc)' : '전체화면'}
        className={`fixed top-4 right-4 z-[70] flex items-center gap-2 rounded-lg bg-white/10 hover:bg-white/25 backdrop-blur px-3 py-2 text-sm text-white/90 transition-opacity ${
          showFsBtn ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
        {isFullscreen ? '나가기' : '전체화면'}
      </button>

      {/* 음악 (숨김) */}
      <audio ref={audioRef} />
    </div>
  )
}
