import { useEffect, useRef, useState } from 'react';
import { gsap } from '../lib/gsap';
import { bus } from '../lib/bus';
import { getLenis, scrollTo } from '../lib/lenis';
import { projects } from '../data/projects';
import { crew } from '../data/crew';
import { crewStatus } from '../lib/CrewScene';

const SECTIONS = { top: '#top', about: '#about', projects: '#projects', crew: '#crew', lab: '#lab', signal: '#signal' };
const PROMPT = 'visitor@abyss:~$';

const HELP = `available commands:
  help                  this list
  ls                    list sections
  cd <section>          fly to a section
  projects              list projects
  crew                  who's down here
  open <project>        open a project in a new tab
  warp                  engage hyperdrive
  pulse                 send a shockwave through the galaxy
  tint <color|reset>    recolor the galaxy   e.g. tint #ff3366
  galaxy [--branches n] [--spin x] [--randomness x]
  whoami                who are you, really
  date                  current time
  echo <text>           say something into the void
  history               previous commands
  clear                 clear the screen
  exit                  close the terminal
psst: not every command is listed.`;

// one-tap commands (mostly for phones, where typing is a chore)
const QUICK = ['help', 'projects', 'crew', 'warp', 'pulse', 'stare', 'tint random', 'whoami', 'clear'];

const isTouch = () => window.matchMedia('(pointer: coarse)').matches;

const slug = s => s.toLowerCase().replace(/[^a-z0-9]/g, '');

function parseFlags(args) {
  const out = {};
  for (let i = 0; i < args.length; i++) {
    const m = /^--(\w+)$/.exec(args[i]);
    if (m) out[m[1]] = args[++i];
  }
  return out;
}

