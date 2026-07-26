# 프로젝트 현황 (Project Status)

> **목적**: 세션이 바뀌어도 이 문서 하나만 읽으면 프로젝트의 현재 상태·구조·다음 할 일을 파악할 수 있도록 유지하는 인수인계 문서입니다.
> **갱신 규칙**: 의미 있는 변경(기능 추가, 구조 변경, 배포 방식 변경, 미결 이슈 해결)을 할 때마다 아래 "변경 로그"와 관련 섹션을 갱신하세요.
>
> **마지막 갱신**: 2026-07-26 — 예배 출력 개선(전체화면 채움·로컬/R2 영상·PPT/영상 모드·다음 슬라이드) + 파일 삭제 확인 다이얼로그

---

## 0. 배경 & 목표 (왜 만드는가) — ⭐ 중요

**kkoma의 실제 목적은 교회 예배용 웹 프레젠테이션 컨트롤러다.** 현재 코드(파일 업로드/저장소)는 그 기반일 뿐, 최종 형태가 아니다.

운영 맥락:
- 교회가 **투 스크린 체제**로 예배 운영.
- 기본은 **PPT로 슬라이드**를 넘기다가, 특정 파트에서 **영상 재생**(주로 찬양·율동)이 필요.
- 영상은 **주차별 재생목록**으로 관리. PPT는 말씀 본문이 매주 바뀌어 **주마다 다른 파일**을 받음.

원하는 기능:
1. 그 주 PPT를 받아 **이 웹사이트에서 슬라이드를 띄우고 조작**.
2. 슬라이드 진행 중 **플로팅 버튼으로 영상 플레이어를 오버레이로 열고/닫기** (매번 창 여닫는 번거로움 제거).

추가 제약(2026-07-23 확인):
- **투 스크린 = 같은 PC + 2번째 모니터/프로젝터** (조작=1번 화면, 송출=2번 화면 전체화면). 네트워크 동기화 불필요.
- **PPT는 저장 불필요 · 휘발성 처리.** PPT는 그 주에 1번 쓰고 폐기, 재사용 없음 → **R2에 저장하지 않음.** 매주 로컬 PPT 파일을 열어 **띄우고 재생**하는 것까지만 하면 됨. 업로드/저장/서버 변환 인프라가 PPT엔 불필요 → **브라우저 내(클라이언트) 처리로 끝낼 수 있음**(백엔드 없이 File API로 읽기).
- **PPT 안 임베드 영상은 자동으로 플로팅 플레이어에 연결 가능**(무손실). 실증: 샘플 「3과 예배 PPT」(15슬라이드, 579MB, 애니메이션/전환 없음, 영상 slide2/3/8 = 47/19/492MB). zip 해제로 영상 추출 + `slideN.xml.rels` 파싱으로 슬라이드↔영상 매핑 모두 자동.
- **남은 핵심 난제는 "슬라이드를 브라우저에서 렌더링"** — 영상 처리와 별개. 클라이언트 사이드 pptx 렌더링 피델리티가 관건(단, 실제 덱은 정적 이미지+텍스트라 애니메이션 부담은 낮음).

> 시사점: 저장 백엔드(R2)는 수단이며 병목이 아니다. 핵심 개발 과제는 **① 브라우저 PPT 렌더링·슬라이드 제어(임베드 영상/애니메이션 포함) ② 투 스크린 프레젠테이션 ③ 플로팅 영상 오버레이 + 주차별 재생목록**.

📐 **설계 + 구현 현황**: [docs/design/presentation-controller.md](design/presentation-controller.md). Phase 0~2 구현·**배포 완료**(Vercel Git). 코드: `src/present/` (`ControlScreen`·`OutputScreen`·`channel`·`useDeck`·`pptx`), 해시 라우트 `#present`(조작)·`#present-output`(출력).

> **다음 세션 시작점**: 설계 문서 §14 "남은 작업/후속" 참고 — 영상 종료 후 자동 슬라이드 복귀, 조작 창 전체 슬라이드 썸네일 레일, 대형 영상(469MB) 이중 파싱 메모리 최적화. 실제 예배 환경 렌더 피델리티·메모리는 사용자 검증 중. (2026-07-26 추가: 출력 전체화면 채움 수정, 로컬/R2 영상 재생, PPT/영상 모드 토글, 다음 슬라이드 미리보기.)

## 1. 한 줄 요약 (현재 구현 기준)

`kkoma` — **인증 없는 공개** mp3·mp4 업로드 / 재생 / 다운로드 웹사이트 (§0 목표로 진화 중).
브라우저가 presigned URL로 **Cloudflare R2에 직접** 업로드/다운로드하고, Vercel 서버리스 함수는 서명 발급·목록·삭제만 담당한다 (대용량 트래픽이 함수를 통과하지 않음).

## 2. 기술 스택

