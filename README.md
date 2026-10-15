# The Abyss

Studio site. React + Vite, Three.js galaxy, GSAP animation, Lenis smooth scroll, React Bits effects.

## Run it

```bash
npm install      # first time only
npm run dev      # → http://localhost:5173 (the "Network" URL works on your phone)
npm run build    # production build → dist/
npm run preview  # serve the production build locally
```

## Add a project

Edit **`src/data/projects.js`**: copy the existing block and change the fields.
Put icons in `public/projects/` and reference them as `'/projects/your-icon.png'`.
The locked "coming soon" card is always added at the end automatically.

## Where things live

| file | what |
| --- | --- |
| `src/data/projects.js` | the project list |
| `src/data/crew.js` | the crew (names, roles, colours, and `form`: spiral / planet / blackhole / pulsar) |
| `src/lib/CrewScene.js` | the crew's particle objects (one shared WebGL canvas) |
| `src/components/Loader.jsx` | terminal loading screen |
| `src/lib/GalaxyScene.js` | Three.js galaxy (shaders, mouse, warp, pulses) |
| `src/lib/generateGalaxy.js` | the galaxy math (also shown on the page in `// lab`) |
| `src/components/Galaxy.jsx` | camera path as you scroll (`PATH` at the top) |
| `src/components/Ticker.jsx` | curved ticker text |
| `src/components/Terminal.jsx` | hidden terminal (press `~`) |
| `src/components/reactbits/` | components from reactbits.dev (JS + CSS variants) |
| `src/styles.css` | all styles; colours are at the top |

## Easter eggs

- Press `~` for a working terminal. Type `help`; some commands are unlisted.
- Click the big title seven times.
- Konami code: ↑ ↑ ↓ ↓ ← → ← → B A
- Keep clicking the locked project card.
- Tap a crew member to ping them.
- At the very bottom, keep scrolling down *hard* (wheel, trackpad, swipes or holding ↓). Tuning lives at the top of `src/components/DeepEgg.jsx`.
- Open the browser console.
- Switch tabs, or sit still for a while.
