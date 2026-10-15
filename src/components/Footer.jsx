import { useRef } from 'react';
import { gsap, SplitText, useGSAP } from '../lib/gsap';
import { scrollTo } from '../lib/lenis';
import { bus } from '../lib/bus';
import CodeHeading from './CodeHeading';

export default function Footer() {
  const ref = useRef(null);

  useGSAP(
    () => {
      const split = SplitText.create('.signal__big', { type: 'lines,words', mask: 'lines' });
      gsap.from(split.words, {
        yPercent: 110,
        duration: 1.3,
        ease: 'expo.out',
        stagger: 0.04,
        scrollTrigger: { trigger: '.signal__big', start: 'top 85%', once: true }
      });
      return () => split.revert();
    },
    { scope: ref }
  );

  const surface = () => {
    bus.emit('galaxy:pulse', 1.6);
    scrollTo(0, { duration: 3.2 });
  };

  return (
    <footer className="signal section" id="signal" ref={ref}>
      <CodeHeading index="05" note="echo $DEPTH → 10935m · challenger deep">
        signal
      </CodeHeading>

      <h2 className="signal__big">
        You've reached the bottom. <em>Or have you?</em>
      </h2>

      <p className="signal__sub">
        New projects surface from down here every so often. Keep an eye on the dark, something is always <em>forming</em>.
      </p>

      <div className="signal__actions">
        <button className="btn btn--primary mono" onClick={surface}>
          ↑ return to surface
        </button>
        <button className="btn mono" onClick={() => bus.emit('terminal:open')}>
          <span className="term-icon" aria-hidden="true">
            &gt;<i>_</i>
          </span>
          open terminal
        </button>
      </div>

      <div className="signal__foot mono">
        <span>© {new Date().getFullYear()} the abyss</span>
        <span className="c-dim">built with react · three.js · gsap · lenis · react bits</span>
      </div>
    </footer>
  );
}
