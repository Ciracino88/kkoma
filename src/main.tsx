import { StrictMode, Suspense, lazy, useSyncExternalStore } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// 예배 모드는 pptx 렌더러(대용량)를 쓰므로 지연 로딩 — 라이브러리 화면은 가볍게 유지.
const ControlScreen = lazy(() => import('./present/ControlScreen.tsx'))
const OutputScreen = lazy(() => import('./present/OutputScreen.tsx'))
// ffmpeg.wasm(대용량)을 쓰므로 지연 로딩.
const ConvertScreen = lazy(() => import('./convert/ConvertScreen.tsx'))

// 가벼운 해시 라우팅:
//   #present-output → 1스크린(대중용 출력)
//   #present        → 2스크린(조작)
//   #convert        → mp4 → mp3 변환
//   그 외           → 파일 라이브러리
function subscribe(cb: () => void) {
  window.addEventListener('hashchange', cb)
  return () => window.removeEventListener('hashchange', cb)
}
function Root() {
  const hash = useSyncExternalStore(subscribe, () => window.location.hash)
  const fallback = <div className="min-h-screen bg-background" />
  if (hash.startsWith('#present-output')) {
    return <Suspense fallback={fallback}><OutputScreen /></Suspense>
  }
  if (hash.startsWith('#present')) {
    return <Suspense fallback={fallback}><ControlScreen /></Suspense>
  }
  if (hash.startsWith('#convert')) {
    return <Suspense fallback={fallback}><ConvertScreen /></Suspense>
  }
  return <App />
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
