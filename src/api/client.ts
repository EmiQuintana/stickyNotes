import { loadNotes, saveNotes, type Note } from '../model/notes.ts'

const LATENCY_MS = 150

let saveVersion = 0

function delay(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms)
  })
}

export async function fetchNotes(): Promise<Note[]> {
  await delay(LATENCY_MS)
  return loadNotes()
}

export async function persistNotes(notes: Note[]): Promise<void> {
  const version = ++saveVersion
  const snapshot = notes
  await delay(LATENCY_MS)
  if (version !== saveVersion) return
  saveNotes(snapshot)
}
