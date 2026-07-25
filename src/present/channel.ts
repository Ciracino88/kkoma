import { useEffect, useRef } from 'react'

/**
 * 조작 창(2스크린) ↔ 출력 창(1스크린) 동기화 메시지.
 * File/Blob 은 구조화 복제로 창 간 전달 가능(바이트 복사 없이 참조 공유).
 * 단, Blob URL 은 창마다 유효하지 않으므로 항상 원본 File 을 보내고 받는 창에서 URL 을 만든다.
 */
export type PresentMsg =
  | { type: 'DECK'; file: File } // 새 PPT 로드
  | { type: 'GOTO'; index: number } // 슬라이드 이동
  | { type: 'VIDEO_PLAY'; path: string } // 출력 창이 자기 deck 에서 해당 경로 영상 재생
  | { type: 'VIDEO_STOP' }
  | { type: 'MUSIC_PLAY'; url: string; label: string } // R2 파일 URL (창 간 유효)
  | { type: 'MUSIC_PAUSE' }
  | { type: 'MUSIC_RESUME' }
  | { type: 'MUSIC_STOP' }
  | { type: 'HELLO' } // 출력 창이 열렸으니 현재 상태를 재전송해 달라

const CHANNEL_NAME = 'kkoma-present'

/** BroadcastChannel 구독 + 전송 함수 반환. 최신 핸들러를 항상 참조. */
export function usePresentChannel(onMessage?: (msg: PresentMsg) => void) {
  const chRef = useRef<BroadcastChannel | null>(null)
  const handlerRef = useRef(onMessage)
  handlerRef.current = onMessage

  useEffect(() => {
    const ch = new BroadcastChannel(CHANNEL_NAME)
    ch.onmessage = (e) => handlerRef.current?.(e.data as PresentMsg)
    chRef.current = ch
    return () => {
      ch.close()
      chRef.current = null
    }
  }, [])

  return (msg: PresentMsg) => chRef.current?.postMessage(msg)
}