| 영역 | 기술 |
| --- | --- |
| 프론트엔드 | React 19 + TypeScript + Vite 8 + Tailwind v4 |
| 백엔드 | Vercel 서버리스 함수 (`api/`, `@vercel/node`) |
| 저장소 | Cloudflare R2 (S3 호환 API, `aws4fetch`로 서명) |
| 아이콘 | `lucide-react` |
| 호스팅 | Vercel (정적 + 서버리스) |
| CI/CD | GitHub Actions (`.github/workflows/deploy.yml`) 또는 Vercel Git 연동 |

## 3. 아키텍처

```
브라우저 ─(1) POST /api/presign──▶ Vercel 함수 ─서명─▶ presigned PUT URL
        ─(2) PUT 파일───────────────────────────────▶ R2 (직접 업로드, XHR 진행률)
        ─(3) GET /api/files─────────▶ Vercel 함수 ─list─▶ R2 (목록)
        ─(4) GET /api/file?key=─────▶ Vercel 함수 ─302─▶ presigned GET URL ─▶ R2 (재생/다운로드)
        ─(5) DELETE /api/file?key=──▶ Vercel 함수 ────▶ R2 (삭제)
```

**핵심 설계 결정**
- 파일은 서버리스 함수를 거치지 않고 브라우저 ↔ R2 직접 전송 → 함수 대역폭/실행시간 제약 회피, 최대 5GB(single PUT 상한).
- 업로드 키는 `<timestamp>-<8hex>-<sanitized-name>` 형태. 표시할 땐 `displayName()`이 접두어를 벗겨 원본 파일명 복원.
- 재생/다운로드는 함수가 302로 presigned GET URL에 리다이렉트 → Range 요청(구간 재생) R2가 직접 처리.

## 4. API 엔드포인트

| 메서드 | 경로 | 설명 | 파일 |
| --- | --- | --- | --- |
| `POST` | `/api/presign` | `{filename, size}` → presigned 업로드 URL. mp3/mp4·≤5GB 검증 | [api/presign.ts](../api/presign.ts) |
| `GET` | `/api/files` | 업로드 목록 (S3 ListObjectsV2) | [api/files.ts](../api/files.ts) |
| `GET` | `/api/file?key=` | presigned GET으로 302 (재생, Range 지원) | [api/file.ts](../api/file.ts) |
| `GET` | `/api/file?key=&download=1` | 첨부파일 다운로드 | [api/file.ts](../api/file.ts) |
| `DELETE` | `/api/file?key=` | 삭제 | [api/file.ts](../api/file.ts) |

공용 R2/S3 헬퍼는 [api/_lib.ts](../api/_lib.ts) (`getEnv`, `createClient`, `sanitizeName`, `displayName`, `ALLOWED_TYPES`, `MAX_SIZE`).

## 5. 프론트엔드 구조

```
src/
├─ App.tsx              상태 오케스트레이션 (검색·필터·선택·재생 상태)
├─ lib.ts               API 클라이언트 + presign→PUT 업로드(진행률) + 포맷 유틸
├─ hooks/
│  ├─ useMediaLibrary   파일 목록 로드/새로고침/삭제
│  ├─ useUploads        업로드 큐 + 진행률
│  └─ useToast          토스트 알림
├─ components/
│  ├─ Header            상단 바 (스토리지 사용량, 네이버 밴드 링크, 업로드 버튼)
│  ├─ StatCards         전체/mp3/mp4 개수 카드
│  ├─ UploadDropzone    드래그&드롭 존
│  ├─ UploadList        진행 중 업로드 목록
│  ├─ Toolbar           검색·필터·새로고침·선택삭제
│  ├─ FileTable/FileRow 파일 목록 테이블 (인라인 재생 포함)
│  ├─ DragOverlay       전체 화면 드롭 오버레이
│  ├─ Toast             토스트 UI
│  ├─ ConfirmDialog     위험 동작(삭제 등) 확인 모달
│  └─ shared.ts         공용 타입 (Filter 등)
└─ theme.css            디자인 토큰(색상 변수 등)
```

## 5.1 디자인 시스템

임시방편 스타일을 걷어내고 **Wanted Design System 기반 토큰 체계**로 표준화함. 기준 문서는 [docs/DESIGN_SYSTEM.md](DESIGN_SYSTEM.md).

