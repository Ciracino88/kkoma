import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient, displayName, getEnv, objectUrl } from './_lib'

/**
 * GET  /api/file?key=<key>            → presigned GET 으로 302 리다이렉트 (재생/스트리밍, Range 지원)
 * GET  /api/file?key=<key>&download=1 → 첨부파일로 다운로드
 * DELETE /api/file?key=<key>          → 삭제
 *
 * 대용량 미디어가 Vercel 함수를 거치지 않고 브라우저 ↔ R2 로 직접 전송되도록 리다이렉트 방식 사용.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const keyParam = req.query.key
  const key = Array.isArray(keyParam) ? keyParam[0] : keyParam
  if (!key) {
    res.status(400).json({ error: '키가 필요합니다.' })
    return
  }

  try {
    const env = getEnv()
    const client = createClient(env)

    if (req.method === 'GET') {
      const download = req.query.download === '1'
      const url = new URL(objectUrl(env, key))
      url.searchParams.set('X-Amz-Expires', '21600') // 6시간
      if (download) {
        url.searchParams.set(
          'response-content-disposition',
          `attachment; filename="${displayName(key)}"`,
        )
      }
      const signed = await client.sign(url.toString(), {
        method: 'GET',
        aws: { signQuery: true },
      })
      res.redirect(302, signed.url)
      return
    }

    if (req.method === 'DELETE') {
      const r = await client.fetch(objectUrl(env, key), { method: 'DELETE' })
      if (!r.ok && r.status !== 404) {
        throw new Error(`삭제 실패 (${r.status})`)
      }
      res.status(204).end()
      return
    }

    res.status(405).json({ error: 'Method Not Allowed' })
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : String(e) })
  }
}
