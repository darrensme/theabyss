import { useRef } from 'react';
import { gsap, SplitText, useGSAP } from '../lib/gsap';
import { scrollTo } from '../lib/lenis';
import { bus, toast } from '../lib/bus';
import { sfx } from '../lib/audio';

const GLYPHS = '!<>-_\\/[]{}—=+*^?#░▒▓';

export default function Hero({ active }) {
  const root = useRef(null);
  const clicks = useRef(0);

  useGSAP(
    () => {
      if (!active) return;
      const split = SplitText.create('.hero__abyss', { type: 'chars', charsClass: 'hero__char' });
      const chars = split.chars;
      const fine = window.matchMedia('(pointer: fine)').matches;

      // ── intro ──
      const intro = gsap.timeline({ delay: 0.35 });
      intro
        .from(chars, {
          yPercent: 115,
          rotateX: -95,
          opacity: 0,
          filter: 'blur(12px)',
          duration: 1.6,
          ease: 'expo.out',
          stagger: { each: 0.07, from: 'center' }
        })
        .from('.hero__the', { opacity: 0, x: -40, duration: 1.2, ease: 'expo.out' }, 0.5)
        .from('[data-intro]', { opacity: 0, y: 24, duration: 1, ease: 'power3.out', stagger: 0.1 }, 0.8)
        .set(chars, { clearProps: 'filter' });

      // ── scroll: the title gets pulled apart as you descend ──
      const mid = (chars.length - 1) / 2;
      gsap
        .timeline({ scrollTrigger: { trigger: root.current, start: 'top top', end: 'bottom top', scrub: 1 } })
        .to(chars, { x: i => (i - mid) * window.innerWidth * 0.045, ease: 'none' }, 0)
        .to('.hero__title', { opacity: 0, scale: 0.92, ease: 'power1.in' }, 0)
        .to('.hero__inner > :not(.hero__title)', { y: -60, opacity: 0, ease: 'none' }, 0)
        .to('.hero__scroll', { opacity: 0, ease: 'none' }, 0);

      // ── mouse: letters near the cursor lift and glow ──
      if (!fine) return;
      const lifts = chars.map(c => gsap.quickTo(c, 'y', { duration: 0.6, ease: 'power3.out' }));
      const glows = chars.map(c => gsap.quickTo(c, '--glow', { duration: 0.5, ease: 'power2.out' }));
      const onMove = e => {
        if (window.scrollY > window.innerHeight) return;
        chars.forEach((c, i) => {
          const r = c.getBoundingClientRect();
          const d = Math.hypot(e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height / 2));
          const t = Math.max(0, 1 - d / 320);
          lifts[i](-t * t * 26);
          glows[i](t);
        });
      };
      window.addEventListener('pointermove', onMove, { passive: true });
      return () => {
        window.removeEventListener('pointermove', onMove);
        split.revert();
      };
    },
    { scope: root, dependencies: [active] }
  );

  // easter egg: knock on the title enough times and something happens
  const onTitleClick = () => {
    const n = ++clicks.current;
    sfx.knock();
    const chars = root.current.querySelectorAll('.hero__char');
    const c = chars[Math.floor(Math.random() * chars.length)];
    if (c) {
      const original = c.dataset.char || (c.dataset.char = c.textContent);
      gsap.to(c, {
        duration: 0.5,
        scrambleText: { text: original, chars: GLYPHS, speed: 1 }
      });
    }
    if (n === 3) toast('// something stirs. keep knocking.');
    if (n === 7) {
      clicks.current = 0;
      toast('>> hyperdrive engaged');
      bus.emit('galaxy:warp');
    }
  };

  return (
    <section className="hero" id="top" ref={root}>
      <div className="hero__inner">
        <p className="hero__label mono" data-intro>
          <span className="c-accent">~/</span>the_abyss <span className="c-dim">— studio · est. below the surface</span>
        </p>

        <h1 className="hero__title" onClick={onTitleClick} data-cursor="knock" data-no-pulse>
          <span className="hero__the">The</span>
          <span className="hero__abyss">Abyss</span>
        </h1>

        <p className="hero__tag" data-intro>
          We make websites, apps, games and strange little experiments.
          <br />
          Things you <em>fall into</em>.
        </p>

        <div className="hero__meta mono" data-intro>
          <span title="challenger deep — the deepest known point on earth">11°22′N 142°35′E</span>
          <span className="c-dim">/</span>
          <span>
            signal: <b className="c-ok">online</b>
          </span>
          <span className="c-dim">/</span>
          <span className="hint-fine">
            press <kbd>~</kbd> to open the terminal
          </span>
          <span className="hint-touch">
            tap <kbd>&gt;_ terminal</kbd> to open the shell
          </span>
        </div>
      </div>

      <button className="hero__scroll mono" data-intro onClick={() => scrollTo('#about')}>
        <span>scroll to descend</span>
        <span className="hero__line" aria-hidden="true" />
      </button>
    </section>
  );
}
