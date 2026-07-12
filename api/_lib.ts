// Vercel 서버리스 함수 공용 R2(S3 호환) 헬퍼
import { AwsClient } from 'aws4fetch'

/** 업로드 허용 확장자 → 정규 MIME 타입 */
export const ALLOWED_TYPES: Record<string, string> = {
  mp3: 'audio/mpeg',
  mp4: 'video/mp4',
}

/** single PUT presigned 업로드 상한 (S3 호환 5GiB) */
export const MAX_SIZE = 5 * 1024 * 1024 * 1024

export interface R2Env {
  accountId: string
  bucket: string
  accessKeyId: string
  secretAccessKey: string
}

/** 환경변수에서 R2 설정 로드 (없으면 예외) */
export function getEnv(): R2Env {
  const accountId = process.env.R2_ACCOUNT_ID
  const bucket = process.env.R2_BUCKET_NAME
  const accessKeyId = process.env.R2_ACCESS_KEY_ID
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY
  if (!accountId || !bucket || !accessKeyId || !secretAccessKey) {
    throw new Error(
      'R2 환경변수가 설정되지 않았습니다 (R2_ACCOUNT_ID, R2_BUCKET_NAME, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY).',
    )
  }
  return { accountId, bucket, accessKeyId, secretAccessKey }
}

export function createClient(env: R2Env): AwsClient {
  return new AwsClient({
    accessKeyId: env.accessKeyId,
    secretAccessKey: env.secretAccessKey,
    service: 's3',
    region: 'auto',
  })
}

export function endpoint(env: R2Env): string {
  return `https://${env.accountId}.r2.cloudflarestorage.com`
}

export function bucketUrl(env: R2Env): string {
  return `${endpoint(env)}/${env.bucket}`
}

export function objectUrl(env: R2Env, key: string): string {
  return `${bucketUrl(env)}/${encodeURIComponent(key)}`
}

/** 파일명을 R2 키에 안전한 형태로 정리 */
export function sanitizeName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? name
  const safe = base
    .normalize('NFC')
    .replace(/[^\w.\-가-힣]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^[._]+/, '')
  return safe.slice(-120) || 'file'
}

export function extOf(name: string): string {
  const m = /\.([a-zA-Z0-9]+)$/.exec(name)
  return m ? m[1].toLowerCase() : ''
}

/** 키에서 업로드 시 붙인 `<timestamp>-<rand>-` 접두어를 제거해 원본 파일명 복원 */
export function displayName(key: string): string {
  return key.replace(/^\d+-[0-9a-f]{8}-/, '')
}
