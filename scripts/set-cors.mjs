// R2 버킷에 CORS 규칙을 설정합니다.
// 브라우저가 presigned URL 로 R2 에 "직접" 업로드(PUT)하려면 버킷에 CORS 허용이 필요합니다.
//
// 사용법:
//   node scripts/set-cors.mjs                 # 모든 origin(*) 허용
//   node scripts/set-cors.mjs https://내도메인.com   # 특정 origin 만 허용
//
// 자격증명은 .dev.vars 또는 환경변수에서 읽습니다:
//   R2_ACCOUNT_ID, R2_BUCKET_NAME, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY

import crypto from 'node:crypto'
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { AwsClient } from 'aws4fetch'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

/** .dev.vars (KEY=VALUE 형식) 파싱 */
function loadDevVars() {
  const p = join(root, '.dev.vars')
  const out = {}
  if (!existsSync(p)) return out
  for (const line of readFileSync(p, 'utf8').split('\n')) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line)
    if (!m) continue
    let v = m[2].trim()
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1)
    }
    out[m[1]] = v
  }
  return out
}

/** wrangler.jsonc 의 vars 에서 값 추출 (주석 제거 후 정규식) */
function loadWranglerVars() {
  const p = join(root, 'wrangler.jsonc')
  const out = {}
  if (!existsSync(p)) return out
  const text = readFileSync(p, 'utf8').replace(/\/\/.*$/gm, '')
  for (const key of ['R2_ACCOUNT_ID', 'R2_BUCKET_NAME']) {
    const m = new RegExp(`"${key}"\\s*:\\s*"([^"]*)"`).exec(text)
    if (m && m[1]) out[key] = m[1]
  }
  return out
}

const devVars = loadDevVars()
const wranglerVars = loadWranglerVars()
const cfg = { ...wranglerVars, ...devVars, ...process.env }

const accountId = cfg.R2_ACCOUNT_ID
const bucket = cfg.R2_BUCKET_NAME
const accessKeyId = cfg.R2_ACCESS_KEY_ID
const secretAccessKey = cfg.R2_SECRET_ACCESS_KEY

const missing = Object.entries({
  R2_ACCOUNT_ID: accountId,
  R2_BUCKET_NAME: bucket,
  R2_ACCESS_KEY_ID: accessKeyId,
  R2_SECRET_ACCESS_KEY: secretAccessKey,
})
  .filter(([, v]) => !v)
  .map(([k]) => k)

if (missing.length) {
  console.error(`❌ 다음 값이 없습니다: ${missing.join(', ')}`)
  console.error('   .dev.vars 와 wrangler.jsonc(R2_ACCOUNT_ID) 를 확인하세요.')
  process.exit(1)
}

const origin = process.argv[2] || '*'

const corsXml =
  `<?xml version="1.0" encoding="UTF-8"?>` +
  `<CORSConfiguration>` +
  `<CORSRule>` +
  `<AllowedOrigin>${origin}</AllowedOrigin>` +
  `<AllowedMethod>PUT</AllowedMethod>` +
  `<AllowedMethod>GET</AllowedMethod>` +
  `<AllowedMethod>HEAD</AllowedMethod>` +
  `<AllowedHeader>*</AllowedHeader>` +
  `<ExposeHeader>ETag</ExposeHeader>` +
  `<MaxAgeSeconds>3600</MaxAgeSeconds>` +
  `</CORSRule>` +
  `</CORSConfiguration>`

const client = new AwsClient({
  accessKeyId,
  secretAccessKey,
  service: 's3',
  region: 'auto',
})

const url = `https://${accountId}.r2.cloudflarestorage.com/${bucket}?cors`
const contentMd5 = crypto.createHash('md5').update(corsXml).digest('base64')

const res = await client.fetch(url, {
  method: 'PUT',
  headers: {
    'Content-Type': 'application/xml',
    'Content-MD5': contentMd5,
  },
  body: corsXml,
})

if (res.ok) {
  console.log(`✅ 버킷 '${bucket}' 에 CORS 설정 완료 (허용 origin: ${origin})`)
} else {
  console.error(`❌ CORS 설정 실패: ${res.status} ${res.statusText}`)
  console.error(await res.text())
  process.exit(1)
}
