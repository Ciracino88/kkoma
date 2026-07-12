import type { VercelRequest, VercelResponse } from '@vercel/node'
import { bucketUrl, createClient, displayName, extOf, getEnv } from './_lib'

const CONTENT_TYPES: Record<string, string> = {
  mp3: 'audio/mpeg',
  mp4: 'video/mp4',
}

/** ListObjectsV2 XML 응답에서 객체 목록 파싱 */
function parseObjects(xml: string): { key: string; size: number; uploaded: string }[] {
  const objects: { key: string; size: number; uploaded: string }[] = []
  const re = /<Contents>([\s\S]*?)<\/Contents>/g
  let m: RegExpExecArray | null
  while ((m = re.exec(xml))) {
    const block = m[1]
    const key = /<Key>([\s\S]*?)<\/Key>/.exec(block)?.[1]
    if (!key) continue
    const size = Number(/<Size>(\d+)<\/Size>/.exec(block)?.[1] ?? '0')
    const uploaded = /<LastModified>([\s\S]*?)<\/LastModified>/.exec(block)?.[1] ?? ''
    objects.push({ key: decodeXml(key), size, uploaded })
  }
  return objects
}

function decodeXml(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
}

/** GET /api/files — 업로드된 파일 목록 (R2 S3 ListObjectsV2) */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method Not Allowed' })
    return
  }

  try {
    const env = getEnv()
    const client = createClient(env)
    const listUrl = `${bucketUrl(env)}?list-type=2&max-keys=1000`
    const r = await client.fetch(listUrl)
    if (!r.ok) {
      throw new Error(`R2 목록 조회 실패 (${r.status})`)
    }
    const xml = await r.text()

    const files = parseObjects(xml)
      .map((o) => ({
        key: o.key,
        name: displayName(o.key),
        size: o.size,
        uploaded: o.uploaded,
        contentType: CONTENT_TYPES[extOf(o.key)] ?? '',
      }))
      .sort((a, b) => +new Date(b.uploaded) - +new Date(a.uploaded))

    res.json({ files })
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : String(e) })
  }
}
