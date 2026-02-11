# Rubik's Cube 3D Simulator

An interactive 3D Rubik's Cube simulator built with React and Three.js. Rotate faces using keyboard controls, orbit the camera with mouse, and shuffle the cube with a randomized algorithm.

![Tech Stack](https://img.shields.io/badge/React-19-blue) ![Tech Stack](https://img.shields.io/badge/Three.js-0.182-green) ![Tech Stack](https://img.shields.io/badge/Vite-7-purple)

## Features

- **3D Rendering** — Interactive Rubik's Cube rendered from a glTF model using Three.js
- **Face Rotations** — Rotate any of the 6 faces (R, L, U, D, F, B) with smooth 300ms animations
- **Reverse Rotations** — Hold Shift for counter-clockwise (prime) moves
- **Shuffle** — Generate and execute random 12-move shuffle sequences using standard cube notation
- **Orbit Controls** — Rotate the camera freely with mouse drag
- **Dark Theme UI** — Glassmorphism-styled control bar with shuffle display

## Controls

| Input | Action |
|-------|--------|
| `R` | Rotate Right face |
| `L` | Rotate Left face |
| `U` | Rotate Upper face |
| `D` | Rotate Down face |
| `F` | Rotate Front face |
| `B` | Rotate Back face |
| `Shift` + key | Reverse (prime) rotation |
| Mouse drag | Orbit camera |
| Scroll | Zoom in/out |

## Tech Stack

- **React 19** — UI framework
- **Three.js** — 3D graphics engine
- **@react-three/fiber** — React renderer for Three.js
- **@react-three/drei** — Useful helpers (orbit controls, environment, glTF loader)
- **Vite** — Build tool and dev server

## Getting Started

### Prerequisites

- Node.js (v18 or later recommended)
- npm

### Installation

```bash
git clone <repository-url>
cd Rubiks_Cube_App
npm install
```

### Development

```bash
npm run dev
```

Opens the app at `http://localhost:5173`.

### Production Build

```bash
npm run build
npm run preview   # preview the build locally
```

### Linting

```bash
npm run lint
```

## Project Structure

```
src/
  App.jsx       # Main application — cube logic, animations, keyboard controls
  App.css       # UI styles (shuffle bar, buttons, dark theme)
  main.jsx      # React entry point
  index.css     # Global styles
public/
  rubiks_cube_final.glb   # 3D cube model (glTF binary)
```

## Browser Requirements

- WebGL support
- Modern browser with ES2020 compatibility
