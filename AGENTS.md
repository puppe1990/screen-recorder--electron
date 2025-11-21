# Repository Guidelines

## Project Structure & Module Organization
- `src/`: React UI (entry `main.tsx`, layout `App.tsx`, feature views in `src/views` like `ControlPanel`, `CameraOverlay`, `Teleprompter`, `RecordingTimer`, `MiniPanel`), global styles in `App.css`/`index.css`, shared types in `types.d.ts`, assets under `src/assets`.
- `electron/`: Main process code in `main.ts`, preload bridge in `preload.ts`, and dedicated TS configs; window lifecycle and IPC wiring live here.
- `public/`: Static assets (icons, splash). Build outputs land in `dist/` (renderer) and `dist-electron/` (main); keep both out of commits.
- Tooling configs at the root: Vite (`vite.config.ts`), Tailwind (`tailwind.config.js`), TypeScript (`tsconfig*.json`), ESLint (`eslint.config.js`).

## Build, Test, and Development Commands
- `npm start`: Builds Electron main/preload and runs Vite dev server with the Electron shell; default local workflow.
- `npm run dev`: Vite renderer only (useful for UI iteration without launching Electron).
- `npm run electron:start`: Launches Electron pointing to the running dev server (`VITE_DEV_SERVER_URL`), handy after `npm run dev`.
- `npm run build`: Type-checks and builds the renderer into `dist/`; `npm run build:main` builds main/preload to `dist-electron/`.
- `npm run electron:build`: Full production build (main + renderer). `npm run build:mac` / `npm run dist:mac`: macOS packaging via electron-builder.
- `npm run lint`: ESLint for TS/TSX; fix findings before PRs.

## Coding Style & Naming Conventions
- TypeScript + React 19 with hooks; prefer functional components and early returns over deeply nested conditionals.
- 2-space indentation, single quotes, and semicolons to match existing files. Order imports: externals, aliases, then relative paths.
- Components in PascalCase (`CameraOverlay.tsx`), hooks/utilities in camelCase; Tailwind classes in JSX with `clsx`/`tailwind-merge` for conditionals.
- Keep IPC channel names and window identifiers typed and centralized in Electron files to avoid string drift.

## Testing Guidelines
- No automated suite yet; run manual passes covering recording start/stop, audio source selection, camera overlay resize/move, teleprompter open/close, and save dialogs (especially on macOS).
- When adding tests, prefer `*.test.tsx` colocated with components for renderer logic and `*.test.ts` near Electron modules; mock `electron`/`ffmpeg` surfaces.
- Document repro steps and expected results in PR descriptions until automated coverage exists.

## Commit & Pull Request Guidelines
- Follow current history style `type: short summary` (e.g., `feat: ...`). Use imperative mood, optional scopes (`feat(main): ...`), and keep one concern per commit.
- PRs should include: goal summary, screenshots or short clips for UI changes, validation steps with commands/platform, and linked issues. Flag platform-specific notes (macOS entitlements, ffmpeg availability).
- Exclude generated artifacts (`dist`, `dist-electron`) from commits; isolate dependency upgrades when possible.

## Security & Configuration Tips
- Do not commit secrets; runtime config comes from env (e.g., `VITE_DEV_SERVER_URL` in dev), packaging config lives in `package.json`.
- Screen, camera, and microphone permissions rely on `entitlements.mac.plist` and macOS keys under `build.mac` in `package.json`; update both when adding capture features.
- `@ffmpeg-installer/ffmpeg` ships native binaries; if overriding paths, keep them platform-aware and avoid bundling non-redistributable codecs.
