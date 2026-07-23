import { Search, Trash2 } from 'lucide-react'
import type { Filter } from './shared'

interface ToolbarProps {
  search: string
  onSearch: (v: string) => void
  filter: Filter
  onFilter: (f: Filter) => void
  onRefresh: () => void
  selectedCount: number
  onDeleteSelected: () => void
}

const FILTERS: Filter[] = ['all', 'mp3', 'mp4']

/** 검색 · 필터 · 새로고침 · 선택 삭제 툴바 */
export function Toolbar({
  search,
  onSearch,
  filter,
  onFilter,
  onRefresh,
  selectedCount,
  onDeleteSelected,
}: ToolbarProps) {
  return (
    <div className="flex items-center gap-3 mb-4 flex-wrap">
      <div className="flex-1 relative min-w-48">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="파일 검색..."
          className="w-full bg-card border border-border rounded-xl pl-10 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/10 transition-all"
        />
      </div>

      <div className="flex items-center gap-1 bg-card border border-border rounded-xl p-1">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => onFilter(f)}
            className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              filter === f
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {f === 'all' ? '전체' : f.toUpperCase()}
          </button>
        ))}
      </div>

      <button
        onClick={onRefresh}
        className="px-4 py-2.5 text-xs font-semibold rounded-xl bg-card border border-border text-muted-foreground hover:text-foreground transition-colors"
      >
        새로고침
      </button>

      {selectedCount > 0 && (
        <button
          onClick={onDeleteSelected}
          className="flex items-center gap-2 bg-destructive-soft border border-destructive/20 text-destructive px-4 py-2.5 text-xs font-semibold rounded-xl hover:bg-destructive/15 transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
          {selectedCount}개 삭제
        </button>
      )}
    </div>
  )
}
