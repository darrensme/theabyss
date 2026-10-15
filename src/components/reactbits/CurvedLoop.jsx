// CurvedLoop — from React Bits (reactbits.dev, JS + CSS variant).
// Local changes for The Abyss:
//  - no React state update per frame (the original re-rendered 60×/s)
//  - `getBoost` prop: returns a speed multiplier (we feed it scroll velocity)
//  - optional `band` stroke behind the text, so it reads like a bent news banner
//  - re-measures after web fonts load, touch-friendly dragging

import { useRef, useEffect, useState, useMemo, useId } from 'react';
import './CurvedLoop.css';

const CurvedLoop = ({
  marqueeText = '',
  speed = 2,
  className,
  curveAmount = 400,
  direction = 'left',
  interactive = true,
  getBoost,
  band,
  bandWidth = 130
}) => {
  const text = useMemo(() => {
    const hasTrailing = /\s| $/.test(marqueeText);
    return (hasTrailing ? marqueeText.replace(/\s+$/, '') : marqueeText) + ' ';
  }, [marqueeText]);

  const measureRef = useRef(null);
  const textPathRef = useRef(null);
  const pathRef = useRef(null);
  const [spacing, setSpacing] = useState(0);
  const uid = useId();
  const pathId = `curve-${uid}`;
  const pathD = `M-100,40 Q500,${40 + curveAmount} 1540,40`;

  const dragRef = useRef(false);
  const lastXRef = useRef(0);
  const dirRef = useRef(direction);
  const velRef = useRef(0);
  const offsetRef = useRef(0);
  const boostRef = useRef(getBoost);
  boostRef.current = getBoost;

  const textLength = spacing;
  const totalText = textLength
    ? Array(Math.ceil(1800 / textLength) + 2)
        .fill(text)
        .join('')
    : text;
  const ready = spacing > 0;

  useEffect(() => {
    const measure = () => {
      if (measureRef.current) setSpacing(measureRef.current.getComputedTextLength());
    };
    measure();
    document.fonts?.ready.then(measure);
  }, [text, className]);

  const wrap = value => {
    if (value <= -spacing) value += spacing;
    if (value > 0) value -= spacing;
    return value;
  };

  const apply = value => {
    offsetRef.current = value;
    textPathRef.current?.setAttribute('startOffset', value + 'px');
  };

  useEffect(() => {
    if (!spacing) return;
    apply(-spacing);
  }, [spacing]);

  useEffect(() => {
    if (!spacing || !ready) return;
    let frame = 0;
    let last = performance.now();
    const step = now => {
      // normalise to 60fps so 120Hz screens don't scroll twice as fast
      const k = Math.min((now - last) / 16.667, 3);
      last = now;
      if (!dragRef.current && textPathRef.current) {
        const boost = boostRef.current ? boostRef.current() : 1;
        const delta = (dirRef.current === 'right' ? speed : -speed) * boost * k;
        apply(wrap(offsetRef.current + delta));
      }
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [spacing, speed, ready]);

  const onPointerDown = e => {
    if (!interactive) return;
    dragRef.current = true;
    lastXRef.current = e.clientX;
    velRef.current = 0;
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = e => {
    if (!interactive || !dragRef.current || !textPathRef.current) return;
    // the svg is scaled to fit the screen: convert screen px → viewBox units
    const scale = 1440 / e.currentTarget.getBoundingClientRect().width;
    const dx = (e.clientX - lastXRef.current) * scale;
    lastXRef.current = e.clientX;
    velRef.current = dx;
    apply(wrap(offsetRef.current + dx));
  };

  const endDrag = () => {
    if (!interactive || !dragRef.current) return;
    dragRef.current = false;
    if (velRef.current !== 0) dirRef.current = velRef.current > 0 ? 'right' : 'left';
  };

  return (
    <div
      className="curved-loop-jacket"
      data-cursor="drag"
      style={{ visibility: ready ? 'visible' : 'hidden', cursor: interactive ? 'grab' : 'auto' }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onLostPointerCapture={endDrag}
    >
      <svg className="curved-loop-svg" viewBox="0 0 1440 120">
        <text
          ref={measureRef}
          xmlSpace="preserve"
          className={className}
          style={{ visibility: 'hidden', opacity: 0, pointerEvents: 'none' }}
        >
          {text}
        </text>
        <defs>
          <path ref={pathRef} id={pathId} d={pathD} fill="none" />
        </defs>
        {band && <use href={`#${pathId}`} stroke={band} strokeWidth={bandWidth} fill="none" />}
        {ready && (
          <text fontWeight="bold" xmlSpace="preserve" className={className} dy="0.35em">
            <textPath ref={textPathRef} href={`#${pathId}`} startOffset={-spacing + 'px'} xmlSpace="preserve">
              {totalText}
            </textPath>
          </text>
        )}
      </svg>
    </div>
  );
};

export default CurvedLoop;
