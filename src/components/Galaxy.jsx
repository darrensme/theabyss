import { useEffect, useRef } from 'react';
import { gsap, ScrollTrigger } from '../lib/gsap';
import { GalaxyScene } from '../lib/GalaxyScene';
import { bus } from '../lib/bus';

// Camera stops along the page. `at` is a section; the camera reaches that
// pose when the section's top hits the middle of the screen.
const PATH = [
  { at: null, view: { radius: 8, elevation: 0.45, azimuth: 0, lookX: 0, lookY: 0 }, dim: 1 },
  { at: '#about', view: { radius: 6, elevation: 0.08, azimuth: 0.9, lookX: -1.7, lookY: 0.2 }, dim: 0.55 },
  { at: '#projects', view: { radius: 12.5, elevation: 1.4, azimuth: 1.9, lookX: 0, lookY: 0 }, dim: 0.5 },
  { at: '#crew', view: { radius: 9, elevation: 0.95, azimuth: 2.3, lookX: -2.2, lookY: 0 }, dim: 0.5 },
  { at: '#lab', view: { radius: 7.5, elevation: 0.55, azimuth: 2.7, lookX: 2.4, lookY: -0.3 }, dim: 0.5 },
  { at: 'end', view: { radius: 4.6, elevation: 1.05, azimuth: 3.6, lookX: 1.2, lookY: 0 }, dim: 0.62 }
];

export default function Galaxy({ born }) {
  const canvasRef = useRef(null);
  const sceneRef = useRef(null);

  useEffect(() => {
    let scene;
    try {
      scene = new GalaxyScene(canvasRef.current);
    } catch (err) {
      console.warn('[abyss] WebGL unavailable, staying in the void.', err);
      bus.signal('galaxy:ready', null);
      return;
    }
    sceneRef.current = scene;
    gsap.ticker.add(scene.tick);
    bus.signal('galaxy:ready', scene.info);

    const onMove = e => scene.setPointer(e.clientX, e.clientY);
    const onLeave = e => {
      if (!e.relatedTarget) scene.releasePointer();
    };
    const onUp = e => {
      if (e.pointerType !== 'mouse') scene.releasePointer();
    };
    const onDown = e => {
      if (e.target.closest('a, button, input, textarea, [data-no-pulse]')) return;
      scene.pulse(0.9);
    };
    let lastW = window.innerWidth;
    const onResize = () => {
      scene.resize();
      if (Math.abs(window.innerWidth - lastW) > 40) {
        lastW = window.innerWidth;
        buildPath();
      }
    };

    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('pointerup', onUp);
    document.addEventListener('pointerout', onLeave);
    window.addEventListener('resize', onResize);

    const offs = [
      bus.on('galaxy:warp', () => scene.warp()),
      bus.on('galaxy:pulse', s => scene.pulse(s)),
      bus.on('galaxy:rebuild', p => scene.rebuild(p)),
      bus.on('galaxy:tint', c => scene.setTint(c)),
      bus.on('galaxy:params', reply => reply?.({ ...scene.params }))
    ];

    // ── scroll path: one scrubbed timeline across the whole page ──
    let tl;
    function buildPath() {
      tl?.scrollTrigger?.kill();
      tl?.kill();
      const max = document.documentElement.scrollHeight - window.innerHeight;
      if (max <= 0) return;
      const progressOf = at => {
        if (at === null) return 0;
        if (at === 'end') return 1;
        const el = document.querySelector(at);
        if (!el) return null;
        const top = el.getBoundingClientRect().top + window.scrollY - window.innerHeight * 0.5;
        return Math.min(1, Math.max(0, top / max));
      };
      const stops = PATH.map(s => ({ ...s, p: progressOf(s.at) })).filter(s => s.p !== null);

      tl = gsap.timeline({
        defaults: { ease: 'sine.inOut' },
        scrollTrigger: { start: 0, end: 'max', scrub: 1.4 }
      });
      for (let i = 1; i < stops.length; i++) {
        const a = stops[i - 1];
        const b = stops[i];
        const duration = Math.max(0.001, b.p - a.p);
        tl.fromTo(scene.view, { ...a.view }, { ...b.view, duration, immediateRender: false }, a.p);
        tl.fromTo(scene.uniforms.uDim, { value: a.dim }, { value: b.dim, duration, immediateRender: false }, a.p);
      }
    }

    const offPath = bus.on('layout:ready', () => {
      buildPath();
      ScrollTrigger.refresh();
    });

    return () => {
      offPath();
      offs.forEach(off => off());
      tl?.scrollTrigger?.kill();
      tl?.kill();
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointerup', onUp);
      document.removeEventListener('pointerout', onLeave);
      window.removeEventListener('resize', onResize);
      gsap.ticker.remove(scene.tick);
      scene.dispose();
      sceneRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (born) sceneRef.current?.birth();
  }, [born]);

  return <canvas ref={canvasRef} className="galaxy" aria-hidden="true" />;
}
