import CurvedLoop from './reactbits/CurvedLoop';
import { getScrollVelocity } from '../lib/lenis';

const LINE_A = 'NOW ENTERING THE ABYSS ✦ NEW PROJECTS INCOMING ✦ STARE BACK ✦ ';
const LINE_B = 'SIGNAL DETECTED ✦ DEPTH UNKNOWN ✦ DO NOT LOOK DOWN ✦ YOU ARE NOT ALONE DOWN HERE ✦ ';

// fast scrolling = faster ticker (velocity is in px/frame from Lenis)
const boost = () => 1 + Math.min(Math.abs(getScrollVelocity()) * 0.12, 7);

export default function Ticker() {
  return (
    <section className="ticker" id="ticker" aria-label="Announcements">
      <svg width="0" height="0" aria-hidden="true" style={{ position: 'absolute' }}>
        <defs>
          <linearGradient id="tickerBand" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stopColor="#7c5cff" />
            <stop offset="0.5" stopColor="#b9a4ff" />
            <stop offset="1" stopColor="#5ad1ff" />
          </linearGradient>
        </defs>
      </svg>

      <p className="ticker__label mono">
        <span className="c-dim">/*</span> live feed — drag me <span className="c-dim">*/</span>
      </p>

      <div className="ticker__band ticker__band--a">
        <CurvedLoop
          marqueeText={LINE_A}
          speed={1.3}
          curveAmount={180}
          direction="left"
          className="ticker__text ticker__text--dark"
          band="url(#tickerBand)"
          bandWidth={128}
          getBoost={boost}
        />
      </div>
      <div className="ticker__band ticker__band--b">
        <CurvedLoop
          marqueeText={LINE_B}
          speed={1}
          curveAmount={-140}
          direction="right"
          className="ticker__text ticker__text--ghost"
          band="#07070f"
          bandWidth={124}
          getBoost={boost}
        />
      </div>
    </section>
  );
}
