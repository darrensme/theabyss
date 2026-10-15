import { useRef } from 'react';
import { gsap, SplitText, useGSAP } from '../lib/gsap';
import CodeHeading from './CodeHeading';

export default function Manifesto() {
  const ref = useRef(null);

  useGSAP(
    () => {
      // words light up one by one as you scroll through the paragraph
      const split = SplitText.create('.manifesto__text', { type: 'words', wordsClass: 'manifesto__word' });
      gsap.fromTo(
        split.words,
        { opacity: 0.12 },
        {
          opacity: 1,
          stagger: 0.05,
          ease: 'none',
          scrollTrigger: { trigger: '.manifesto__text', start: 'top 80%', end: 'bottom 45%', scrub: true }
        }
      );
      gsap.from('.manifesto__aside > *', {
        opacity: 0,
        y: 20,
        stagger: 0.12,
        duration: 1,
        ease: 'power3.out',
        scrollTrigger: { trigger: '.manifesto__aside', start: 'top 85%', once: true }
      });
      return () => split.revert();
    },
    { scope: ref }
  );

  return (
    <section className="manifesto section" id="about" ref={ref}>
      <CodeHeading index="01" note="cat ./about.md">
        about
      </CodeHeading>

      <p className="manifesto__text">
        The Abyss is a studio for things that don't fit in a box — websites, apps, games, tools and experiments that
        start as a strange idea at 3am. We like the deep end. We build things that <em>pull you in</em> and quietly
        refuse to let go.
      </p>

      <div className="manifesto__aside mono">
        <p>
          <span className="c-dim">→</span> scroll slowly. it goes <em>deeper</em> than it looks
        </p>
        <p>
          <span className="c-dim">→</span> the galaxy behind this text is real-time, try clicking it
        </p>
        <p>
          <span className="c-dim">→</span> some things on this page are hidden
        </p>
      </div>
    </section>
  );
}
