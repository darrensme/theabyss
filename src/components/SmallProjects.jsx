import { useRef, useState } from 'react';
import { smallProjects } from '../data/projects';
import CodeHeading from './CodeHeading';
import SpotlightCard from './reactbits/SpotlightCard';
import GlitchText from './reactbits/GlitchText';
import { useCardMotion, useLockedCard } from './Projects';

const pad = n => String(n).padStart(2, '0');

// toys and experiments: smaller cards led by a screenshot
function SmallCard({ project, index }) {
  const ref = useRef(null);
  const [broken, setBroken] = useState(false);
  useCardMotion(ref, index);
  const host = project.url.replace(/^https?:\/\//, '').replace(/\/$/, '');

  return (
    <a ref={ref} className="pcard mini" href={project.url} target="_blank" rel="noopener noreferrer" data-cursor="play ↗">
      <SpotlightCard
        className="mini__inner"
        style={{ '--spotlight-card-surface': 'rgba(9, 8, 20, 0.82)' }}
        spotlightColor="#7fe3ff"
        intensity={0.16}
      >
        <div className="mini__shot">
          {project.image && !broken ? (
            <img src={project.image} alt="" loading="lazy" width="1200" height="630" onError={() => setBroken(true)} />
          ) : (
            <span className="mini__letter">{project.name[0]}</span>
          )}
          <span className="mini__no mono">s{pad(index + 1)}</span>
        </div>

        <div className="mini__body">
          <h3 className="mini__name">{project.name}</h3>
          <p className="mini__desc">{project.description}</p>
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
        </div>
      </SpotlightCard>
    </a>
  );
}

const DENIED = [
  'access denied.',
  "it's still in the oven.",
  'small things take time too.',
  'no peeking.',
  "fine. a hint: it's small.",
  'access denied.'
];

// the next toy, still compiling: a small version of the projects' locked card
function LockedSmall({ index }) {
  const ref = useRef(null);
  useCardMotion(ref, index);
  const deny = useLockedCard(ref, DENIED);

  return (
    <div
      ref={ref}
      className="pcard pcard--locked mini"
      role="button"
      tabIndex={0}
      aria-label="More small projects coming soon"
      onClick={deny}
      onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), deny())}
      data-cursor="locked"
      data-no-pulse
    >
      <SpotlightCard
        className="mini__inner locked"
        style={{ '--spotlight-card-surface': 'rgba(9, 8, 20, 0.82)' }}
        spotlightColor="#5ad1ff"
        intensity={0.12}
      >
        <div className="mini__shot mini__shot--locked" aria-hidden="true">
          <div className="pcard__icon locked__icon">
            <span className="pcard__orbit" />
            <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.6">
              <rect x="4.5" y="10.5" width="15" height="10" rx="2" />
              <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
              <circle cx="12" cy="15.5" r="1.2" fill="currentColor" />
            </svg>
          </div>
          <span className="mini__signal mono">no signal</span>
          <span className="mini__no mono">s{pad(index + 1)}</span>
        </div>

        <div className="mini__body">
          <div className="pcard__top mono">
            <span className="c-dim">next_toy.exe</span>
            <span className="pcard__status is-wip">
              <i /> compiling
            </span>
          </div>

          <GlitchText className="locked__title" speed={0.7} enableOnHover>
            classified
          </GlitchText>

          <div className="locked__bar mono">
            <span className="locked__track">
              <span className="locked__fill" />
            </span>
            <span className="locked__pct">0%</span>
          </div>

          <p className="locked__msg mono" aria-live="polite">
            <span className="c-dim">// more small things incoming</span>
          </p>
        </div>
      </SpotlightCard>
    </div>
  );
}

export default function SmallProjects() {
  return (
    <section className="smallp section" id="small-projects">
      <CodeHeading index="03" note={`ls ./small → ${smallProjects.length} toy${smallProjects.length === 1 ? '' : 's'}, made for fun`}>
        small projects
      </CodeHeading>

      <div className="smallp__grid">
        {smallProjects.map((project, i) => (
          <SmallCard key={project.name} project={project} index={i} />
        ))}
        <LockedSmall index={smallProjects.length} />
      </div>
    </section>
  );
}
