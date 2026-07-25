// PPT 임베드 영상 추출 + 슬라이드 매핑 (클라이언트, JSZip)
// pptx = zip. 슬라이드 순서는 presentation.xml(sldIdLst)로, 영상은 각 슬라이드
// rels 에서 찾아 ppt/media/*.mp4 를 지연 추출(Blob URL)한다. 무손실.
import JSZip from 'jszip'

export interface VideoRef {
  /** zip 내부 경로 (예: ppt/media/media1.mp4) */
  path: string
  /** 파일명 */
  name: string
  /** 0-based 슬라이드 인덱스 (presentation 순서, PptxViewer 인덱스와 일치) */
  slideIndex: number
  /** 원본 바이트 크기(추정) */
  sizeBytes: number
  /** 지연 추출: 최초 호출 시 Blob URL 생성 후 캐시 */
  getUrl: () => Promise<string>
}

export interface DeckMedia {
  slideCount: number
  /** slideIndex → 해당 슬라이드의 영상들 */
  bySlide: Map<number, VideoRef[]>
  /** 전체 영상(순서: 슬라이드 순) */
  all: VideoRef[]
  /** 생성된 모든 Blob URL 해제 */
  dispose: () => void
}

const VIDEO_RE = /\.(mp4|mov|m4v|webm|avi|wmv)$/i

/** baseFile 기준 상대경로 target 을 zip 절대경로로 해석 */
function resolvePath(baseFile: string, target: string): string {
  const baseDir = baseFile.split('/').slice(0, -1).join('/')
  const out: string[] = []
  for (const part of `${baseDir}/${target}`.split('/')) {
    if (part === '' || part === '.') continue
    if (part === '..') out.pop()
    else out.push(part)
  }
  return out.join('/')
}

function parseXml(text: string): Document {
  return new DOMParser().parseFromString(text, 'application/xml')
}

/** presentation.xml + rels 로 슬라이드 파일 경로를 표시 순서대로 반환 */
async function orderedSlidePaths(zip: JSZip): Promise<string[]> {
  const relsText = await zip.file('ppt/_rels/presentation.xml.rels')?.async('string')
  const presText = await zip.file('ppt/presentation.xml')?.async('string')
  if (!relsText || !presText) return []

  const relTarget = new Map<string, string>() // rId → target
  for (const rel of parseXml(relsText).getElementsByTagName('Relationship')) {
    const id = rel.getAttribute('Id')
    const target = rel.getAttribute('Target')
    if (id && target) relTarget.set(id, target)
  }

  const paths: string[] = []
  for (const sld of parseXml(presText).getElementsByTagName('p:sldId')) {
    const rId = sld.getAttribute('r:id')
    const target = rId && relTarget.get(rId)
    if (target) paths.push(resolvePath('ppt/presentation.xml', target))
  }
  return paths
}

function relsPathFor(slidePath: string): string {
  const dir = slidePath.split('/').slice(0, -1).join('/')
  const base = slidePath.split('/').pop()
  return `${dir}/_rels/${base}.rels`
}

function uncompressedSize(entry: JSZip.JSZipObject | null): number {
  // JSZip 내부 필드(공식 API 아님) — 프로토타입 표시용
  return (entry as unknown as { _data?: { uncompressedSize?: number } })?._data?.uncompressedSize ?? 0
}

export async function extractDeckMedia(file: File | ArrayBuffer): Promise<DeckMedia> {
  const zip = await JSZip.loadAsync(file)
  const slidePaths = await orderedSlidePaths(zip)

  const createdUrls: string[] = []
  const bySlide = new Map<number, VideoRef[]>()
  const all: VideoRef[] = []

  for (let i = 0; i < slidePaths.length; i++) {
    const relsText = await zip.file(relsPathFor(slidePaths[i]))?.async('string')
    if (!relsText) continue

    const seen = new Set<string>()
    for (const rel of parseXml(relsText).getElementsByTagName('Relationship')) {
      const target = rel.getAttribute('Target')
      if (!target || !VIDEO_RE.test(target)) continue
      const path = resolvePath(slidePaths[i], target)
      if (seen.has(path)) continue // video+media 관계 중복 제거
      seen.add(path)

      const entry = zip.file(path)
      if (!entry) continue

      let cached: Promise<string> | null = null
      const ref: VideoRef = {
        path,
        name: path.split('/').pop() ?? path,
        slideIndex: i,
        sizeBytes: uncompressedSize(entry),
        getUrl: () =>
          (cached ??= entry.async('blob').then((blob) => {
            const url = URL.createObjectURL(blob)
            createdUrls.push(url)
            return url
          })),
      }
      all.push(ref)
      bySlide.set(i, [...(bySlide.get(i) ?? []), ref])
    }
  }

  return {
    slideCount: slidePaths.length,
    bySlide,
    all,
    dispose: () => {
      for (const url of createdUrls) URL.revokeObjectURL(url)
      createdUrls.length = 0
    },
  }
}
