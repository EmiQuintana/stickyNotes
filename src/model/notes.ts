export const NOTE_COLORS = [
  { id: 'yellow', label: 'Yellow' },
  { id: 'pink', label: 'Pink' },
  { id: 'mint', label: 'Mint' },
  { id: 'blue', label: 'Blue' },
  { id: 'lilac', label: 'Lilac' },
] as const

export type NoteColor = (typeof NOTE_COLORS)[number]['id']

export type Note = {
  id: string
  x: number
  y: number
  w: number
  h: number
  color: NoteColor
  text: string
  rotation: number
}

export type Bounds = {
  width: number
  height: number
}

export type Rect = {
  x: number
  y: number
  w: number
  h: number
}

export const MIN_DRAG = 40
export const MIN_NOTE_WIDTH = 100
export const MIN_NOTE_HEIGHT = 80
export const DEFAULT_NOTE_WIDTH = 200
export const DEFAULT_NOTE_HEIGHT = 160

const STORAGE_KEY = 'sticky-notes'
const COLOR_IDS = new Set<string>(NOTE_COLORS.map((color) => color.id))

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

function isNoteColor(value: unknown): value is NoteColor {
  return typeof value === 'string' && COLOR_IDS.has(value)
}

function isNote(value: unknown): value is Note {
  if (!value || typeof value !== 'object') return false
  const note = value as Record<string, unknown>
  const { id, x, y, w, h, text, rotation, color } = note
  return (
    typeof id === 'string' &&
    id.length > 0 &&
    typeof x === 'number' &&
    Number.isFinite(x) &&
    typeof y === 'number' &&
    Number.isFinite(y) &&
    typeof w === 'number' &&
    Number.isFinite(w) &&
    w > 0 &&
    typeof h === 'number' &&
    Number.isFinite(h) &&
    h > 0 &&
    typeof text === 'string' &&
    typeof rotation === 'number' &&
    Number.isFinite(rotation) &&
    isNoteColor(color)
  )
}

export function randomRotation(): number {
  const degrees = Math.random() * 4 - 2
  return Math.round(degrees * 100) / 100
}

export function createNote(input: {
  x: number
  y: number
  w: number
  h: number
  color: NoteColor
}): Note {
  return {
    id: crypto.randomUUID(),
    text: '',
    rotation: randomRotation(),
    ...input,
  }
}

export function clampPosition(rect: Rect, bounds: Bounds): Rect {
  const w = Math.min(rect.w, bounds.width)
  const h = Math.min(rect.h, bounds.height)
  return {
    w,
    h,
    x: clamp(rect.x, 0, Math.max(0, bounds.width - w)),
    y: clamp(rect.y, 0, Math.max(0, bounds.height - h)),
  }
}

export function clampNote(note: Note, bounds: Bounds): Note {
  const next = clampPosition(note, bounds)
  if (next.x === note.x && next.y === note.y && next.w === note.w && next.h === note.h) return note
  return { ...note, ...next }
}

export function clampNotes(notes: Note[], bounds: Bounds): Note[] {
  let changed = false
  const next = notes.map((note) => {
    const clamped = clampNote(note, bounds)
    if (clamped !== note) changed = true
    return clamped
  })
  return changed ? next : notes
}

export function resizeNote(note: Note, width: number, height: number, bounds: Bounds): Note {
  let w = Math.max(MIN_NOTE_WIDTH, width)
  let h = Math.max(MIN_NOTE_HEIGHT, height)
  const maxWidth = bounds.width - note.x
  const maxHeight = bounds.height - note.y
  if (maxWidth > 0) w = Math.min(w, Math.max(MIN_NOTE_WIDTH, maxWidth))
  if (maxHeight > 0) h = Math.min(h, Math.max(MIN_NOTE_HEIGHT, maxHeight))
  return clampNote({ ...note, w, h }, bounds)
}

export function rectsOverlap(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
}

export function draftRect(
  originX: number,
  originY: number,
  x: number,
  y: number,
  bounds: Bounds,
): Rect {
  const left = clamp(Math.min(originX, x), 0, bounds.width)
  const top = clamp(Math.min(originY, y), 0, bounds.height)
  const right = clamp(Math.max(originX, x), 0, bounds.width)
  const bottom = clamp(Math.max(originY, y), 0, bounds.height)
  return { x: left, y: top, w: right - left, h: bottom - top }
}

export function findFreeSpot(
  notes: Note[],
  bounds: Bounds,
  w: number,
  h: number,
): { x: number; y: number } {
  const originX = 24
  const originY = 44
  const step = 28
  const maxX = Math.max(0, bounds.width - w)
  const maxY = Math.max(0, bounds.height - h)

  for (let y = Math.min(originY, maxY); y <= maxY; y += step) {
    for (let x = Math.min(originX, maxX); x <= maxX; x += step) {
      const spot = { x, y, w, h }
      const blocked = notes.some((note) => rectsOverlap(spot, note))
      if (!blocked) return { x, y }
    }
  }

  return { x: Math.min(originX, maxX), y: Math.min(originY, maxY) }
}

export function bringToFront(notes: Note[], id: string): Note[] {
  const index = notes.findIndex((note) => note.id === id)
  if (index === -1 || index === notes.length - 1) return notes
  const next = notes.slice()
  const [note] = next.splice(index, 1)
  next.push(note)
  return next
}

export function loadNotes(): Note[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isNote)
  } catch {
    return []
  }
}

export function saveNotes(notes: Note[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notes))
  } catch {
    // Ignore quota and private-mode failures. The board still works in memory.
  }
}
