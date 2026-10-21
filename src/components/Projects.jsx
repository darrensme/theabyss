import { useRef, useState } from 'react';
import { gsap, useGSAP } from '../lib/gsap';
import { projects } from '../data/projects';
import CodeHeading from './CodeHeading';
import SpotlightCard from './reactbits/SpotlightCard';
import GlitchText from './reactbits/GlitchText';

const pad = n => String(n).padStart(2, '0');

const CARD_SURFACE = { '--spotlight-card-surface': 'rgba(9, 8, 20, 0.82)' };

// shared: cards rise in on scroll and tilt toward the cursor (desktop only)
export function useCardMotion(ref, index) {
  useGSAP(
    () => {
      const card = ref.current;
      gsap.from(card, {
        y: 70,
        opacity: 0,
        rotateX: 14,
        duration: 1.3,
        ease: 'expo.out',
        delay: (index % 3) * 0.1,
        scrollTrigger: { trigger: card, start: 'top 90%', once: true }
      });

      if (!window.matchMedia('(pointer: fine)').matches) return;
      const rx = gsap.quickTo(card, 'rotationX', { duration: 0.7, ease: 'power3.out' });
      const ry = gsap.quickTo(card, 'rotationY', { duration: 0.7, ease: 'power3.out' });
      const move = e => {
        const r = card.getBoundingClientRect();
        rx(-((e.clientY - r.top) / r.height - 0.5) * 9);
        ry(((e.clientX - r.left) / r.width - 0.5) * 11);
      };
      const leave = () => {
        rx(0);
        ry(0);
      };
      card.addEventListener('pointermove', move);
      card.addEventListener('pointerleave', leave);
      return () => {
        card.removeEventListener('pointermove', move);
        card.removeEventListener('pointerleave', leave);
      };
    },
    { scope: ref }
  );
}

function ProjectIcon({ project }) {
  const [broken, setBroken] = useState(false);
  return (
    <div className="pcard__icon">
      <span className="pcard__orbit" aria-hidden="true" />
      {project.icon && !broken ? (
        <img src={project.icon} alt="" width="44" height="44" onError={() => setBroken(true)} />
      ) : (
        <span className="pcard__letter">{project.name[0]}</span>
      )}
    </div>
  );
}

function ProjectCard({ project, index }) {
  const ref = useRef(null);
  useCardMotion(ref, index);
  const host = project.url.replace(/^https?:\/\//, '').replace(/\/$/, '');

  return (
    <a
      ref={ref}
      className="pcard"
      href={project.url}
      target="_blank"
      rel="noopener noreferrer"
      data-cursor="open ↗"
    >
      <SpotlightCard className="pcard__inner" style={CARD_SURFACE} spotlightColor="#a78bfa" intensity={0.2}>
        <div className="pcard__top mono">
          <span className="c-dim">{pad(index + 1)}</span>
          <span className={`pcard__status is-${project.status ?? 'live'}`}>
            <i /> {project.status ?? 'live'}
          </span>
        </div>

        <ProjectIcon project={project} />

        <h3 className="pcard__name">{project.name}</h3>
        <p className="pcard__desc">{project.description}</p>

        <div className="pcard__foot mono">
          <ul className="pcard__tags">
            {project.tags?.map(t => (
              <li key={t}>#{t}</li>
            ))}
          </ul>
          <span className="pcard__go">
            {host} <span className="pcard__arrow">↗</span>
          </span>
        </div>
      </SpotlightCard>
    </a>
  );
}

const DENIED = [
  'access denied.',
  "patience. it's still forming.",
  "it isn't ready to be seen yet.",
  'stop poking it.',
  'fine. a hint: it glows.',
  'access denied.'
];

function LockedCard({ index }) {
  const ref = useRef(null);
  const tries = useRef(0);
  useCardMotion(ref, index);

  useGSAP(
    () => {
      const bar = ref.current.querySelector('.locked__fill');
      const pct = ref.current.querySelector('.locked__pct');
      const state = { p: 0 };
      // a progress bar that never quite finishes
      const tl = gsap.timeline({ repeat: -1, paused: true });
      tl.set(state, { p: 0 })
        .to(state, {
          p: 97,
          duration: 7,
          ease: 'rough({ strength: 1.4, points: 24, taper: "none", randomize: true, clamp: true })',
          onUpdate: () => {
            bar.style.transform = `scaleX(${state.p / 100})`;
            pct.textContent = `${Math.floor(state.p)}%`;
          }
        })
        .to(bar, { opacity: 0.25, duration: 0.08, repeat: 7, yoyo: true })
        .add(() => (pct.textContent = 'ERR'))
        .to({}, { duration: 1.2 });

      // only animate while visible
      gsap.timeline({
        scrollTrigger: {
          trigger: ref.current,
          start: 'top bottom',
          end: 'bottom top',
          onToggle: self => (self.isActive ? tl.play() : tl.pause())
        }
      });
    },
    { scope: ref }
  );

  const deny = () => {
    const msg = DENIED[Math.min(tries.current++, DENIED.length - 1)];
    const out = ref.current.querySelector('.locked__msg');
    gsap.fromTo(ref.current, { x: 0 }, { keyframes: { x: [0, -10, 9, -6, 4, 0] }, duration: 0.45, ease: 'none' });
    gsap.fromTo(out, { text: '' }, { text: `> ${msg}`, duration: msg.length / 40, ease: 'none' });
  };

  return (
    <div
      ref={ref}
      className="pcard pcard--locked"
      role="button"
      tabIndex={0}
      aria-label="More projects coming soon"
      onClick={deny}
      onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), deny())}
      data-cursor="locked"
      data-no-pulse
    >
      <SpotlightCard className="pcard__inner locked" style={CARD_SURFACE} spotlightColor="#5ad1ff" intensity={0.12}>
        <div className="pcard__top mono">
          <span className="c-dim">{pad(index + 1)}</span>
          <span className="pcard__status is-wip">
            <i /> compiling
          </span>
        </div>

        <div className="pcard__icon locked__icon" aria-hidden="true">
          <span className="pcard__orbit" />
          <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.6">
            <rect x="4.5" y="10.5" width="15" height="10" rx="2" />
            <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
            <circle cx="12" cy="15.5" r="1.2" fill="currentColor" />
          </svg>
        </div>

        <GlitchText className="locked__title" speed={0.7} enableOnHover>
          classified
        </GlitchText>

        <p className="locked__line mono">
          &gt; next_project.exe loading<span className="locked__dots" />
        </p>

        <div className="locked__bar mono" aria-hidden="true">
          <span className="locked__track">
            <span className="locked__fill" />
          </span>
          <span className="locked__pct">0%</span>
        </div>

        <p className="locked__msg mono" aria-live="polite">
          <span className="c-dim">// more projects incoming</span>
        </p>
      </SpotlightCard>
    </div>
  );
}

export default function Projects() {
  return (
    <section className="projects section" id="projects">
      <CodeHeading index="02" note={`ls ./projects → ${projects.length} found, more on the way`}>
        projects
      </CodeHeading>

      <div className="projects__grid">
        {projects.map((project, i) => (
          <ProjectCard key={project.name} project={project} index={i} />
        ))}
        <LockedCard index={projects.length} />
      </div>
    </section>
  );
}
