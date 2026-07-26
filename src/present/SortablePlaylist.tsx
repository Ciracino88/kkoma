// @dnd-kit 기반 세로 정렬 목록. 왼쪽 그립 핸들을 드래그해 순서를 바꾼다.
// 영상/음악 재생목록에서 공용으로 쓰는 프레젠테이션 컴포넌트(도메인 로직 없음).
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical } from 'lucide-react'
import type { ReactNode } from 'react'

interface HasId {
  id: string
}

export function SortablePlaylist<T extends HasId>({
  items,
  onReorder,
  renderItem,
}: {
  items: T[]
  onReorder: (next: T[]) => void
  renderItem: (item: T, index: number) => ReactNode
}) {
  // 살짝 움직여야 드래그 시작 → 재생/삭제 버튼 클릭과 충돌하지 않음.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const from = items.findIndex((i) => i.id === active.id)
    const to = items.findIndex((i) => i.id === over.id)
    if (from >= 0 && to >= 0) onReorder(arrayMove(items, from, to))
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
        {items.map((item, i) => (
          <SortableRow key={item.id} id={item.id}>
            {renderItem(item, i)}
          </SortableRow>
        ))}
      </SortableContext>
    </DndContext>
  )
}

function SortableRow({ id, children }: { id: string; children: ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
        zIndex: isDragging ? 20 : undefined,
        position: 'relative',
      }}
      className="flex items-center gap-1"
    >
      <button
        type="button"
        aria-label="드래그로 순서 변경"
        className="shrink-0 px-0.5 py-2 text-muted-foreground/50 hover:text-foreground cursor-grab active:cursor-grabbing touch-none"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="w-4 h-4" />
      </button>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}
