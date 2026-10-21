import { useRef, useState } from 'react';
import { smallProjects } from '../data/projects';
import CodeHeading from './CodeHeading';
import SpotlightCard from './reactbits/SpotlightCard';
import { useCardMotion } from './Projects';

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
            <img src={project.image} alt="" loading="lazy" width="880" height="495" onError={() => setBroken(true)} />
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
        <div className="mini mini--ghost mono" aria-hidden="true">
          <span>+</span>
          <p>more small things
            <br />
            wash up here
          </p>
        </div>
      </div>
    </section>
  );
}
