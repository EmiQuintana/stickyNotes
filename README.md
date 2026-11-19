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

Vite is the build tool. In development it serves the app and recompiles TypeScript and JSX when a file changes. The browser never runs `.tsx` directly. The production build is below.

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

## Layout

```
src/
  main.tsx                 entry
  app/App.tsx              screen and pointer gestures
  app/styles.css           all styles
  components/Note.tsx      one note
  model/notes.ts           note rules, no React
  api/client.ts            async persistence mock
```

There is one folder per role. The screen stays in `app/` because the product is a single view.

## Assumptions

- Desktop and mouse only. Touch is out of scope.
- The board is aimed at 1024x768 and fills the visible window, so the trash stays on screen when the window is shorter.
- All four interactions are included, plus the optional ones: text editing, stacking order, colors, and persistence.
- There is no real backend. `api/client.ts` is an asynchronous mock. It stores notes in `localStorage`.
- A drawn note uses the drag rectangle. Drags smaller than 40px on either side are ignored. The New note button creates a 200x160 note. Resize cannot go below 100x80.
- The trash hit test uses the note's rectangle. The tilt while dragging is visual only.
- A note comes to the front when a drag starts.

## Design decisions

The board is one React screen. Notes live in a single array, `{ id, x, y, w, h, color, text, rotation }`, and the UI renders from that array. Pointer handlers update the array; they do not keep a second copy of the layout.

`model/notes.ts` holds the pure rules: create, clamp, resize, overlap, and a free spot for the New note button. `app/App.tsx` owns the pointer gestures. `components/Note.tsx` is one note. `api/client.ts` is an asynchronous mock of a REST API. It waits briefly, then reads and writes `localStorage`, so a reload still restores the board. Overlapping saves keep only the latest request.

Creating, moving, and resizing use Pointer Events and `setPointerCapture`, so the gesture continues when the cursor leaves the note. The drag tilt, scale, and shadow are CSS only. The stored rotation stays the small random angle from creation.

A drag creates a note only when both sides are at least 40px. Resize cannot go below 100x80. Dropping a moved note on the trash plays a short shrink-and-fade, then removes it. Delete and Backspace remove the selected note, except while a textarea has focus.

Colors are CSS variables. The canvas is `#F5F5F4`. The typeface is Google Sans at weights 400 and 500, with Product Sans and `system-ui` as fallbacks.
