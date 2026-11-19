import type { PointerEvent as ReactPointerEvent } from 'react'
import type { Note as NoteModel } from '../model/notes.ts'

type NoteStyle = React.CSSProperties & {
  '--rotation': string
}

type NoteProps = {
  note: NoteModel
  selected: boolean
  dragging: boolean
  removing: boolean
  onSelect: (id: string) => void
  onTextChange: (id: string, text: string) => void
  onMovePointerDown: (event: ReactPointerEvent<HTMLElement>, id: string) => void
  onResizePointerDown: (event: ReactPointerEvent<HTMLElement>, id: string) => void
  onPointerMove: (event: ReactPointerEvent<HTMLElement>) => void
  onPointerUp: (event: ReactPointerEvent<HTMLElement>) => void
  onPointerCancel: (event: ReactPointerEvent<HTMLElement>) => void
}

function Note({
  note,
  selected,
  dragging,
  removing,
  onSelect,
  onTextChange,
  onMovePointerDown,
  onResizePointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
}: NoteProps) {
  const className = [
    'note',
    selected ? 'is-selected' : '',
    dragging ? 'is-dragging' : '',
    removing ? 'is-removing' : '',
  ]
    .filter(Boolean)
    .join(' ')

  const style: NoteStyle = {
    left: note.x,
    top: note.y,
    width: note.w,
    height: note.h,
    '--rotation': `${note.rotation}deg`,
  }

  return (
    <article
      className={className}
      style={style}
      data-note={note.id}
      data-color={note.color}
      onPointerDown={(event) => onMovePointerDown(event, note.id)}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
    >
      <textarea
        aria-label="Note"
        value={note.text}
        onChange={(event) => onTextChange(note.id, event.target.value)}
        onFocus={() => onSelect(note.id)}
        onPointerDown={(event) => {
          event.stopPropagation()
          onSelect(note.id)
        }}
      />
      <span
        className="note__handle"
        role="button"
        aria-label="Resize note"
        onPointerDown={(event) => onResizePointerDown(event, note.id)}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
      >
        <svg width="12" height="12" viewBox="0 0 12 12">
          <path
            d="M8 11 L11 8 M5 11 L11 5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      </span>
    </article>
  )
}

export default Note
