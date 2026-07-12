import { randomUUID } from 'node:crypto'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
  ALLOWED_TYPES,
  MAX_SIZE,
  createClient,
  extOf,
  getEnv,
  objectUrl,
  sanitizeName,
} from './_lib.js'

/** POST /api/presign — 브라우저가 R2 로 직접 업로드할 presigned PUT URL 발급 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed' })
    return
  }

  try {
    const env = getEnv()

    const body: unknown = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
    const { filename, size } = (body ?? {}) as { filename?: string; size?: number }

    const name = (filename ?? '').trim()
    const bytes = Number(size ?? 0)
    if (!name) {
      res.status(400).json({ error: '파일명이 필요합니다.' })
      return
    }

    const contentType = ALLOWED_TYPES[extOf(name)]
    if (!contentType) {
      res.status(400).json({ error: 'mp3 또는 mp4 파일만 업로드할 수 있습니다.' })
      return
    }
    if (!Number.isFinite(bytes) || bytes <= 0) {
      res.status(400).json({ error: '유효한 파일 크기가 필요합니다.' })
      return
    }
    if (bytes > MAX_SIZE) {
      res.status(400).json({ error: '파일이 너무 큽니다. 최대 5GB 까지 업로드할 수 있습니다.' })
      return
    }

    const key = `${Date.now()}-${randomUUID().slice(0, 8)}-${sanitizeName(name)}`

    const client = createClient(env)
    const url = new URL(objectUrl(env, key))
    url.searchParams.set('X-Amz-Expires', '3600')

    const signed = await client.sign(url.toString(), {
      method: 'PUT',
      headers: { 'content-type': contentType },
      aws: { signQuery: true },
    })

    res.json({
      key,
      uploadUrl: signed.url,
      // 브라우저가 PUT 시 반드시 이 헤더를 그대로 보내야 서명이 일치함
      headers: { 'content-type': contentType },
    })
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : String(e) })
  }
}
