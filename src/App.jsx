import { useEffect, useState } from 'react';
import { ScrollTrigger } from './lib/gsap';
import { initLenis, destroyLenis } from './lib/lenis';
import { bus } from './lib/bus';
import { initAudio } from './lib/audio';
import { useEasterEggs } from './hooks/useEasterEggs';
import ClickSpark from './components/reactbits/ClickSpark';
import Loader from './components/Loader';
import Galaxy from './components/Galaxy';
import HUD from './components/HUD';
import Hero from './components/Hero';
import Ticker from './components/Ticker';
import Manifesto from './components/Manifesto';
import Projects from './components/Projects';
import SmallProjects from './components/SmallProjects';
import Crew from './components/Crew';
import Lab from './components/Lab';
import Footer from './components/Footer';
import Terminal from './components/Terminal';
import DeepEgg from './components/DeepEgg';
import Toast from './components/Toast';
import Cursor from './components/Cursor';

// loading → revealing (loader animating out, galaxy being born) → ready
export default function App() {
  const [phase, setPhase] = useState('loading');
  const revealed = phase !== 'loading';
  const ready = phase === 'ready';

  useEffect(() => {
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    window.scrollTo(0, 0);
    const lenis = initLenis();
    lenis.stop();
    const stopAudio = initAudio();
    return () => {
      destroyLenis();
      stopAudio();
    };
  }, []);

  useEffect(() => {
    if (!revealed) return;
    initLenis().start();
    // layout is final once fonts are in: measure everything scroll-related
    document.fonts.ready.then(() => {
      ScrollTrigger.refresh();
      bus.emit('layout:ready');
    });
  }, [revealed]);

  useEasterEggs(ready);

  return (
    <>
      <ClickSpark
        sparkColor={['#c9b6ff', '#7fe3ff', '#ffd2a6']}
        sparkCount={9}
        sparkRadius={34}
        sparkSize={9}
        shape="star"
        glow={0.6}
        duration={650}
        className="app"
        style={{ height: 'auto' }}
      >
        <div className="app__inner" data-phase={phase}>
          <Galaxy born={revealed} />
          <div className="atmos" aria-hidden="true" />
          <HUD />
          <main>
            <Hero active={revealed} />
            <Ticker />
            <Manifesto />
            <Projects />
            <SmallProjects />
            <Crew />
            <Lab />
          </main>
          <Footer />
        </div>
      </ClickSpark>

      {ready && <Terminal />}
      {ready && <DeepEgg />}
      <Toast />
      <Cursor />
      {phase !== 'ready' && <Loader onReveal={() => setPhase('revealing')} onDone={() => setPhase('ready')} />}
    </>
  );
}
