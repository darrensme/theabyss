import { useEffect, useRef, useState } from 'react';
import { gsap } from '../lib/gsap';
import { bus } from '../lib/bus';

let nextId = 0;

// small mono notifications in the corner: toast('message') from anywhere
export default function Toast() {
  const [items, setItems] = useState([]);
  const root = useRef(null);

  useEffect(
    () =>
      bus.on('toast', ({ message, duration = 3200 }) => {
        const id = ++nextId;
        setItems(list => [...list.slice(-3), { id, message }]);
        setTimeout(() => {
          const el = root.current?.querySelector(`[data-id="${id}"]`);
          const remove = () => setItems(list => list.filter(t => t.id !== id));
          if (el) gsap.to(el, { opacity: 0, x: -20, duration: 0.35, onComplete: remove });
          else remove();
        }, duration);
      }),
    []
  );

  useEffect(() => {
    const last = root.current?.lastElementChild;
    if (last && !last.dataset.shown) {
      last.dataset.shown = '1';
      gsap.from(last, { opacity: 0, y: 16, duration: 0.45, ease: 'power3.out' });
    }
  }, [items]);

  return (
    <div className="toasts mono" ref={root} aria-live="polite">
      {items.map(t => (
        <div className="toast" key={t.id} data-id={t.id}>
          {t.message}
        </div>
      ))}
    </div>
  );
}
