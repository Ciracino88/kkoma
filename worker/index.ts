import { AwsClient } from 'aws4fetch'

export interface Env {
  /** 정적 자산(빌드된 React 앱) 서빙용 바인딩 */
  ASSETS: Fetcher
  /** R2 버킷 바인딩 (다운로드/목록/삭제에 사용) */
  MEDIA_BUCKET: R2Bucket
  /** presigned URL 엔드포인트 구성용 */
  R2_ACCOUNT_ID: string
  R2_BUCKET_NAME: string
  /** S3 호환 API 자격증명 (시크릿) */
  R2_ACCESS_KEY_ID: string
  R2_SECRET_ACCESS_KEY: string
}

/** 업로드 허용 확장자 → 정규 MIME 타입 */
const ALLOWED_TYPES: Record<string, string> = {
  mp3: 'audio/mpeg',
  mp4: 'video/mp4',
}

/** single PUT presigned 업로드 상한 (S3 호환 5GiB) */
const MAX_SIZE = 5 * 1024 * 1024 * 1024

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  })
}

/** 파일명을 R2 키에 안전한 형태로 정리 */
function sanitizeName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? name
  const safe = base
    .normalize('NFC')
    .replace(/[^\w.\-가-힣]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^[._]+/, '')
  return safe.slice(-120) || 'file'
}

function extOf(name: string): string {
  const m = /\.([a-zA-Z0-9]+)$/.exec(name)
  return m ? m[1].toLowerCase() : ''
}

/** POST /api/presign — 브라우저가 R2 로 직접 업로드할 presigned PUT URL 발급 */
async function handlePresign(request: Request, env: Env): Promise<Response> {
  if (!env.R2_ACCOUNT_ID || !env.R2_ACCESS_KEY_ID || !env.R2_SECRET_ACCESS_KEY) {
    return json(
      { error: 'R2 자격증명이 설정되지 않았습니다. .dev.vars / wrangler secret 를 확인하세요.' },
      500,
    )
  }

  let body: { filename?: string; size?: number }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return json({ error: '잘못된 요청 본문입니다.' }, 400)
  }

  const filename = (body.filename ?? '').trim()
  const size = Number(body.size ?? 0)
  if (!filename) return json({ error: '파일명이 필요합니다.' }, 400)

  const ext = extOf(filename)
  const contentType = ALLOWED_TYPES[ext]
  if (!contentType) {
    return json({ error: 'mp3 또는 mp4 파일만 업로드할 수 있습니다.' }, 400)
  }
  if (!Number.isFinite(size) || size <= 0) {
    return json({ error: '유효한 파일 크기가 필요합니다.' }, 400)
  }
  if (size > MAX_SIZE) {
    return json({ error: '파일이 너무 큽니다. 최대 5GB 까지 업로드할 수 있습니다.' }, 400)
  }

  const safeName = sanitizeName(filename)
  const key = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}-${safeName}`

  const client = new AwsClient({
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    service: 's3',
    region: 'auto',
  })

  const endpoint = `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`
  const objectUrl = `${endpoint}/${env.R2_BUCKET_NAME}/${encodeURIComponent(key)}`
  const url = new URL(objectUrl)
  url.searchParams.set('X-Amz-Expires', '3600')
  // 원본 파일명을 R2 커스텀 메타데이터로 저장 (목록에서 표시하기 위함)
  const metaHeader = `x-amz-meta-name`

  const signed = await client.sign(url.toString(), {
    method: 'PUT',
    headers: {
      'content-type': contentType,
      [metaHeader]: encodeURIComponent(safeName),
    },
    aws: { signQuery: true },
  })

  return json({
    key,
    uploadUrl: signed.url,
    // 브라우저가 PUT 시 반드시 아래 헤더들을 그대로 보내야 서명이 일치함
    headers: {
      'content-type': contentType,
      [metaHeader]: encodeURIComponent(safeName),
    },
  })
}

/** GET /api/files — 업로드된 파일 목록 */
async function handleList(env: Env): Promise<Response> {
  const listed = await env.MEDIA_BUCKET.list({
    limit: 1000,
    include: ['httpMetadata', 'customMetadata'],
  })
  const files = listed.objects.map((o) => {
    const rawName = o.customMetadata?.name
    let name = o.key
    if (rawName) {
      try {
        name = decodeURIComponent(rawName)
      } catch {
        name = rawName
      }
    }
    return {
      key: o.key,
      name,
      size: o.size,
      uploaded: o.uploaded,
      contentType: o.httpMetadata?.contentType ?? '',
    }
  })
  files.sort((a, b) => +new Date(b.uploaded) - +new Date(a.uploaded))
  return json({ files })
}

/** GET /api/file/<key> — R2 에서 스트리밍 (Range 지원). download=1 이면 첨부파일로 */
async function handleServe(
  request: Request,
  env: Env,
  key: string,
  download: boolean,
): Promise<Response> {
  const object = await env.MEDIA_BUCKET.get(key, { range: request.headers })
  if (!object) return json({ error: '파일을 찾을 수 없습니다.' }, 404)

  const headers = new Headers()
  object.writeHttpMetadata(headers)
  headers.set('etag', object.httpEtag)
  headers.set('accept-ranges', 'bytes')
  headers.set('cache-control', 'public, max-age=3600')

  const rawName = object.customMetadata?.name
  let name = key
  if (rawName) {
    try {
      name = decodeURIComponent(rawName)
    } catch {
      name = rawName
    }
  }
  if (download) {
    headers.set(
      'content-disposition',
      `attachment; filename*=UTF-8''${encodeURIComponent(name)}`,
    )
  }

  const size = object.size
  const range = object.range
  if (range && request.headers.has('range')) {
    let offset = 0
    let end = size - 1
    if ('suffix' in range) {
      offset = size - range.suffix
    } else {
      offset = range.offset ?? 0
      const length = range.length ?? size - offset
      end = offset + length - 1
    }
    headers.set('content-range', `bytes ${offset}-${end}/${size}`)
    headers.set('content-length', String(end - offset + 1))
    return new Response(object.body, { status: 206, headers })
  }

  headers.set('content-length', String(size))
  return new Response(object.body, { status: 200, headers })
}

/** DELETE /api/file/<key> — 삭제 */
async function handleDelete(env: Env, key: string): Promise<Response> {
  await env.MEDIA_BUCKET.delete(key)
  return new Response(null, { status: 204 })
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    const { pathname } = url

    // ---- API 라우팅 ----
    if (pathname === '/api/presign' && request.method === 'POST') {
      return handlePresign(request, env)
    }
    if (pathname === '/api/files' && request.method === 'GET') {
      return handleList(env)
    }
    if (pathname.startsWith('/api/file/')) {
      const key = decodeURIComponent(pathname.slice('/api/file/'.length))
      if (!key) return json({ error: '키가 필요합니다.' }, 400)
      if (request.method === 'GET') {
        const download = url.searchParams.get('download') === '1'
        return handleServe(request, env, key, download)
      }
      if (request.method === 'DELETE') {
        return handleDelete(env, key)
      }
      return json({ error: 'Method Not Allowed' }, 405)
    }
    if (pathname.startsWith('/api/')) {
      return json({ error: 'Not Found' }, 404)
    }

    // ---- 그 외에는 정적 자산(React SPA) 서빙 ----
    return env.ASSETS.fetch(request)
  },
} satisfies ExportedHandler<Env>
