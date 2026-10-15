import { useEffect } from 'react';
import { bus, toast } from '../lib/bus';

const KONAMI = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];

export function useEasterEggs(active) {
  useEffect(() => {
    if (!active) return;

    // 1. a note for whoever opens devtools
    console.log(
      '%c\n   ◉  THE ABYSS\n\n%c   you opened the console. curious.\n   press ~ on the page. try `stare`.\n',
      'font: 700 16px monospace; color: #b9a4ff',
      'font: 12px monospace; color: #8a87a8'
    );

    // 2. konami code → the abyss turns red
    let pos = 0;
    let red = false;
    const onKey = e => {
      if (/^(INPUT|TEXTAREA)$/.test(document.activeElement?.tagName)) return;
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      pos = key === KONAMI[pos] ? pos + 1 : key === KONAMI[0] ? 1 : 0;
      if (pos === KONAMI.length) {
        pos = 0;
        red = !red;
        bus.emit('galaxy:tint', red ? '#ff1e3c' : null);
        bus.emit('galaxy:pulse', 2);
        toast(red ? '↑↑↓↓←→←→BA — the abyss stares back.' : '// colour restored. it was never really gone.');
      }
    };

    // 3. leave the tab and the abyss notices
    const title = document.title;
    const onVisibility = () => {
      document.title = document.hidden ? 'come back to the abyss…' : title;
    };

    // 4. sit still long enough and it checks on you (once)
    let idle;
    let asked = false;
    const resetIdle = () => {
      clearTimeout(idle);
      if (!asked)
        idle = setTimeout(() => {
          asked = true;
          toast('> still there?', { duration: 4200 });
        }, 45000);
    };

    window.addEventListener('keydown', onKey);
    document.addEventListener('visibilitychange', onVisibility);
    ['pointermove', 'keydown', 'scroll', 'touchstart'].forEach(ev => window.addEventListener(ev, resetIdle, { passive: true }));
    resetIdle();

    return () => {
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('visibilitychange', onVisibility);
      ['pointermove', 'keydown', 'scroll', 'touchstart'].forEach(ev => window.removeEventListener(ev, resetIdle));
      clearTimeout(idle);
      document.title = title;
    };
  }, [active]);
}
