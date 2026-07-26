import { useCallback, useEffect, useRef, useState } from 'react'
import { PptxViewer } from '@aiden0z/pptx-renderer'
import { extractDeckMedia, type DeckMedia } from './pptx'

export interface DeckState {
  slideCount: number
  current: number
  ready: boolean
  error: string | null
  media: DeckMedia | null
  /** 슬라이드 원본 픽셀 크기 (비율 계산용) */
  slideWidth: number
  slideHeight: number
}

/**
 * 주어진 File 을 containerRef 에 슬라이드로 렌더(@aiden0z/pptx-renderer) + 영상 추출(JSZip).
 * 출력 창(전체 렌더)과 조작 창(미리보기) 양쪽에서 공용으로 쓴다.
 */
export function useDeck(file: File | null, containerRef: React.RefObject<HTMLDivElement | null>) {
  const viewerRef = useRef<PptxViewer | null>(null)
  const [state, setState] = useState<DeckState>({
    slideCount: 0,
    current: 0,
    ready: false,
    error: null,
    media: null,
    slideWidth: 0,
    slideHeight: 0,
  })

  useEffect(() => {
    const container = containerRef.current
    if (!file || !container) return
    let disposed = false
    let viewer: PptxViewer | null = null
    let media: DeckMedia | null = null

    setState({ slideCount: 0, current: 0, ready: false, error: null, media: null, slideWidth: 0, slideHeight: 0 })
    ;(async () => {
      try {
        const buf = await file.arrayBuffer()
        viewer = await PptxViewer.open(buf, container, {
          renderMode: 'slide',
          fitMode: 'contain',
          lazyMedia: true,
          lazySlides: true,
          pdfjs: false,
          onSlideChange: (i) => !disposed && setState((s) => ({ ...s, current: i })),
        })
        if (disposed) return viewer.destroy()
        viewerRef.current = viewer
        setState((s) => ({
          ...s,
          slideCount: viewer!.slideCount,
          current: viewer!.currentSlideIndex,
          ready: true,
          slideWidth: viewer!.slideWidth,
          slideHeight: viewer!.slideHeight,
        }))

        media = await extractDeckMedia(buf)
        if (disposed) return media.dispose()
        setState((s) => ({ ...s, media }))
      } catch (e) {
        if (!disposed) setState((s) => ({ ...s, error: e instanceof Error ? e.message : String(e) }))
      }
    })()

    return () => {
      disposed = true
      viewer?.destroy()
      viewerRef.current = null
      media?.dispose()
    }
    // containerRef 는 안정적 ref
  }, [file, containerRef])

  const goTo = useCallback((index: number) => {
    const v = viewerRef.current
    if (!v) return
    void v.goToSlide(Math.min(Math.max(0, index), v.slideCount - 1))
  }, [])

  /**
   * 임의 슬라이드를 외부 컨테이너에 썸네일로 렌더(미리보기용).
   * 반환된 핸들은 호출자가 dispose 해야 한다.
   */
  const renderThumb = useCallback((index: number, container: HTMLElement) => {
    const v = viewerRef.current
    if (!v || index < 0 || index >= v.slideCount) return null
    return v.renderThumbnailToContainer(index, container, {
      width: container.clientWidth || 320,
    })
  }, [])

  return { ...state, goTo, renderThumb }
}
