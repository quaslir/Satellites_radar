Satellites Radar — Earth & Orbits (Three.js + Vite + TS)

An interactive 3D visualization of Earth & Moon with physically-based day/night transitions, cloud layer, atmospheric glow, and real-time tracking of 10,000+ satellites using TLE data. Built with Three.js, TypeScript, Vite, and Web Workers for smooth performance.

Features

Physically inspired Earth rendering: day/night, specular highlights, atmosphere glow

Dynamic clouds layer (alpha, soft parallax feel)

High-res textures (NASA/Visible Earth) with graceful fallbacks

Satellite propagation from TLE via satellite.js in a Web Worker

Smooth camera controls (orbit/zoom/pan), ACES Filmic tone mapping

Modular architecture (main thread ↔ worker; clean disposal of resources)

Tech Stack

three.js, satellite.js

TypeScript, Vite

Web Workers

Optional: Git LFS for large textures

Project Structure
.
├─ public/                 # Static assets served as-is
├─ src/
│  ├─ three.ts            # Earth/Moon scene setup, textures, glow, controls
│  ├─ orbit-online.ts     # Main-thread worker controller & messaging
│  ├─ orbits.worker.ts    # Worker: TLE parsing & propagation
│  ├─ types/              # Shared TS types (e.g., TLE)
│  └─ main.ts             # Vite/bootstrapping entry
├─ tools/                 # Dev helpers / scripts (optional)
├─ index.html
├─ vite.config.ts
├─ tsconfig*.json
├─ eslint.config.js
└─ package.json

Getting Started
Prerequisites

Node.js 18+ (recommended 20+)

pnpm / npm / yarn (any is fine)

Install
# choose one
pnpm install
# or
npm install
# or
yarn

Run (dev)
pnpm dev
# npm run dev / yarn dev


Vite will print a local URL; open it in your browser.

Build (prod)
pnpm build
pnpm preview
# npm run build && npm run preview

Scripts
{
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "typecheck": "tsc -b",
    "lint": "eslint ."
  }
}
