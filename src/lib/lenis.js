import Lenis from 'lenis';
import 'lenis/dist/lenis.css';
import { gsap, ScrollTrigger } from './gsap';

// One Lenis instance for the whole site, driven by GSAP's ticker so that
// smooth scroll, ScrollTrigger and the WebGL galaxy all share one frame loop.
let lenis = null;

const raf = time => lenis?.raf(time * 1000);

export function initLenis() {
  if (lenis) return lenis;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  lenis = new Lenis({
    autoRaf: false,
    duration: 1.2,
    easing: t => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    smoothWheel: !reduce,
    // phones keep native touch scrolling (feels right + zero input lag)
    syncTouch: false
  });

  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add(raf);
  gsap.ticker.lagSmoothing(0);
  return lenis;
}

export function destroyLenis() {
  gsap.ticker.remove(raf);
  lenis?.destroy();
  lenis = null;
}

export const getLenis = () => lenis;

export const getScrollVelocity = () => lenis?.velocity ?? 0;

export function scrollTo(target, options = {}) {
  if (lenis) {
    lenis.scrollTo(target, { duration: 1.8, ...options });
    return;
  }
  const el = typeof target === 'string' ? document.querySelector(target) : null;
  if (el) el.scrollIntoView({ behavior: 'smooth' });
  else if (typeof target === 'number') window.scrollTo({ top: target, behavior: 'smooth' });
}
