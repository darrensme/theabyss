import { useRef } from 'react';
import { gsap, useGSAP } from '../lib/gsap';
import { sfx } from '../lib/audio';

// "// projects"-style heading that decrypts itself when it scrolls into view
export default function CodeHeading({ children, index, note }) {
  const ref = useRef(null);

  useGSAP(
    () => {
      const word = ref.current.querySelector('.code-h__word');
      const text = word.textContent;
      gsap.set(word, { text: '' });
      gsap.to(word, {
        duration: 1.4,
        scrambleText: { text, chars: '01<>/{}[]_#', revealDelay: 0.3, speed: 0.6 },
        scrollTrigger: { trigger: ref.current, start: 'top 85%', once: true, onEnter: () => sfx.reveal() }
      });
      gsap.from(ref.current.querySelectorAll('.code-h__meta'), {
        opacity: 0,
        x: -12,
        duration: 0.8,
        stagger: 0.1,
        scrollTrigger: { trigger: ref.current, start: 'top 85%', once: true }
      });
    },
    { scope: ref }
  );

  return (
    <header className="code-h" ref={ref}>
      {index && <span className="code-h__meta code-h__index mono">{index}</span>}
      <h2 className="code-h__title mono">
        <span className="code-h__slash">//</span> <span className="code-h__word">{children}</span>
      </h2>
      {note && <p className="code-h__meta code-h__note mono">{note}</p>}
    </header>
  );
}