export default function Terminal() {
  const [open, setOpen] = useState(false);
  const [lines, setLines] = useState(() => [
    { text: '+--------------------------------------+\n|  ABYSS SHELL v1.0                    |\n|  a real, working terminal.           |\n+--------------------------------------+', cls: 'term__banner' },
    {
      text: isTouch()
        ? 'tap a command below, or tap the input to type your own.'
        : 'type a command and press enter. start with: help',
      cls: 'c-dim'
    },
    { text: `last login: ${new Date().toDateString()} from the surface`, cls: 'c-dim' }
  ]);
  const [value, setValue] = useState('');
  const history = useRef([]);
  const cursor = useRef(-1);
  const panel = useRef(null);
  const input = useRef(null);
  const out = useRef(null);

  const print = (...entries) =>
    setLines(l => [...l, ...entries.map(e => (typeof e === 'string' ? { text: e } : e))].slice(-200));

  // open with ~ or ` (but not while typing somewhere else), close with Esc.
  // typing "help" anywhere on the page also opens it and runs help.
  const pending = useRef(null);
  useEffect(() => {
    let typed = '';
    const onKey = e => {
      const typing = /^(INPUT|TEXTAREA)$/.test(document.activeElement?.tagName);
      if ((e.key === '~' || e.key === '`') && !typing) {
        e.preventDefault();
        setOpen(o => !o);
      } else if (e.key === 'Escape') setOpen(false);
      else if (!typing && e.key.length === 1) {
        typed = (typed + e.key.toLowerCase()).slice(-4);
        if (typed === 'help') {
          typed = '';
          pending.current = 'help';
          setOpen(true);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    const off = bus.on('terminal:open', () => setOpen(true));
    return () => {
      window.removeEventListener('keydown', onKey);
      off();
    };
  }, []);

  useEffect(() => {
    const lenis = getLenis();
    if (open) {
      lenis?.stop();
      gsap.fromTo(panel.current, { opacity: 0, y: 30, scale: 0.97 }, { opacity: 1, y: 0, scale: 1, duration: 0.45, ease: 'expo.out' });
      // don't pop the on-screen keyboard on phones until they tap the input
      if (!isTouch()) setTimeout(() => input.current?.focus(), 50);
      if (pending.current) {
        run(pending.current);
        pending.current = null;
      }
    } else {
      lenis?.start();
    }
  }, [open]);

  useEffect(() => {
    if (out.current) out.current.scrollTop = out.current.scrollHeight;
  }, [lines]);

  // Lenis is paused while the terminal is open, and start() cancels any
  // scroll in flight, so restart it *before* flying somewhere
  const travel = (target, options) => {
    getLenis()?.start();
    setOpen(false);
    scrollTo(target, options);
  };

  const run = raw => {
    // forgive `help`, "help", 'help' (backticks/quotes copied from instructions)
    const line = raw.trim().replace(/^[`'"]+|[`'"]+$/g, '').trim();
    print({ text: `${PROMPT} ${raw.trim()}`, cls: 'term__echo' });
    if (!line) return;
    history.current.push(line);
    cursor.current = -1;
    const [cmd, ...args] = line.split(/\s+/);
    const rest = line.slice(cmd.length).trim();

    switch (cmd.toLowerCase()) {
      case 'help':
        print({ text: HELP });
        break;
      case 'ls':
        print(Object.keys(SECTIONS).map(s => `${s}/`).join('   '));
        break;
      case 'cd': {
        const target = (args[0] ?? '').replace(/\/$/, '');
        if (!target || target === '~') travel(0);
        else if (target === '..') print('you can only go deeper.');
        else if (SECTIONS[target]) travel(SECTIONS[target], { offset: -40 });
        else print({ text: `cd: no such section: ${target}`, cls: 'c-err' });
        break;
      }
      case 'projects':
        projects.forEach((p, i) => print(`${String(i + 1).padStart(2, '0')}  ${p.name.padEnd(16)} ${p.url}`));
        print({ text: `${String(projects.length + 1).padStart(2, '0')}  ??????           [locked]`, cls: 'c-dim' });
        break;
      case 'crew':
      case 'who':
        crew.forEach((m, i) =>
          print(`${String(i + 1).padStart(3, '0')}  ${m.name.toLowerCase().padEnd(13)} ${m.role.padEnd(16)} online`)
        );
        break;
      case 'open': {
        const q = slug(rest);
        const hit = q && projects.find(p => slug(p.name).includes(q));
        if (hit) {
          print(`opening ${hit.url} ...`);
          window.open(hit.url, '_blank', 'noopener,noreferrer');
        } else print({ text: `open: no project matches "${rest}". try \`projects\``, cls: 'c-err' });
        break;
      }
      case 'warp':
        print('>> hyperdrive engaged. hold on.');
        bus.emit('galaxy:warp');
        break;
      case 'pulse':
        bus.emit('galaxy:pulse', 1.6);
        print('~ shockwave sent ~');
        break;
      case 'tint':
        if (!rest) print({ text: 'usage: tint <color|reset>', cls: 'c-err' });
        else if (rest === 'random') {
          const color = `hsl(${Math.floor(Math.random() * 360)}, 100%, 62%)`;
          bus.emit('galaxy:tint', color);
          print(`galaxy tinted ${color}.`);
        } else if (rest === 'reset') {
          bus.emit('galaxy:tint', null);
          print('galaxy colors restored.');
        } else if (CSS.supports('color', rest)) {
          bus.emit('galaxy:tint', rest);
          print(`galaxy tinted ${rest}.`);
        } else print({ text: `tint: "${rest}" is not a color`, cls: 'c-err' });
        break;
      case 'galaxy': {
        const f = parseFlags(args);
        const next = {};
        if (f.branches !== undefined) next.branches = Math.min(12, Math.max(1, parseInt(f.branches, 10) || 4));
        if (f.spin !== undefined) next.spin = parseFloat(f.spin) || 0;
        if (f.randomness !== undefined) next.randomness = Math.min(2, Math.max(0, parseFloat(f.randomness) || 0));
        if (!Object.keys(next).length) {
          bus.emit('galaxy:params', p => print(JSON.stringify(p)));
          print({ text: 'usage: galaxy --branches 5 --spin 1.4 --randomness 0.3', cls: 'c-dim' });
        } else {
          bus.emit('galaxy:rebuild', next);
          print(`regenerating galaxy with ${JSON.stringify(next)}`);
        }
        break;
      }
      case 'whoami': {
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        print(
          `a visitor from ${tz}`,
          `screen ${window.screen.width}×${window.screen.height} · ${navigator.hardwareConcurrency ?? '?'} cores · ${navigator.language}`,
          { text: 'the abyss knows. the abyss does not tell.', cls: 'c-dim' }
        );
        break;
      }
      case 'date':
        print(new Date().toString());
        break;
      case 'echo':
        print(rest || '…');
        break;
      case 'history':
        history.current.forEach((h, i) => print(`${String(i + 1).padStart(4)}  ${h}`));
        break;
      case 'clear':
        setLines([]);
        break;
      case 'exit':
      case 'quit':
        setOpen(false);
        break;
      // ── unlisted ──
      case 'stare':
        print('you stare into the abyss…');
        setTimeout(() => {
          print({ text: '…the abyss stares back.', cls: 'c-err' });
          bus.emit('galaxy:tint', '#ff1e3c');
          bus.emit('galaxy:pulse', 2);
          setTimeout(() => bus.emit('galaxy:tint', null), 4000);
        }, 1400);
        break;
      case 'sudo':
        print({ text: 'permission denied: you are not deep enough yet.', cls: 'c-err' });
        break;
      case 'rm':
        print({ text: 'nice try. the abyss cannot be deleted.', cls: 'c-err' });
        break;
      case 'hello':
      case 'hi':
        print('hello. we were expecting you.');
        break;
      case 'deeper':
        print('you remember the way down.');
        setTimeout(() => {
          setOpen(false);
          // after the terminal has closed (it restarts scrolling on close)
          setTimeout(() => bus.emit('deep:open'), 150);
        }, 700);
        break;
      case 'debug': {
        // what the browser's graphics look like, and how each crew object is doing
        let gpu = 'no webgl';
        try {
          const gl = document.createElement('canvas').getContext('webgl2') || document.createElement('canvas').getContext('webgl');
          const ext = gl?.getExtension('WEBGL_debug_renderer_info');
          gpu = gl ? `${gl instanceof WebGL2RenderingContext ? 'webgl2' : 'webgl1'} · ${ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'renderer hidden'}` : 'no webgl';
        } catch (err) {
          gpu = 'webgl error: ' + err.message;
        }
        print(
          `gpu      ${gpu}`,
          `screen   ${window.innerWidth}×${window.innerHeight} @ ${window.devicePixelRatio}x · ${navigator.userAgent.match(/(Chrome|Firefox|Safari)\/[\d.]+/)?.[0] ?? 'unknown browser'}`,
          `crew     ${crewStatus.length} objects`
        );
        crewStatus.forEach(c =>
          print(`  ${c.name.toLowerCase().padEnd(12)} ${c.form.padEnd(10)} ${c.ok ? 'ok' : 'FAILED'}  visible:${c.visible ? 'y' : 'n'}  born:${c.born ? 'y' : 'n'}${c.error ? '  ' + c.error : ''}`)
        );
        break;
      }
      case 'abyss':
        print('you are already here.');
        break;
      default:
        print({ text: `command not found: ${cmd}. try \`help\``, cls: 'c-err' });
    }
  };

  const onKeyDown = e => {
    const h = history.current;
    if (e.key === 'Enter') {
      run(value);
      setValue('');
    } else if (e.key === 'ArrowUp' && h.length) {
      e.preventDefault();
      cursor.current = cursor.current < 0 ? h.length - 1 : Math.max(0, cursor.current - 1);
      setValue(h[cursor.current]);
    } else if (e.key === 'ArrowDown' && cursor.current >= 0) {
      e.preventDefault();
      cursor.current = cursor.current + 1 >= h.length ? -1 : cursor.current + 1;
      setValue(cursor.current < 0 ? '' : h[cursor.current]);
    } else if (e.key === 'Tab') {
      e.preventDefault();
      const cmds = ['help', 'ls', 'cd', 'projects', 'crew', 'open', 'warp', 'pulse', 'tint', 'galaxy', 'whoami', 'date', 'echo', 'history', 'clear', 'exit'];
      const match = cmds.find(c => c.startsWith(value.trim()));
      if (match && value.trim()) setValue(match + ' ');
    } else if (e.key === 'l' && e.ctrlKey) {
      e.preventDefault();
      setLines([]);
    }
  };

  if (!open) return null;

  return (
    <div className="term" onPointerDown={e => e.target === e.currentTarget && setOpen(false)} data-no-pulse>
      <div className="term__panel" ref={panel} role="dialog" aria-label="Abyss terminal" onClick={() => !isTouch() && input.current?.focus()}>
        <div className="term__bar mono">
          <span className="loader__dots">
            <i onClick={() => setOpen(false)} />
            <i />
            <i />
          </span>
          <span className="term__title">
            <span className="term-icon" aria-hidden="true">
              &gt;<i>_</i>
            </span>
            visitor@abyss: ~ — zsh
          </span>
          <button className="term__close mono" onClick={() => setOpen(false)} aria-label="Close terminal">
            {isTouch() ? 'close ✕' : 'esc'}
          </button>
        </div>
        <div className="term__out mono" ref={out} data-lenis-prevent>
          {lines.map((l, i) => (
            <pre key={i} className={l.cls}>
              {l.text}
            </pre>
          ))}
          <div className="term__input">
            <span className="term__prompt">{PROMPT}</span>
            <input
              ref={input}
              value={value}
              onChange={e => setValue(e.target.value)}
              onKeyDown={onKeyDown}
              spellCheck="false"
              autoComplete="off"
              autoCapitalize="off"
              aria-label="Terminal input"
              enterKeyHint="go"
              placeholder={isTouch() ? 'tap to type…' : ''}
            />
          </div>
        </div>
        <div className="term__chips mono">
          {QUICK.map(cmd => (
            <button key={cmd} className="term__chip" onClick={() => run(cmd)}>
              {cmd}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
