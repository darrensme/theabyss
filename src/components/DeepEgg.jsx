import { useEffect, useMemo, useRef, useState } from 'react';
import { gsap } from '../lib/gsap';
import { bus, toast } from '../lib/bus';
import { getLenis, scrollTo } from '../lib/lenis';
import { EyeRenderer } from '../lib/EyeRenderer';

// ─────────────────────────────────────────────────────────────
//  Secret: at the very bottom of the page, keep scrolling down
//  *hard*. Pressure builds (and drains if you stop). Push it
//  past 1 and the floor breaks.
// ─────────────────────────────────────────────────────────────

// tuned so one normal scroll only cracks the floor; breaking it takes
// ~0.6s of hard wheel/trackpad spinning, ~4 hard swipes, or holding ↓ ~0.8s.
// Lower the WHEEL/TOUCH/KEY divisors to make it easier, raise them for harder.
const DRAIN = 0.3; // pressure lost per second
const WHEEL = 1 / 1600; // per pixel of wheel push
const TOUCH = 1 / 1400; // per pixel of finger drag (~4 hard swipes)
const KEY = 0.05; // per arrow / space / page-down press (keys auto-repeat ~30/s)

// momentum scrolling (macOS trackpads keep firing wheel events after you let
// go) must not count as pushing: ignore pushes for a moment after arriving
const SETTLE = 800; // ms

const atBottom = () =>
  window.scrollY >= document.documentElement.scrollHeight - window.innerHeight - 4;

const LINES = [
  'you scrolled past the bottom.',
  'nobody scrolls past the bottom.',
  'the abyss has noticed you.'
];

// a jagged crack across the screen (generated once, viewBox 0..1000)
function crackPath() {
  let d = 'M0,20';
  for (let x = 25; x <= 1000; x += 25) d += ` L${x},${20 + (Math.random() - 0.5) * 22}`;
  return d;
}

