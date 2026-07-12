export interface MediaFile {
  key: string
  name: string
  size: number
  uploaded: string
  contentType: string
}

const ALLOWED_EXT = ['mp3', 'mp4']

export function isAllowedFile(file: File): boolean {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  return ALLOWED_EXT.includes(ext)
}

export function isVideo(file: Pick<MediaFile, 'name' | 'contentType'>): boolean {
  return (
    file.contentType.startsWith('video/') ||
    file.name.toLowerCase().endsWith('.mp4')
  )
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB', 'TB']
  let n = bytes / 1024
  let i = 0
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024
    i++
  }
  return `${n.toFixed(n < 10 ? 1 : 0)} ${units[i]}`
}

export function formatDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

async function readError(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as { error?: string }
    if (data.error) return data.error
  } catch {
    /* ignore */
  }
  return `요청 실패 (${res.status})`
}

export async function listFiles(): Promise<MediaFile[]> {
  const res = await fetch('/api/files')
  if (!res.ok) throw new Error(await readError(res))
  const data = (await res.json()) as { files: MediaFile[] }
  return data.files
}

export async function deleteFile(key: string): Promise<void> {
  const res = await fetch(`/api/file?key=${encodeURIComponent(key)}`, {
    method: 'DELETE',
  })
  if (!res.ok && res.status !== 204) throw new Error(await readError(res))
}

interface PresignResponse {
  key: string
  uploadUrl: string
  headers: Record<string, string>
}

/**
 * presigned URL 을 발급받아 R2 로 직접 업로드한다.
 * onProgress: 0~1 사이 진행률 콜백.
 */
export async function uploadFile(
  file: File,
  onProgress: (fraction: number) => void,
  signal?: AbortSignal,
): Promise<void> {
  const presignRes = await fetch('/api/presign', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ filename: file.name, size: file.size }),
    signal,
  })
  if (!presignRes.ok) throw new Error(await readError(presignRes))
  const { uploadUrl, headers } = (await presignRes.json()) as PresignResponse

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', uploadUrl)
    for (const [k, v] of Object.entries(headers)) {
      xhr.setRequestHeader(k, v)
    }
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(e.loaded / e.total)
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress(1)
        resolve()
      } else {
        reject(new Error(`업로드 실패 (${xhr.status})`))
      }
    }
    xhr.onerror = () =>
      reject(
        new Error('업로드 네트워크 오류 — R2 버킷 CORS 설정을 확인하세요.'),
      )
    xhr.onabort = () => reject(new DOMException('취소됨', 'AbortError'))
    if (signal) {
      signal.addEventListener('abort', () => xhr.abort(), { once: true })
    }
    xhr.send(file)
  })
}

export function fileUrl(key: string, download = false): string {
  const base = `/api/file?key=${encodeURIComponent(key)}`
  return download ? `${base}&download=1` : base
}
