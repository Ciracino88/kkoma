# kkoma

Cloudflare **Workers + R2** 기반 mp3 · mp4 업로드 / 재생 / 다운로드 웹사이트.

- **프론트엔드**: React + TypeScript + Vite
- **백엔드**: Cloudflare Worker (`worker/index.ts`)
- **저장소**: Cloudflare R2
- 큰 파일(최대 5GB)은 브라우저가 **presigned URL** 로 R2 에 직접 업로드 → Worker 100MB 요청 제한 우회
- 다운로드 / 재생은 Worker 가 R2 에서 **스트리밍(Range 지원)** 으로 제공

## 아키텍처

```
브라우저 ──(1) POST /api/presign──▶ Worker ──서명──▶ presigned PUT URL
        ──(2) PUT 파일──────────────────────────▶ R2 (직접 업로드)
        ──(3) GET /api/files────────▶ Worker ──list──▶ R2   (목록)
        ──(4) GET /api/file/<key>───▶ Worker ──get───▶ R2   (스트리밍/다운로드)
```

| 메서드 | 경로 | 설명 |
| --- | --- | --- |
| `POST` | `/api/presign` | `{filename, size}` → presigned 업로드 URL 발급 (mp3/mp4, ≤5GB) |
| `GET` | `/api/files` | 업로드된 파일 목록 |
| `GET` | `/api/file/<key>` | 스트리밍 재생 (Range 지원) |
| `GET` | `/api/file/<key>?download=1` | 첨부파일 다운로드 |
| `DELETE` | `/api/file/<key>` | 삭제 |

> ⚠️ 현재 인증이 없는 **완전 공개** 앱입니다. 누구나 업로드/다운로드/삭제할 수 있습니다.

---

## 사전 준비 (Cloudflare)

1. **R2 버킷 생성**
   - 대시보드 → R2 → *Create bucket* → 이름 `kkoma`
     (다른 이름을 쓰려면 `wrangler.jsonc` 의 `bucket_name` 과 `R2_BUCKET_NAME` 을 함께 수정)

2. **Account ID 확인**
   - R2 개요 페이지의 *Account ID* 를 복사해 `wrangler.jsonc` 의 `vars.R2_ACCOUNT_ID` 에 입력

3. **R2 API 토큰(S3 자격증명) 생성**
   - R2 → *Manage R2 API Tokens* → *Create API Token* (권한: Object Read & Write)
   - 발급된 **Access Key ID / Secret Access Key** 를 아래에서 사용

---

## 로컬 개발

```bash
npm install

# 시크릿 설정
cp .dev.vars.example .dev.vars
#  .dev.vars 에 R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY 입력

# R2 버킷 CORS 허용 (브라우저 직접 업로드에 필수, 최초 1회)
npm run setup-cors                    # 모든 origin 허용 (*)
# 또는 특정 origin 만:  npm run setup-cors https://내도메인.com

npm run dev                           # http://localhost:5173
```

### 로컬 개발 시 주의
presigned 업로드는 **항상 실제 R2 버킷**으로 전송됩니다. 반면 목록/다운로드에 쓰이는
`MEDIA_BUCKET` 바인딩은 기본적으로 **로컬 시뮬레이션 버킷**을 바라봅니다. 따라서 로컬에서
업로드한 파일이 목록에 안 보일 수 있습니다.

실제 버킷으로 끝까지 테스트하려면 배포(`npm run deploy`) 후 확인하는 것을 권장합니다.

---

## 배포

```bash
# 프로덕션 시크릿 등록 (최초 1회)
npx wrangler secret put R2_ACCESS_KEY_ID
npx wrangler secret put R2_SECRET_ACCESS_KEY

# CORS 아직 안 했다면
npm run setup-cors

# 빌드 + 배포
npm run deploy
```

배포 후 출력되는 `*.workers.dev` URL 에서 앱을 사용할 수 있습니다.

## 스크립트

| 명령 | 설명 |
| --- | --- |
| `npm run dev` | 로컬 개발 서버 (Vite + Worker) |
| `npm run build` | 타입체크 + 프로덕션 빌드 |
| `npm run deploy` | 빌드 후 Cloudflare 에 배포 |
| `npm run setup-cors [origin]` | R2 버킷 CORS 규칙 설정 |
| `npm run cf-typegen` | Worker 타입 정의 생성 |
| `npm run lint` | ESLint |

## 파일 구조

```
worker/index.ts      Worker: presign / list / stream / delete + 정적자산 서빙
src/App.tsx          업로드·목록·재생·삭제 UI
src/lib.ts           API 클라이언트 + 업로드(진행률) 로직
scripts/set-cors.mjs R2 버킷 CORS 설정 스크립트
wrangler.jsonc       Worker / R2 바인딩 / vars 설정
```
