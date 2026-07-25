import { useCallback, useEffect, useRef, useState } from 'react'
import { Play } from 'lucide-react'
import { useDeck } from './useDeck'
import { usePresentChannel, type PresentMsg } from './channel'

/**
 * 1스크린 — 대중이 보는 출력 창. 컨트롤 UI 없음.
 * PPT 슬라이드 렌더 + 영상 오버레이 + 음악(오디오) 재생을 조작 창(BroadcastChannel)의 지시대로 수행.
 */
export default function OutputScreen() {
  const stageRef = useRef<HTMLDivElement>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  const musicUrlRef = useRef<string | null>(null)

  const [file, setFile] = useState<File | null>(null)
  const [video, setVideo] = useState<{ url: string; label: string } | null>(null)

  const deck = useDeck(file, stageRef)

  // 현재 슬라이드에 임베드 영상이 있으면, 렌더러의 어색한 'Video' 자리표시자를
  // 대중이 보지 않도록 깔끔한 홀딩 화면으로 덮는다(영상 재생 전까지).
  const isVideoSlide = !!deck.media?.bySlide.has(deck.current)

  const onMessage = useCallback(
    async (msg: PresentMsg) => {
      switch (msg.type) {
        case 'DECK':
          setVideo(null)
          setFile(msg.file)
          break
        case 'GOTO':
          deck.goTo(msg.index)
          break
        case 'VIDEO_PLAY': {
          const ref = deck.media?.all.find((v) => v.path === msg.path)
          if (ref) setVideo({ url: await ref.getUrl(), label: ref.name })
          break
        }
        case 'VIDEO_STOP':
          setVideo(null)
          break
        case 'MUSIC_PLAY': {
          if (musicUrlRef.current) URL.revokeObjectURL(musicUrlRef.current)
          const url = URL.createObjectURL(msg.file)
          musicUrlRef.current = url
          if (audioRef.current) {
            audioRef.current.src = url
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
    [deck],
  )

  const post = usePresentChannel(onMessage)

  // 출력 창이 열리면 조작 창에 현재 상태 재전송 요청
  useEffect(() => {
    post({ type: 'HELLO' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    return () => {
      if (musicUrlRef.current) URL.revokeObjectURL(musicUrlRef.current)
    }
  }, [])

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center overflow-hidden">
      {!file && (
        <div className="text-center text-white/50">
          <p className="text-xl">출력 창 · 연결됨</p>
          <p className="text-sm mt-2">조작 창에서 PPT를 열면 여기에 표시됩니다</p>
        </div>
      )}

      {/* 슬라이드 스테이지 (전체 화면) */}
      <div
        ref={stageRef}
        className="w-full h-screen [&>*]:!h-full [&_*]:!max-h-full flex items-center justify-center"
        style={{ display: file && !deck.error ? 'flex' : 'none' }}
      />

      {deck.error && <div className="text-destructive text-sm">{deck.error}</div>}

      {/* 영상 슬라이드 홀딩 화면 (영상 재생 전, 자리표시자 가리기) */}
      {isVideoSlide && !video && (
        <div className="fixed inset-0 z-40 bg-black flex items-center justify-center">
          <div className="w-24 h-24 rounded-full border border-white/20 flex items-center justify-center">
            <Play className="w-10 h-10 text-white/40" fill="currentColor" />
          </div>
        </div>
      )}

      {/* 영상 오버레이 */}
      {video && (
        <div className="fixed inset-0 z-50 bg-black flex items-center justify-center">
          <video src={video.url} autoPlay controls className="w-full h-full object-contain" />
        </div>
      )}

      {/* 음악 (숨김) */}
      <audio ref={audioRef} />
    </div>
  )
}
