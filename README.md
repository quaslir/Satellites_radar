🛰️ Satellites Radar — Earth & Orbits
Built with Three.js · TypeScript · Vite · Web Workers

An interactive 3D visualization of Earth and Moon with realistic day/night transitions, clouds, atmospheric glow, and real-time tracking of 10,000+ satellites using TLE data.
Built for smooth performance and scalability with Three.js, TypeScript, Vite, and Web Workers.

🌟 Features

✅ Physically inspired Earth rendering — day/night, specular reflections, atmospheric glow
☁️ Dynamic clouds layer with transparency and parallax motion
🛰️ Real-time satellite propagation via satellite.js running inside a Web Worker
🎥 Smooth camera controls (orbit, zoom, pan)
🎨 ACES Filmic tone mapping for cinematic visuals
⚙️ Modular architecture — main thread ↔ worker with proper resource cleanup
🖼️ High-resolution NASA textures with graceful fallbacks (8K → 4K → 2K)

🧠 Tech Stack

Three.js — 3D engine

satellite.js — TLE propagation

TypeScript — type safety

Vite — fast build & dev server

Web Workers — heavy orbit calculations off-main-thread

(Optional) Git LFS — manage large texture assets

🗂️ Project Structure
.
├─ public/                 # Static assets (textures, sky, TLEs)
├─ src/
│  ├─ three.ts            # Earth/Moon scene setup, lighting, shaders
│  ├─ orbit-online.ts     # Main-thread controller, worker messaging
│  ├─ orbits.worker.ts    # Satellite propagation logic
│  ├─ types/              # Shared TypeScript definitions (TLE, etc.)
│  └─ main.ts             # Vite app entry
├─ tools/                 # Developer tools & scripts
├─ index.html
├─ vite.config.ts
├─ tsconfig*.json
├─ eslint.config.js
└─ package.json

🚀 Getting Started
Prerequisites

Node.js v18+ (recommended v20+)

Any package manager: pnpm, npm, or yarn

📦 Installation
# Choose one
pnpm install
# or
npm install
# or
yarn

💻 Development
pnpm dev
# or
npm run dev
# or
yarn dev


Then open the local URL printed in the terminal.

🏗️ Build for Production
pnpm build
pnpm preview
# or
npm run build && npm run preview


This will build the project and serve the optimized version for testing.

⚙️ Available Scripts
{
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "typecheck": "tsc -b",
    "lint": "eslint ."
  }
}

🌍 Description

This project visualizes the Earth and the Moon with physically accurate day/night transitions.
The main purpose is to track more than 10,000 satellites orbiting around Earth in real time.

🪐 Future Improvements

🌌 UI for satellite filters and search

⏱️ Time controls and orbit animation speed

🧭 Ground track projection

📱 Mobile layout optimization

🧊 KTX2 compressed textures for faster loading
