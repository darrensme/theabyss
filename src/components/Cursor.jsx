import { useEffect, useRef } from 'react';
import { gsap } from '../lib/gsap';

// Custom cursor: a dot that sticks to the pointer and a ring that lags behind.
// Hover anything with data-cursor="label" to show a label. Desktop only.
export default function Cursor() {
  const dot = useRef(null);
  const ring = useRef(null);
  const label = useRef(null);

  useEffect(() => {
    if (!window.matchMedia('(pointer: fine)').matches) return;
    document.documentElement.classList.add('has-cursor');

    const dx = gsap.quickTo(dot.current, 'x', { duration: 0.08, ease: 'power3' });
    const dy = gsap.quickTo(dot.current, 'y', { duration: 0.08, ease: 'power3' });
    const rx = gsap.quickTo(ring.current, 'x', { duration: 0.45, ease: 'power3' });
    const ry = gsap.quickTo(ring.current, 'y', { duration: 0.45, ease: 'power3' });
    gsap.set([dot.current, ring.current], { xPercent: -50, yPercent: -50, opacity: 0 });

    let shown = false;
    const move = e => {
      if (!shown) {
        shown = true;
        gsap.set([dot.current, ring.current], { x: e.clientX, y: e.clientY });
        gsap.to([dot.current, ring.current], { opacity: 1, duration: 0.3 });
      }
      dx(e.clientX);
      dy(e.clientY);
      rx(e.clientX);
      ry(e.clientY);
    };

    const over = e => {
      const target = e.target.closest('a, button, input, [data-cursor]');
      const text = target?.dataset.cursor ?? '';
      const hot = Boolean(target);
      ring.current.classList.toggle('is-hot', hot);
      ring.current.classList.toggle('has-label', Boolean(text));
      label.current.textContent = text;
    };

    const down = () => gsap.to(ring.current, { scale: 0.7, duration: 0.15 });
    const up = () => gsap.to(ring.current, { scale: 1, duration: 0.5, ease: 'elastic.out(1, 0.4)' });
    const leave = e => {
      if (e.relatedTarget) return;
      shown = false;
      gsap.to([dot.current, ring.current], { opacity: 0, duration: 0.3 });
    };

    window.addEventListener('pointermove', move, { passive: true });
    window.addEventListener('pointerover', over, { passive: true });
    window.addEventListener('pointerdown', down);
    window.addEventListener('pointerup', up);
    document.addEventListener('pointerout', leave);
    return () => {
      document.documentElement.classList.remove('has-cursor');
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerover', over);
      window.removeEventListener('pointerdown', down);
      window.removeEventListener('pointerup', up);
      document.removeEventListener('pointerout', leave);
    };
  }, []);

  return (
    <div className="cursor" aria-hidden="true">
      <div className="cursor__ring" ref={ring}>
        <span className="cursor__label mono" ref={label} />
      </div>
      <div className="cursor__dot" ref={dot} />
    </div>
  );
}
