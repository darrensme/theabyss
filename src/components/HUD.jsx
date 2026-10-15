import { useEffect, useRef } from 'react';
import { scrollTo } from '../lib/lenis';
import { bus } from '../lib/bus';

// Challenger Deep, the deepest known point in the ocean: the bottom of the page
const MAX_DEPTH = 10935;

const NAV = [
  { href: '#about', label: 'about' },
  { href: '#projects', label: 'projects' },
  { href: '#crew', label: 'crew' },
  { href: '#lab', label: 'lab' },
  { href: '#signal', label: 'signal' }
];

export default function HUD() {
  const depthRef = useRef(null);
  const barRef = useRef(null);

  useEffect(() => {
    // written straight to the DOM: no React re-render on every scroll frame
    let raf = 0;
    const update = () => {
      raf = 0;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const p = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
      if (depthRef.current) depthRef.current.textContent = Math.round(p * MAX_DEPTH).toLocaleString('en-US');
      if (barRef.current) barRef.current.style.transform = `scaleY(${p})`;
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    // secret: pushing past the bottom keeps the counter going (see DeepEgg)
    const offDeep = bus.on('deep:pressure', p => {
      if (depthRef.current && p > 0) depthRef.current.textContent = Math.round(MAX_DEPTH + p * 4065).toLocaleString('en-US');
      else update();
    });
    // Lenis scrolls the real window, so the native event is enough
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      offDeep();
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  const go = (e, href) => {
    e.preventDefault();
    scrollTo(href, { offset: -40 });
  };

  return (
    <>
      <header className="hud">
        <a className="hud__logo mono" href="#top" onClick={e => go(e, 0)} aria-label="The Abyss — back to top">
          <span className="hud__orb" aria-hidden="true" />
          the_abyss
        </a>
        <nav className="hud__nav mono" aria-label="Sections">
          {NAV.map(item => (
            <a key={item.href} href={item.href} onClick={e => go(e, item.href)}>
              {item.label}
            </a>
          ))}
          <button className="hud__term" onClick={() => bus.emit('terminal:open')} aria-label="Open terminal">
            <span className="term-icon" aria-hidden="true">
              &gt;<i>_</i>
            </span>
            terminal
          </button>
        </nav>
      </header>

      <div className="depth mono" aria-hidden="true">
        <span className="depth__label">depth</span>
        <span className="depth__track">
          <span className="depth__fill" ref={barRef} />
        </span>
        <span className="depth__value">
          −<span ref={depthRef}>0</span>m
        </span>
      </div>
    </>
  );
}
