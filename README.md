# kkoma

**Vercel + Cloudflare R2** 기반 mp3 · mp4 업로드 / 재생 / 다운로드 웹사이트.

- **프론트엔드**: React + TypeScript + Vite + Tailwind v4 (Vercel 정적 호스팅)
- **백엔드**: Vercel 서버리스 함수 (`api/`)
- **저장소**: Cloudflare R2 (S3 호환 API로 접근)
- 큰 파일(최대 5GB)은 브라우저가 **presigned URL** 로 R2 에 직접 업로드/다운로드 → 서버리스 함수로 대용량 트래픽이 지나가지 않음

## 아키텍처

```
브라우저 ─(1) POST /api/presign──▶ Vercel 함수 ─서명─▶ presigned PUT URL
        ─(2) PUT 파일───────────────────────────────▶ R2 (직접 업로드)
        ─(3) GET /api/files─────────▶ Vercel 함수 ─list─▶ R2 (목록)
        ─(4) GET /api/file?key=─────▶ Vercel 함수 ─302─▶ presigned GET URL ─▶ R2 (재생/다운로드)
```

| 메서드 | 경로 | 설명 |
| --- | --- | --- |
| `POST` | `/api/presign` | `{filename, size}` → presigned 업로드 URL (mp3/mp4, ≤5GB) |
| `GET` | `/api/files` | 업로드된 파일 목록 (S3 ListObjectsV2) |
| `GET` | `/api/file?key=<key>` | presigned GET 으로 302 리다이렉트 (재생, Range 지원) |
| `GET` | `/api/file?key=<key>&download=1` | 첨부파일 다운로드 |
| `DELETE` | `/api/file?key=<key>` | 삭제 |

> ⚠️ 인증이 없는 **완전 공개** 앱입니다.

---

## 사전 준비 (Cloudflare R2)

1. R2 버킷 `kkoma` 생성 (다른 이름을 쓰면 `R2_BUCKET_NAME` 함께 변경)
2. **Account API 토큰** 발급 (R2 → *Manage R2 API Tokens*, 권한 `Object Read & Write`) → Access Key ID / Secret 확보
3. R2 버킷 **CORS 허용** (브라우저 직접 업로드에 필수). 대시보드(R2 → 버킷 → Settings → CORS Policy)에 아래 추가하거나 `npm run setup-cors` 실행:
   ```json
   [
     {
       "AllowedOrigins": ["*"],
       "AllowedMethods": ["PUT", "GET", "HEAD"],
       "AllowedHeaders": ["content-type"],
       "ExposeHeaders": ["ETag"],
       "MaxAgeSeconds": 3600
     }
   ]
   ```

## 환경변수

`.env.example` 을 복사해 `.env.local` 을 만들고 값을 채웁니다 (로컬 전용, 커밋 안 됨).
**Vercel 프로젝트 설정 → Environment Variables** 에도 동일하게 등록하세요.

| 변수 | 설명 |
| --- | --- |
| `R2_ACCOUNT_ID` | Cloudflare 계정 ID |
| `R2_BUCKET_NAME` | R2 버킷 이름 (`kkoma`) |
| `R2_ACCESS_KEY_ID` | R2 API 토큰의 Access Key ID |
| `R2_SECRET_ACCESS_KEY` | R2 API 토큰의 Secret Access Key |

## 로컬 개발

```bash
npm install
cp .env.example .env.local     # 값 채우기
npm run dev                    # http://localhost:5173 (프론트엔드)
```

> 프론트엔드만 볼 때는 `npm run dev` (Vite). `/api` 함수까지 로컬에서 돌리려면
> `npm i -g vercel && vercel dev` 를 사용하세요.

## 배포

### 방법 A — Vercel Git 연동 (가장 간단)
Vercel 대시보드에서 이 GitHub 저장소를 Import → 환경변수 등록 → 이후 `main` push 시 자동 배포.

### 방법 B — GitHub Actions (`.github/workflows/deploy.yml`)
`main` push 시 Actions 가 Vercel CLI 로 배포합니다. GitHub 저장소 Secrets 에 등록 필요:

| Secret | 얻는 곳 |
| --- | --- |
| `VERCEL_TOKEN` | Vercel → Account Settings → Tokens |
| `VERCEL_ORG_ID` | `vercel link` 후 `.vercel/project.json` 의 `orgId` |
| `VERCEL_PROJECT_ID` | 같은 파일의 `projectId` |

> 방법 A와 B를 동시에 쓰면 중복 배포됩니다. Actions 를 쓰려면 Vercel 프로젝트 설정에서
> Git 자동 배포를 꺼두세요.

## 스크립트

| 명령 | 설명 |
| --- | --- |
| `npm run dev` | 로컬 개발 서버 (Vite) |
| `npm run build` | 타입체크 + 프로덕션 빌드 |
| `npm run setup-cors [origin]` | R2 버킷 CORS 규칙 설정 |
| `npm run lint` | ESLint |

## 파일 구조

```
api/
├─ _lib.ts          R2(S3 호환) 공용 헬퍼
├─ presign.ts       presigned 업로드 URL 발급
├─ files.ts         파일 목록 (ListObjectsV2)
└─ file.ts          재생/다운로드(302 리다이렉트) · 삭제
src/
├─ App.tsx          상태 오케스트레이션
├─ lib.ts           API 클라이언트 + 업로드(진행률)
├─ hooks/           useMediaLibrary · useUploads · useToast
└─ components/       Header · StatCards · UploadDropzone · Toolbar · FileTable · FileRow 등
```
