import { useEffect, useState } from 'react';
import { bus, toast } from '../lib/bus';
import { hasSoundPref, isSoundOn, onSoundChange, toggleSound } from '../lib/audio';

// HUD button: four little equaliser bars that dance while sound is on
export default function SoundToggle() {
  const [on, setOn] = useState(isSoundOn);
  // first visit: glow a little until they've made a choice
  const [fresh, setFresh] = useState(() => !hasSoundPref());

  useEffect(
    () =>
      onSoundChange(v => {
        setOn(v);
        setFresh(false);
      }),
    []
  );

  // first visit: mention it once the page has settled
  useEffect(() => {
    if (hasSoundPref()) return;
    let timer;
    const off = bus.on('layout:ready', () => {
      timer = setTimeout(() => {
        if (!hasSoundPref()) toast(window.matchMedia('(pointer: fine)').matches ? '♪ this place has sound. press M, or the ♪ button up top' : '♪ this place has sound. tap ♪ up top');
      }, 3800);
    });
    return () => {
      off();
      clearTimeout(timer);
    };
  }, []);

  return (
    <button
      className={`snd mono${on ? ' is-on' : ''}${fresh ? ' is-fresh' : ''}`}
      onClick={toggleSound}
      aria-pressed={on}
      aria-label={on ? 'Sound on. Click to mute' : 'Sound off. Click for music and sound effects'}
      title={on ? 'mute (M)' : 'sound on (M)'}
    >
      <span className="snd__bars" aria-hidden="true">
        <i />
        <i />
        <i />
        <i />
      </span>
      <span className="snd__label">{on ? 'sound' : 'muted'}</span>
    </button>
  );
}
