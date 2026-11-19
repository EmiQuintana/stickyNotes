import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { fetchNotes, persistNotes } from '../api/client.ts'
import NoteCard from '../components/Note.tsx'
import {
  DEFAULT_NOTE_HEIGHT,
  DEFAULT_NOTE_WIDTH,
  MIN_DRAG,
  NOTE_COLORS,
  bringToFront,
  clampNote,
  clampNotes,
  clampPosition,
  createNote,
  draftRect,
  findFreeSpot,
  rectsOverlap,
  resizeNote,
  type Bounds,
  type Note,
  type NoteColor,
  type Rect,
} from '../model/notes.ts'

const REMOVE_MS = 180

type Gesture =
  | {
      kind: 'create'
      pointerId: number
      originX: number
      originY: number
      x: number
      y: number
      w: number
      h: number
      color: NoteColor
    }
  | {
      kind: 'move'
      pointerId: number
      id: string
      startClientX: number
      startClientY: number
      startX: number
      startY: number
      x: number
      y: number
      w: number
      h: number
      moved: boolean
    }
  | {
      kind: 'resize'
      pointerId: number
      id: string
      startClientX: number
      startClientY: number
      startX: number
      startY: number
      startW: number
      startH: number
    }

function pointInCanvas(event: { clientX: number; clientY: number }, canvas: HTMLElement) {
  const box = canvas.getBoundingClientRect()
  return { x: event.clientX - box.left, y: event.clientY - box.top }
}

function capturePointer(event: ReactPointerEvent<HTMLElement>) {
  try {
    event.currentTarget.setPointerCapture(event.pointerId)
  } catch {
    // Capture is best-effort. Tracking still follows the pointer events we receive.
  }
}

function focusNote(id: string) {
  requestAnimationFrame(() => {
    document.querySelector<HTMLTextAreaElement>(`[data-note="${id}"] textarea`)?.focus()
  })
}