export default function DeepEgg() {
  const [open, setOpen] = useState(false);
  const floor = useRef(null);
  const overlay = useRef(null);
  const eye = useRef(null);
  const crack = useMemo(crackPath, []);
  const broke = useRef(false);
  const eyeGL = useRef(null);

  // ── pressure: wheel / touch / keys while already at the bottom ──
  useEffect(() => {
    const state = { p: 0 };
    let touchY = null;
    let shown = 0;
    const el = floor.current;
    const line = el.querySelector('.floor__crack');
    const text = el.querySelector('.floor__text');

    let arrivedAt = 0;
    const onScroll = () => {
      if (!atBottom()) arrivedAt = 0;
      else if (!arrivedAt) arrivedAt = performance.now();
    };
    onScroll();

    const push = amount => {
      if (broke.current || !atBottom()) return;
      if (!arrivedAt || performance.now() - arrivedAt < SETTLE) return;
      state.p = Math.min(1.05, state.p + amount);
    };

    const onWheel = e => {
      if (e.deltaY <= 0) return;
      push(e.deltaY * (e.deltaMode === 1 ? 33 : 1) * WHEEL);
    };
    const onTouchStart = e => (touchY = e.touches[0].clientY);
    const onTouchMove = e => {
      if (touchY === null) return;
      const y = e.touches[0].clientY;
      if (y < touchY) push((touchY - y) * TOUCH); // finger moving up = scrolling down
      touchY = y;
    };
    const onKey = e => {
      if (/^(INPUT|TEXTAREA)$/.test(document.activeElement?.tagName)) return;
      if (['ArrowDown', 'PageDown', ' ', 'End'].includes(e.key)) push(KEY);
    };

    const tick = (_, deltaMs) => {
      const dt = Math.min(deltaMs / 1000, 0.05);
      if (state.p > 0) state.p = Math.max(0, state.p - DRAIN * dt);
      const p = Math.min(state.p, 1);

      // only touch the DOM when something visibly changed
      if (Math.abs(p - shown) > 0.002 || (p === 0 && shown !== 0)) {
        shown = p;
        el.style.opacity = p > 0.01 ? 1 : 0;
        line.style.strokeDashoffset = 1 - p;
        line.style.stroke = `color-mix(in srgb, #ff2a4a ${Math.round(p * 100)}%, #b9a4ff)`;
        text.textContent = p > 0.75 ? 'keep going…' : p > 0.3 ? 'the floor is cracking…' : '';
        // strain the footer's contents (not the footer itself: moving that would
        // make the page taller, and you'd no longer be 'at the bottom')
        gsap.set('.signal > *', { y: p * 36 });
        gsap.set(el, { x: p > 0.6 ? (Math.random() - 0.5) * p * 6 : 0 });
        bus.emit('deep:pressure', p);
      }

      if (state.p >= 1 && !broke.current) {
        broke.current = true;
        state.p = 0;
        breakThrough();
      }
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('wheel', onWheel, { passive: true });
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchend', () => (touchY = null), { passive: true });
    window.addEventListener('keydown', onKey);
    gsap.ticker.add(tick);
    const off = bus.on('deep:open', () => breakThrough(true));

    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('keydown', onKey);
      gsap.ticker.remove(tick);
      off();
    };
  }, []);

  function breakThrough(quick = false) {
    getLenis()?.stop();
    bus.emit('galaxy:warp');
    bus.emit('galaxy:tint', '#ff1e3c');
    gsap.set('.signal > *', { y: 0 });
    bus.emit('deep:pressure', 0);
    gsap
      .timeline()
      .to('.floor__crack', { strokeWidth: 10, opacity: 0, duration: 0.5, ease: 'power3.out' })
      .add(() => setOpen(true), quick ? 0 : 0.35);
    try {
      localStorage.setItem('abyss:deep', '1');
    } catch {}
  }

  // ── the room below the floor ──
  useEffect(() => {
    if (!open) return;
    const root = overlay.current;
    const canvas = eye.current;
    let gl = null;
    try {
      gl = eyeGL.current = new EyeRenderer(canvas);
      gl.open(0.9);
    } catch (err) {
      console.warn('[abyss] the eye needs WebGL', err);
    }
    const typed = root.querySelectorAll('.deep__typed');
    const ctx = gsap.context(() => {
      const tl = gsap.timeline();
      tl.fromTo(root, { opacity: 0 }, { opacity: 1, duration: 0.6 })
        .fromTo('.deep__flash', { opacity: 1 }, { opacity: 0, duration: 1.2, ease: 'power2.out' }, 0)
        .fromTo(
          '.deep__depth b',
          { textContent: 10935 },
          { textContent: 99999, duration: 1.6, ease: 'power2.in', snap: { textContent: 1 } },
          0.2
        )
        .add(() => (root.querySelector('.deep__depth b').textContent = '∞'));
      typed.forEach((span, i) => {
        tl.to(span, { text: { value: LINES[i] }, duration: LINES[i].length / 30, ease: 'none' }, i === 0 ? 1.8 : '>0.35');
      });
      tl.fromTo('.deep__actions', { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.6 }, '>0.2');

      // blinks every few seconds
      const blink = () => {
        if (!root.isConnected) return; // room closed: stop blinking
        gl?.blink();
        gsap.delayedCall(2.5 + Math.random() * 4, blink);
      };
      gsap.delayedCall(4.5, blink);
    }, root);

    // the eye follows you (mouse or finger)
    const follow = e => {
      const r = canvas.getBoundingClientRect();
      // screen → -1..1 around the eye (y flipped: up is positive in the shader)
      const dx = (e.clientX - (r.left + r.width / 2)) / (r.width * 0.7);
      const dy = -(e.clientY - (r.top + r.height / 2)) / (r.height * 1.2);
      gl?.lookAt(Math.max(-1, Math.min(1, dx)), Math.max(-1, Math.min(1, dy)));
    };
    const onKey = e => e.key === 'Escape' && climb();
    window.addEventListener('pointermove', follow, { passive: true });
    window.addEventListener('pointerdown', follow, { passive: true });
    window.addEventListener('keydown', onKey);
    return () => {
      ctx.revert();
      gl?.dispose();
      eyeGL.current = null;
      window.removeEventListener('pointermove', follow);
      window.removeEventListener('pointerdown', follow);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const stareBack = () => {
    const msg = overlay.current.querySelector('.deep__reply');
    eyeGL.current?.stare();
    bus.emit('galaxy:pulse', 2);
    gsap.to(msg, { text: { value: '> …it blinked first.' }, duration: 0.8, ease: 'none', delay: 1.75 });
  };

  function climb() {
    gsap.to(overlay.current, {
      opacity: 0,
      duration: 0.7,
      onComplete: () => {
        setOpen(false);
        broke.current = false;
        bus.emit('galaxy:tint', null);
        getLenis()?.start();
        scrollTo(0, { duration: 4.5 });
        gsap.set('.floor__crack', { strokeWidth: 2, opacity: 1 });
        toast('> secret command unlocked in the terminal: deeper');
      }
    });
  }

  return (
    <>
      <div className="floor" ref={floor} aria-hidden="true">
        <p className="floor__text mono" />
        <svg className="floor__svg" viewBox="0 0 1000 40" preserveAspectRatio="none">
          <path className="floor__crack" d={crack} pathLength="1" />
        </svg>
      </div>

      {open && (
        <div className="deep" ref={overlay} role="dialog" aria-label="Secret: below the bottom" data-lenis-prevent data-no-pulse>
          <div className="deep__flash" />
          <p className="deep__depth mono">
            depth: −<b>10935</b>m
          </p>
          <canvas className="deep__eye" ref={eye} aria-hidden="true" />
          <div className="deep__text mono">
            {LINES.map((_, i) => (
              <p className="deep__line" key={i}>
                <span className="c-dim">&gt; </span>
                <span className="deep__typed" />
              </p>
            ))}
            <p className="deep__reply" />
          </div>
          <div className="deep__actions">
            <button className="btn btn--primary mono" onClick={climb}>
              ↑ climb back up
            </button>
            <button className="btn mono" onClick={stareBack}>
              stare back
            </button>
          </div>
        </div>
      )}
    </>
  );
}
