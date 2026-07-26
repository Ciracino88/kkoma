import { useCallback, useEffect, useRef, useState } from 'react'
import { Film } from 'lucide-react'
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

  // 슬라이드 원본 비율(가로/세로). 렌더러의 fitMode:'contain'은 "컨테이너 너비"에
  // 맞추므로, 스테이지를 이 비율의 최대 사각형으로 잡아 화면을 꽉 채운다(레터박스).
  const aspect =
    deck.slideWidth > 0 && deck.slideHeight > 0 ? deck.slideWidth / deck.slideHeight : 16 / 9

  const showSlides = mode === 'ppt'

  return (
    <div className="h-screen w-screen bg-black text-white flex items-center justify-center overflow-hidden">
      {!file && mode === 'ppt' && (
        <div className="text-center text-white/50">
          <p className="text-xl">출력 창 · 연결됨</p>
          <p className="text-sm mt-2">조작 창에서 PPT를 열면 여기에 표시됩니다</p>
        </div>
      )}

      {/* 슬라이드 스테이지: 화면 안에 들어가는, 비율 유지 최대 사각형 */}
      <div
        ref={stageRef}
        style={{
          display: file && !deck.error && showSlides ? 'block' : 'none',
          aspectRatio: aspect,
          width: `min(100vw, calc(100vh * ${aspect}))`,
        }}
      />

      {deck.error && showSlides && <div className="text-destructive text-sm">{deck.error}</div>}

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

      {/* 음악 (숨김) */}
      <audio ref={audioRef} />
    </div>
  )
}
