import { useRef } from 'react';
import { gsap, useGSAP } from '../lib/gsap';
import { bus } from '../lib/bus';

// characters per second while "typing"
const CPS = 26;

const wait = ms => new Promise(r => setTimeout(r, ms));

export default function Loader({ onReveal, onDone }) {
  const root = useRef(null);

  useGSAP(
    () => {
      const el = root.current;
      const screen = el.querySelector('.loader__screen');
      const cursor = el.querySelector('.loader__cursor');
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      let cancelled = false;
      let speed = reduce ? 4 : 1;
      const timelines = [];

      const line = (prompt, cls = '') => {
        const row = document.createElement('div');
        row.className = `loader__line ${cls}`;
        row.innerHTML = `<span class="loader__prompt">${prompt}</span><span class="loader__typed"></span>`;
        screen.appendChild(row);
        row.appendChild(cursor);
        return row.querySelector('.loader__typed');
      };

      const type = (target, text, pause = 0.25) => {
        const tl = gsap.timeline({ paused: true });
        tl.to(target, { text: { value: text }, duration: text.length / CPS, ease: 'none' }).to({}, { duration: pause });
        timelines.push(tl);
        tl.timeScale(speed).play();
        return tl.then();
      };

      const print = (html, cls = 'loader__out') => {
        const row = document.createElement('div');
        row.className = `loader__line ${cls}`;
        row.innerHTML = html;
        screen.appendChild(row);
        gsap.from(row, { opacity: 0, x: -6, duration: 0.25 });
      };

      // any key / tap = "hurry up"
      const hurry = () => {
        speed = 5;
        timelines.forEach(t => t.timeScale(speed));
      };
      window.addEventListener('keydown', hurry);
      el.addEventListener('pointerdown', hurry);

      (async () => {
        await wait(350);
        await type(line('~ $&nbsp;', 'is-cmd'), 'abyss --init', 0.35);
        if (cancelled) return;
        const loading = line('&gt;&nbsp;');
        await type(loading, 'loading assets...', 0.1);

        // real work: fonts + the WebGL galaxy have to be ready before we enter
        const [, galaxy] = await Promise.all([
          document.fonts?.ready ?? Promise.resolve(),
          Promise.race([bus.waitFor('galaxy:ready'), wait(4000).then(() => null)])
        ]);
        if (cancelled) return;
        // time since the page started loading
        const ms = Math.round(performance.now());

        const ok = '<span class="loader__ok">✓</span>';
        print(`${ok} fonts&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;space grotesk · instrument serif · jetbrains mono`);
        await wait(110 / speed);
        if (galaxy) {
          print(`${ok} ${galaxy.gl}&nbsp;&nbsp;&nbsp;&nbsp;${galaxy.count.toLocaleString()} particles · ${galaxy.stars.toLocaleString()} stars`);
        } else {
          print(`<span class="loader__warn">!</span> webgl&nbsp;&nbsp;&nbsp;&nbsp;unavailable — falling back to the void`);
        }
        await wait(110 / speed);
        print(`${ok} ready&nbsp;&nbsp;&nbsp;&nbsp;${ms.toLocaleString()}ms since you arrived`);
        await wait(260 / speed);
        if (cancelled) return;

        await type(line('&gt;&nbsp;', 'is-final'), 'entering the abyss', 0.7);
        if (cancelled) return;

        // exit: the terminal collapses into a single point, the galaxy is born
        onReveal?.();
        gsap
          .timeline({ onComplete: () => onDone?.() })
          .to(screen, { scale: 0.96, opacity: 0, filter: 'blur(6px)', duration: 0.6, ease: 'power2.in' })
          .to(el, { clipPath: 'circle(0% at 50% 50%)', duration: 1.1, ease: 'expo.inOut' }, 0.15);
      })();

      return () => {
        cancelled = true;
        window.removeEventListener('keydown', hurry);
        el.removeEventListener('pointerdown', hurry);
      };
    },
    { scope: root }
  );

  return (
    <div className="loader" ref={root} aria-live="polite" aria-label="Loading The Abyss">
      <div className="loader__frame">
        <div className="loader__bar mono">
          <span className="loader__dots">
            <i />
            <i />
            <i />
          </span>
          <span>abyss — zsh — 80×24</span>
        </div>
        <div className="loader__screen mono">
          <span className="loader__cursor" aria-hidden="true" />
        </div>
      </div>
      <p className="loader__hint mono">press any key to hurry</p>
    </div>
  );
}