- **서체**: Pretendard 단일 서체([src/index.css](../src/index.css) CDN 로드). 숫자 정렬은 `tabular-nums`.
- **색상**: 2단계 토큰(Reference→Semantic). Primary `#0066FF`. 모든 컬러는 [src/theme.css](../src/theme.css)의 CSS 변수 → Tailwind `@theme` 유틸리티로 연결. 컴포넌트는 `bg-card`·`text-success`·`bg-destructive-soft` 등 의미 토큰만 사용.
- **폰트 크기**: 확정 9단계 — 13(최소)·15(본문)·18·20·24·28·32·36·40(최대). Tailwind `text-*`가 이 스케일로 재정의되어 스케일 밖 크기가 나오지 않음.
- **파일 유형 색**: MP3=success(green)·MP4=info(blue)·전체=accent(violet), [shared.ts](../src/components/shared.ts)의 `mediaStyle`로 고정.
- 전 컴포넌트(Header·StatCards·Toolbar·FileTable·FileRow·UploadList·Toast·DragOverlay)를 토큰 기준으로 리팩터링 완료.

## 6. 배포 & 환경

**환경변수** (`.env.local` 로컬 + Vercel Environment Variables 둘 다 등록 필요):

| 변수 | 설명 |
| --- | --- |
| `R2_ACCOUNT_ID` | Cloudflare 계정 ID |
| `R2_BUCKET_NAME` | R2 버킷 이름 (기본 `kkoma`) |
| `R2_ACCESS_KEY_ID` | R2 API 토큰 Access Key ID |
| `R2_SECRET_ACCESS_KEY` | R2 API 토큰 Secret |

**배포 경로 (둘 중 하나 선택 — 동시 사용 시 중복 배포)**
- 방법 A: Vercel Git 연동 (대시보드 Import 후 `main` push 자동 배포).
- 방법 B: GitHub Actions `deploy.yml` (`main` push 시 Vercel CLI 배포). Secrets: `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`.

**R2 사전 준비**: 버킷 생성 → Object Read&Write API 토큰 → CORS 허용(`npm run setup-cors` 또는 대시보드). 브라우저 직접 업로드에 CORS 필수.

**명령어**
```bash
npm run dev          # Vite 개발 서버 (프론트만; /api는 vercel dev 필요)
npm run build        # tsc -b + vite build
npm run lint         # ESLint
npm run setup-cors   # R2 CORS 규칙 설정
```

## 7. 개발 히스토리 (변경 로그)

| 커밋 | 내용 |
| --- | --- |
| `b2685e2` | **feat(present): 출력 창 개선** — 전체화면 채움 수정·로컬/R2 영상 재생·PPT/영상 모드 토글·다음 슬라이드 미리보기 |
| `00d3f12` | feat: 파일 삭제 확인 다이얼로그 추가 (개별/선택 삭제 전 확인 모달) |
| `0e7d3f3` | feat(convert): 변환 페이지 상단 설명을 검색바로 교체 |
| `e9b2fa8` | feat(convert): mp4 → mp3 변환 페이지 추가 (ffmpeg.wasm 브라우저 변환) |
| `89a5ec9` | feat(present): 예배 음악 목록을 R2 라이브러리에서 선택하도록 전환 |
| `7840e8d` | feat(present): 투 스크린 예배 컨트롤러 구현 (Phase 0~2) |
| `1ba9321` | feat: Wanted Design System 기반 디자인 토큰 체계 도입 |
| `8d141ea` | 헤더에 네이버 밴드 링크 라벨 추가 (스토리지 라벨 좌측) |
| `ae59489` | fix: Vercel ESM 런타임에서 api 함수 모듈 해석 오류 수정 |
| `4d1a175` | **Cloudflare Worker → Vercel + R2(S3 API) 배포 구조 전환** (worker/·wrangler 제거, api/·vercel.json 도입) |
| `4f35a0f` | README 헤더 포맷 수정 |
| `cbd0bc6` | 최초 구현 (당시 Cloudflare Worker + R2 기반) |

> 다음 세션에서 커밋을 추가하면 위 표 맨 위에 한 줄 추가하고 "마지막 갱신" 날짜/커밋을 바꿔주세요.

## 8. 현재 상태 & 알려진 특성

- ✅ 기능 완성도: 업로드(진행률)·목록·검색/필터·인라인 재생·단일/일괄 삭제·다운로드 모두 동작하는 MVP 상태.
- ⚠️ **인증 없음** — 누구나 업로드/삭제 가능한 완전 공개 앱. 의도된 설계.
- ⚠️ 업로드 상한 5GB (single PUT). 그 이상은 멀티파트 업로드 미구현.
- ℹ️ 파일 타입은 확장자 mp3/mp4로만 제한 (`ALLOWED_TYPES`).

## 9. 다음 후보 작업 (Backlog)

> 확정된 로드맵이 아니라 참고용 후보 목록. 착수 시 이 문서에 상태를 기록하세요.

- [ ] 접근 제어/비밀번호 등 최소 인증 (공개 앱 리스크 완화)
- [ ] 5GB 초과 파일용 멀티파트 업로드
- [x] 삭제/일괄삭제 확인 다이얼로그 (`00d3f12`)
- [ ] 목록 페이지네이션 (ListObjectsV2 continuation token)
- [ ] 자동화 테스트 (현재 테스트 없음)
