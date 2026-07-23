# kkoma 디자인 시스템

> 이 프로젝트의 **디자인 기준(single source of truth)**. 색상·타이포·형태는 모두 여기서 정의한 토큰으로만 표현한다.
> 구현 파일: [src/theme.css](../src/theme.css) · 서체 로드: [src/index.css](../src/index.css)
>
> **기반**: [Wanted Design System (Community)](https://www.figma.com/community) — 색상/서체/위계 체계를 참조.
> **마지막 갱신**: 2026-07-23

---

## 0. 원칙

1. **토큰만 사용한다.** 컴포넌트에서 `#hex`, `bg-white`, `text-emerald-500` 같은 임의 색을 쓰지 않는다. 아래 표의 의미 토큰(`bg-card`, `text-success` 등)만 쓴다.
2. **크기는 정해진 스케일 밖으로 나가지 않는다.** 폰트 크기는 §1의 9단계, radius/여백은 §3 스케일만 사용한다.
3. **의미로 고른다.** 파랑이라서 `primary`가 아니라 "주요 액션이라서" `primary`. 초록이라서가 아니라 "오디오라서" `success`.

---

## 1. 타이포그래피

- **서체**: `Pretendard` **단일 서체**. 모든 텍스트·숫자에 사용한다. 숫자 정렬이 필요한 곳(카운트·크기·%·날짜)에는 별도 서체 대신 `tabular-nums`(고정폭 숫자) 유틸리티를 붙인다.
- **크기 스케일 (프로젝트 확정 9단계)** — 이 밖의 크기는 쓰지 않는다:

| 역할 | px | rem | Tailwind | 용도 |
| --- | --- | --- | --- | --- |
| caption | **13** (최소) | 0.8125 | `text-xs` | 메타(날짜·크기), 배지, 캡션 |
| body | **15** (기본) | 0.9375 | `text-sm` / `text-base` | 본문, 버튼, 라벨 |
| — | 18 | 1.125 | `text-lg` | 강조 본문, 로고 |
| — | 20 | 1.25 | `text-xl` | 소제목 |
| — | 24 | 1.5 | `text-2xl` | 섹션 제목 |
| — | 28 | 1.75 | `text-3xl` | 통계 수치, 카드 헤드라인 |
| — | 32 | 2 | `text-4xl` | 페이지 제목 |
| — | 36 | 2.25 | `text-5xl` | 디스플레이 |
| — | 40 (최대) | 2.5 | `text-6xl` | 최대 디스플레이 |

> Tailwind `text-*` 유틸리티는 [theme.css](../src/theme.css)에서 위 스케일로 **재정의**되어 있어, 어떤 `text-*`를 써도 9단계 밖의 크기는 나오지 않는다. 14·16px 등은 스케일에 없다.

- **굵기**: Regular 400 · Medium 500 · SemiBold 600 · Bold 700 (`--weight-*`).
- **행간**: 작은 텍스트(13~18) 1.5 / 중간(20~28) 1.35~1.45 / 큰 디스플레이(32~40) 1.2~1.3. 각 크기에 기본 line-height가 묶여 있다.

---

## 2. 색상

2단계 구조: **Reference(원시 팔레트)** → **Semantic(의미 토큰)**. 컴포넌트는 Semantic만 사용한다.
`[C]` = Figma에서 확정한 값 · `[D]` = 확정값에서 파생.

### 2.1 Reference (원시 — 직접 쓰지 말 것)

| 토큰 | Hex | 비고 |
| --- | --- | --- |
| common-0 / 100 | `#000000` / `#FFFFFF` | [C] 검정 / 흰색 |
| blue-60 / 55 / 50 | `#0066FF` / `#005EEB` / `#0054D1` | [C] Primary normal/strong/heavy |
| gray-5 | `#F7F7F8` | [C] 배경 alternative |
| gray-20 | `#DBDCDF` | [C] coolNeutral-95 (경계선) |
| gray-40 | `#989BA2` | [C] inactive |
| gray-60 | `#70737C` | [C] fill-strong / 보조 텍스트 |
| gray-99 | `#171719` | [C] label-normal (본문 텍스트) |
| violet-60 / 95 | `#6541F2` / `#F0ECFE` | [C] accent / accent-soft |
| green-50 | `#00BF40` | [C] status-positive |
| red-50 | `#FF4242` | [C] status-negative |

### 2.2 Semantic (컴포넌트에서 사용)

| 의미 토큰 | Tailwind | 값 | 용도 |
| --- | --- | --- | --- |
| background | `bg-background` | `#F7F7F8` | 페이지 배경 |
| foreground | `text-foreground` | `#171719` | 기본 텍스트 |
| card | `bg-card` | `#FFFFFF` | 카드/패널/입력 표면 |
| muted-foreground | `text-muted-foreground` | `#70737C` | 보조 텍스트 |
| border | `border-border` | `#DBDCDF` | 경계선/구분선 |
| **primary** | `bg-primary` `text-primary` | `#0066FF` | 주요 액션, 링크, 선택 |
| primary-foreground | `text-primary-foreground` | `#FFFFFF` | primary 위 텍스트 |
| primary-soft | `bg-primary-soft` | `#E6F0FF` | primary 연한 배경 |
| secondary | `bg-secondary` | `#F2F3F5` | 보조 칩/표면 |
| **accent** | `text-accent` `bg-accent-soft` | `#6541F2` / `#F0ECFE` | 강조(전체 파일 등) |
| **success** | `text-success` `bg-success-soft` | `#00BF40` / `#E4F8EC` | 성공 · MP3(오디오) |
| **info** | `text-info` `bg-info-soft` | `#0066FF` / `#E6F0FF` | 정보 · MP4(비디오) |
| warning | `bg-warning-soft` | `#FF9200` / `#FFF1E0` | 주의 |
| **destructive** | `text-destructive` `bg-destructive-soft` | `#FF4242` / `#FFECEC` | 삭제·에러 |

### 2.3 파일 유형 색상 매핑 (규칙)

| 유형 | 토큰 | 근거 |
| --- | --- | --- |
| 전체 파일 | `accent` (violet) | 중립적 강조 |
| MP3 (오디오) | `success` (green) | — |
| MP4 (비디오) | `info` (blue) | — |

> 이 매핑은 [shared.ts](../src/components/shared.ts)의 `mediaStyle`에 코드로 고정되어 있다. StatCards·FileRow·UploadList가 공유한다.

---

## 3. 형태 (Radius · Shadow · 여백)

**Radius** (`--radius` 기준 12px):

| Tailwind | px | 용도 |
| --- | --- | --- |
| `rounded-sm` | 8 | 작은 요소 |
| `rounded-md` | 10 | 배지, 아이콘칩 |
| `rounded-lg` | 12 | 버튼, 입력 |
| `rounded-xl` | 16 | 버튼(큰), 아이콘칩 |
| `rounded-2xl` | 20 | 카드/패널 |
| `rounded-full` | — | 필터칩, 배지 |

**Shadow**: `shadow-sm`(카드 기본) · `shadow-md`(떠 있는 버튼/헤더) · `shadow-lg`(토스트/오버레이). 값은 뉴트럴 그림자(`rgba(23,23,25,…)`).

**여백**: Tailwind 기본 4px 그리드(`p-2`=8, `p-4`=16, `gap-3`=12 …)를 그대로 사용. 8px 리듬 권장.

---

## 4. 사용 규칙 (Do / Don't)

- ✅ `bg-card`, `text-muted-foreground`, `text-success`, `bg-destructive-soft`
- ❌ `bg-white`, `text-gray-500`, `text-emerald-500`, `bg-red-50`, 임의 `#hex`, `style={{color:…}}`
- ✅ 폰트 크기: `text-xs`(13)·`text-sm`(15)·`text-lg`(18)…`text-6xl`(40)
- ❌ `text-[13px]`, `text-base`를 16으로 가정, 스케일 밖 크기
- ✅ 숫자 정렬: Pretendard + `tabular-nums`
- ❌ 숫자에 별도 mono 서체 사용 (프로젝트는 Pretendard 단일 서체)
- 새 색이 필요하면 **먼저 이 문서에 Semantic 토큰을 추가**하고 theme.css에 반영한 뒤 사용한다.

---

## 5. 확장 시 체크리스트

새 컴포넌트/화면을 만들 때:
1. 색은 §2.2 의미 토큰만 쓰는가?
2. 폰트 크기는 §1 스케일 안인가?
3. radius/shadow는 §3 토큰인가?
4. 파일 유형 색이 필요하면 `mediaStyle`을 재사용했는가?
5. 새 토큰을 추가했다면 이 문서와 theme.css를 함께 갱신했는가?
