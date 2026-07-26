// 예배 조작 창 재생목록(수동 큐) 아이템 타입 & 헬퍼.
// 영상은 세 소스(PPT 내장 · R2 라이브러리 · 로컬 파일)를 하나의 목록으로 합치고,
// 음악은 R2 라이브러리 mp3 만 담는다. 각 아이템의 id 는 @dnd-kit 정렬 키이자 중복 판별 키.
import type { MediaFile } from '../lib'
import { fileUrl } from '../lib'
import type { VideoRef } from './pptx'

/** 영상 아이템의 재생 소스. 출력 창으로 보낼 채널 메시지 종류를 결정한다. */
export type VideoSource =
  | { kind: 'embedded'; path: string; slideIndex: number } // PPT 내장 → 출력 창 자기 deck 에서 추출
  | { kind: 'library'; url: string } // R2 라이브러리 (URL 은 창 간 유효)
  | { kind: 'local'; file: File } // 로컬 파일 (구조화 복제)

export interface VideoItem {
  id: string
  label: string
  size: number
  source: VideoSource
}

export interface MusicItem {
  id: string
  label: string
  size: number
  url: string
}

/** 소스별 안정적 id. 같은 소스는 같은 id → 재생목록 중복 추가 방지. */
export const embeddedId = (v: VideoRef) => `emb:${v.path}`
export const libraryVideoId = (m: MediaFile) => `libv:${m.key}`
export const musicItemId = (m: MediaFile) => `mus:${m.key}`

/** 로컬 파일은 같은 파일도 여러 번 담을 수 있어 매번 고유 id 를 발급한다. */
function uniqueId(prefix: string): string {
  const rand = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`
  return `${prefix}:${rand}`
}

export function videoItemFromEmbedded(v: VideoRef): VideoItem {
  return {
    id: embeddedId(v),
    label: v.name,
    size: v.sizeBytes,
    source: { kind: 'embedded', path: v.path, slideIndex: v.slideIndex },
  }
}

export function videoItemFromLibrary(m: MediaFile): VideoItem {
  return {
    id: libraryVideoId(m),
    label: m.name,
    size: m.size,
    source: { kind: 'library', url: fileUrl(m.key) },
  }
}

export function videoItemFromLocal(f: File): VideoItem {
  return { id: uniqueId('local'), label: f.name, size: f.size, source: { kind: 'local', file: f } }
}

export function musicItemFromLibrary(m: MediaFile): MusicItem {
  return { id: musicItemId(m), label: m.name, size: m.size, url: fileUrl(m.key) }
}
