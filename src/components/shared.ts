export type Filter = 'all' | 'mp3' | 'mp4'

/**
 * 파일 유형별 시각 토큰.
 * mp3(audio) = success(초록), mp4(video) = info(파랑).
 * 색상은 전부 디자인 토큰으로만 참조한다 (docs/DESIGN_SYSTEM.md).
 */
export const mediaStyle = {
  audio: { icon: 'text-success', soft: 'bg-success-soft', chip: 'bg-success-soft text-success' },
  video: { icon: 'text-info', soft: 'bg-info-soft', chip: 'bg-info-soft text-info' },
} as const

export function mediaKind(isVideo: boolean): 'audio' | 'video' {
  return isVideo ? 'video' : 'audio'
}
