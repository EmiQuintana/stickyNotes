# Sticky Notes

Desktop board for sticky notes. Built with TypeScript and React. There is no component library: the notes, drag gestures, and styles live in this project.

Target environment:

- Desktop, minimum resolution 1024x768
- Latest Google Chrome (Windows and Mac), Mozilla Firefox, and Microsoft Edge
- Mouse input

## Prerequisites

- Node.js 22 or later
- npm 10 or later

## Run locally

```bash
npm install
npm run dev
```

Vite prints a local URL. Open it in a desktop browser.

## Production build

```bash
npm run build
npm run preview
```

`npm run build` type-checks the project and writes the static files to `dist/`.

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Start the development server |
| `npm run build` | Type-check and build for production |
| `npm run preview` | Serve the production build locally |
| `npm run lint` | Run Oxlint |

## Design decisions

The board is one React screen. Notes live in a single array, `{ id, x, y, w, h, color, text, rotation }`, and the UI renders from that array. Pointer handlers update the array; they do not keep a second copy of the layout.

`src/notes.ts` holds the pure rules: create, clamp, resize, overlap, a free spot for the New note button, and `localStorage`. `src/App.tsx` owns the pointer gestures. `src/Note.tsx` is one note.

Creating, moving, and resizing use Pointer Events and `setPointerCapture`, so the gesture continues when the cursor leaves the note. The drag tilt, scale, and shadow are CSS only. The stored rotation stays the small random angle from creation.

A drag creates a note only when both sides are at least 40px. Resize cannot go below 100x80. Dropping a moved note on the trash plays a short shrink-and-fade, then removes it. Delete and Backspace remove the selected note, except while a textarea has focus.

Colors are CSS variables. The canvas is `#F5F5F4`. The typeface is Google Sans at weights 400 and 500, with Product Sans and `system-ui` as fallbacks.