function App() {
  const [notes, setNotes] = useState<Note[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [color, setColor] = useState<NoteColor>('yellow')
  const [draft, setDraft] = useState<Rect | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [resizing, setResizing] = useState(false)
  const [trashHot, setTrashHot] = useState(false)
  const [removingIds, setRemovingIds] = useState<string[]>([])

  const canvasRef = useRef<HTMLDivElement>(null)
  const trashRef = useRef<HTMLDivElement>(null)
  const gesture = useRef<Gesture | null>(null)
  const removingRef = useRef(new Set<string>())
  const removeNoteRef = useRef<(id: string) => void>(() => {})
  const loadedRef = useRef(false)

  function canvasBounds(): Bounds | null {
    const canvas = canvasRef.current
    if (!canvas) return null
    const bounds = { width: canvas.clientWidth, height: canvas.clientHeight }
    if (bounds.width === 0 || bounds.height === 0) return null
    return bounds
  }

  function trashRect(): Rect | null {
    const trash = trashRef.current
    if (!trash) return null
    return {
      x: trash.offsetLeft,
      y: trash.offsetTop,
      w: trash.offsetWidth,
      h: trash.offsetHeight,
    }
  }

  function noteHitsTrash(rect: Rect): boolean {
    const target = trashRect()
    if (!target) return false
    return rectsOverlap(rect, target)
  }

  function addNote(note: Note) {
    const bounds = canvasBounds()
    const next = bounds ? clampNote(note, bounds) : note
    setNotes((current) => [...current, next])
    setSelectedId(next.id)
    focusNote(next.id)
  }

  function removeNote(id: string) {
    if (removingRef.current.has(id)) return
    removingRef.current.add(id)
    setRemovingIds(Array.from(removingRef.current))
    window.setTimeout(() => {
      removingRef.current.delete(id)
      setRemovingIds(Array.from(removingRef.current))
      setNotes((current) => current.filter((note) => note.id !== id))
      setSelectedId((current) => (current === id ? null : current))
    }, REMOVE_MS)
  }

  useEffect(() => {
    removeNoteRef.current = removeNote
  })

  useEffect(() => {
    let cancelled = false
    void fetchNotes().then((stored) => {
      if (cancelled) return
      const bounds = canvasBounds()
      setNotes(bounds ? clampNotes(stored, bounds) : stored)
      loadedRef.current = true
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!loadedRef.current) return
    void persistNotes(notes)
  }, [notes])

  useEffect(() => {
    function onResize() {
      const bounds = canvasBounds()
      if (!bounds) return
      setNotes((current) => clampNotes(current, bounds))
    }

    window.addEventListener('resize', onResize)
    onResize()
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Delete' && event.key !== 'Backspace') return
      if (event.metaKey || event.ctrlKey || event.altKey) return
      if (event.target instanceof HTMLTextAreaElement) return
      if (!selectedId) return
      event.preventDefault()
      removeNoteRef.current(selectedId)
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [selectedId])

  useEffect(() => {
    document.body.classList.toggle('is-moving', draggingId !== null)
    document.body.classList.toggle('is-resizing', resizing)
    return () => document.body.classList.remove('is-moving', 'is-resizing')
  }, [draggingId, resizing])

  function clearGesture() {
    gesture.current = null
    setDraggingId(null)
    setResizing(false)
    setTrashHot(false)
    setDraft(null)
  }

  function onCanvasPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return
    if (event.target !== event.currentTarget) return
    const canvas = canvasRef.current
    if (!canvas) return

    const origin = pointInCanvas(event, canvas)
    capturePointer(event)
    gesture.current = {
      kind: 'create',
      pointerId: event.pointerId,
      originX: origin.x,
      originY: origin.y,
      x: origin.x,
      y: origin.y,
      w: 0,
      h: 0,
      color,
    }
    setSelectedId(null)
    setDraft({ x: origin.x, y: origin.y, w: 0, h: 0 })
  }

  function onMovePointerDown(event: ReactPointerEvent<HTMLElement>, id: string) {
    if (event.button !== 0 || removingRef.current.has(id)) return
    const note = notes.find((item) => item.id === id)
    if (!note) return

    event.preventDefault()
    capturePointer(event)
    if (document.activeElement instanceof HTMLTextAreaElement) {
      document.activeElement.blur()
    }

    gesture.current = {
      kind: 'move',
      pointerId: event.pointerId,
      id,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startX: note.x,
      startY: note.y,
      x: note.x,
      y: note.y,
      w: note.w,
      h: note.h,
      moved: false,
    }
    setSelectedId(id)
    setNotes((current) => bringToFront(current, id))
  }

  function onResizePointerDown(event: ReactPointerEvent<HTMLElement>, id: string) {
    if (event.button !== 0 || removingRef.current.has(id)) return
    const note = notes.find((item) => item.id === id)
    if (!note) return

    event.preventDefault()
    event.stopPropagation()
    capturePointer(event)
    gesture.current = {
      kind: 'resize',
      pointerId: event.pointerId,
      id,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startX: note.x,
      startY: note.y,
      startW: note.w,
      startH: note.h,
    }
    setSelectedId(id)
    setResizing(true)
  }

  function onPointerMove(event: ReactPointerEvent<HTMLElement>) {
    const current = gesture.current
    const canvas = canvasRef.current
    if (!current || current.pointerId !== event.pointerId || !canvas) return
    const bounds = { width: canvas.clientWidth, height: canvas.clientHeight }

    if (current.kind === 'create') {
      const point = pointInCanvas(event, canvas)
      const next = draftRect(current.originX, current.originY, point.x, point.y, bounds)
      current.x = next.x
      current.y = next.y
      current.w = next.w
      current.h = next.h
      setDraft(next)
      return
    }

    if (current.kind === 'move') {
      const next = clampPosition(
        {
          x: current.startX + (event.clientX - current.startClientX),
          y: current.startY + (event.clientY - current.startClientY),
          w: current.w,
          h: current.h,
        },
        bounds,
      )
      current.x = next.x
      current.y = next.y
      current.w = next.w
      current.h = next.h
      const distance = Math.hypot(
        event.clientX - current.startClientX,
        event.clientY - current.startClientY,
      )
      if (!current.moved && distance > 3) {
        current.moved = true
        setDraggingId(current.id)
      }
      setNotes((prev) =>
        prev.map((note) =>
          note.id === current.id ? { ...note, x: next.x, y: next.y, w: next.w, h: next.h } : note,
        ),
      )
      if (current.moved) setTrashHot(noteHitsTrash(next))
      return
    }

    const width = current.startW + (event.clientX - current.startClientX)
    const height = current.startH + (event.clientY - current.startClientY)
    setNotes((prev) =>
      prev.map((note) =>
        note.id === current.id
          ? resizeNote({ ...note, x: current.startX, y: current.startY }, width, height, bounds)
          : note,
      ),
    )
  }

  function onPointerUp(event: ReactPointerEvent<HTMLElement>) {
    const current = gesture.current
    if (!current || current.pointerId !== event.pointerId) return
    clearGesture()

    if (current.kind === 'create') {
      if (current.w < MIN_DRAG || current.h < MIN_DRAG) return
      addNote(
        createNote({
          x: current.x,
          y: current.y,
          w: current.w,
          h: current.h,
          color: current.color,
        }),
      )
      return
    }

    if (current.kind === 'move' && current.moved && noteHitsTrash(current)) {
      removeNote(current.id)
    }
  }

  function onPointerCancel(event: ReactPointerEvent<HTMLElement>) {
    const current = gesture.current
    if (!current || current.pointerId !== event.pointerId) return
    clearGesture()
  }

  function createDefaultNote() {
    const bounds = canvasBounds()
    if (!bounds) return
    const spot = findFreeSpot(notes, bounds, DEFAULT_NOTE_WIDTH, DEFAULT_NOTE_HEIGHT)
    addNote(
      createNote({
        x: spot.x,
        y: spot.y,
        w: DEFAULT_NOTE_WIDTH,
        h: DEFAULT_NOTE_HEIGHT,
        color,
      }),
    )
  }

  return (
    <main className="app">
      <header className="topbar">
        <div className="brand">
          <h1>Sticky notes</h1>
        </div>
        <div className="toolbar">
          <div className="colors" role="group" aria-label="Note color">
            <span className="colors__label">Color</span>
            {NOTE_COLORS.map((swatch) => (
              <button
                key={swatch.id}
                type="button"
                className="swatch"
                data-color={swatch.id}
                aria-label={swatch.label}
                aria-pressed={color === swatch.id}
                onClick={() => setColor(swatch.id)}
              />
            ))}
          </div>
          <span className="toolbar__rule" aria-hidden="true" />
          <button type="button" className="new-note" aria-label="New note" onClick={createDefaultNote}>
            <svg className="new-note__icon" viewBox="0 0 16 16" aria-hidden="true">
              <path d="M8 2.5v11M2.5 8h11" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            New note
          </button>
        </div>
      </header>
      <div
        ref={canvasRef}
        className="canvas"
        role="region"
        aria-label="Board"
        onPointerDown={onCanvasPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
      >
        <p className="hint">Drag on the board to create a note</p>
        {notes.map((note) => (
          <NoteCard
            key={note.id}
            note={note}
            selected={note.id === selectedId}
            dragging={note.id === draggingId}
            removing={removingIds.includes(note.id)}
            onSelect={setSelectedId}
            onTextChange={(id, text) =>
              setNotes((current) =>
                current.map((item) => (item.id === id ? { ...item, text } : item)),
              )
            }
            onMovePointerDown={onMovePointerDown}
            onResizePointerDown={onResizePointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerCancel}
          />
        ))}
        {draft && draft.w > 0 && draft.h > 0 ? (
          <div
            className="draft"
            style={{ left: draft.x, top: draft.y, width: draft.w, height: draft.h }}
          />
        ) : null}
        <div ref={trashRef} className={trashHot ? 'trash is-hot' : 'trash'}>
          <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M4 7h16M9 7V5h6v2M7 7l1 12h8l1-12"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          {trashHot ? <span>Drop to delete</span> : null}
        </div>
      </div>
    </main>
  )
}

export default App
