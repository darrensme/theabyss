import { useEffect, useRef } from 'react';
import { gsap, useGSAP } from '../lib/gsap';
import { bus, toast } from '../lib/bus';
import { crew } from '../data/crew';
import { CrewObject, formLabel } from '../lib/CrewScene';
import CodeHeading from './CodeHeading';
import SpotlightCard from './reactbits/SpotlightCard';

const GLYPHS = '01<>/{}[]_#░▒';
const pad = n => String(n).padStart(3, '0');
let tintReset;
let warned = false;

function Member({ member, index }) {
  const ref = useRef(null);
  const canvasRef = useRef(null);
  const objRef = useRef(null);

  // this card's own particle object, drawn only while the card is on screen
  useEffect(() => {
    const card = ref.current;
    let obj;
    try {
      obj = objRef.current = new CrewObject(canvasRef.current, card.querySelector('.crew__body'), member);
    } catch (err) {
      console.warn(`[abyss] crew object for ${member.name} failed`, err);
      if (!warned) {
        warned = true;
        toast('> crew visuals failed to start. type `debug` in the terminal');
      }
      return;
    }

    const io = new IntersectionObserver(([entry]) => {
      obj.visible = entry.isIntersecting;
      // already on screen when it loads (e.g. after a refresh mid-page)? form now
      if (entry.isIntersecting && card.getBoundingClientRect().top < window.innerHeight * 0.92) obj.birth(0.2);
    });
    io.observe(card);

    return () => {
      io.disconnect();
      obj.dispose();
      objRef.current = null;
    };
  }, [member]);

  useGSAP(
    () => {
      const card = ref.current;
      const name = card.querySelector('.crew__name');
      const trigger = { trigger: card, start: 'top 92%', once: true };

      // arrive: card rises, the object forms out of nothing, name decrypts
      gsap.from(card, { y: 60, opacity: 0, duration: 1.2, ease: 'expo.out', delay: index * 0.1, scrollTrigger: trigger });
      gsap.timeline({ scrollTrigger: { ...trigger, onEnter: () => objRef.current?.birth(0.2 + index * 0.15) } });
      gsap.set(name, { text: '' });
      gsap.to(name, {
        duration: 1.3,
        delay: 0.4 + index * 0.15,
        scrambleText: { text: member.name, chars: GLYPHS, revealDelay: 0.4, speed: 0.5 },
        scrollTrigger: trigger
      });

      // desktop: the object tilts toward the cursor and spins up on hover
      if (!window.matchMedia('(pointer: fine)').matches) return;
      let tx, ty;
      const move = e => {
        const obj = objRef.current;
        if (!obj) return;
        tx ??= gsap.quickTo(obj.tilt, 'x', { duration: 0.9, ease: 'power3.out' });
        ty ??= gsap.quickTo(obj.tilt, 'y', { duration: 0.9, ease: 'power3.out' });
        const r = card.getBoundingClientRect();
        tx((e.clientX - r.left) / r.width - 0.5);
        ty((e.clientY - r.top) / r.height - 0.5);
      };
      const enter = () => {
        objRef.current?.hover(true);
        gsap.to(name, { duration: 0.6, scrambleText: { text: member.name, chars: GLYPHS, speed: 0.8 } });
      };
      const leave = () => {
        objRef.current?.hover(false);
        tx?.(0);
        ty?.(0);
      };
      card.addEventListener('pointermove', move);
      card.addEventListener('pointerenter', enter);
      card.addEventListener('pointerleave', leave);
      return () => {
        card.removeEventListener('pointermove', move);
        card.removeEventListener('pointerenter', enter);
        card.removeEventListener('pointerleave', leave);
      };
    },
    { scope: ref }
  );

  // tap / click: the object explodes and reforms, the galaxy answers in their colour
  const ping = () => {
    objRef.current?.ping();
    bus.emit('galaxy:tint', member.color);
    bus.emit('galaxy:pulse', 1.4);
    clearTimeout(tintReset);
    tintReset = setTimeout(() => bus.emit('galaxy:tint', null), 1800);
    toast(`> ping ${member.name.toLowerCase()} … ${member.ping ?? 'pong ✦'}`);
  };

  return (
    <div
      ref={ref}
      className="crew__member"
      style={{ '--c': member.color }}
      role="button"
      tabIndex={0}
      onClick={ping}
      onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), ping())}
      data-cursor="ping"
      data-no-pulse
      aria-label={`${member.name}, ${member.role}. Tap to ping.`}
    >
      <SpotlightCard
        className="crew__card"
        style={{ '--spotlight-card-surface': 'rgba(9, 8, 20, 0.82)' }}
        spotlightColor={member.color}
        intensity={0.16}
      >
        <canvas className="crew__gl" ref={canvasRef} aria-hidden="true" />
        <div className="crew__top mono">
          <span className="c-dim">pid {pad(index + 1)}</span>
          <span className="crew__status">
            <i /> online
          </span>
        </div>

        <div className="crew__body" aria-hidden="true" />
        <p className="crew__const mono">obj. {formLabel(member.form)}</p>

        <h3 className="crew__name">{member.name}</h3>
        <p className="crew__role mono">
          <span className="c-dim">role:</span> <span className="crew__role-val">"{member.role}"</span>
        </p>
      </SpotlightCard>
    </div>
  );
}

export default function Crew() {
  return (
    <section className="crew section" id="crew">
      <CodeHeading index="04" note={`who --all → ${crew.length} signals online. tap one to ping it.`}>
        crew
      </CodeHeading>

      <div className="crew__grid" style={{ '--cols': Math.min(crew.length, 5) }}>
        {crew.map((member, i) => (
          <Member key={member.name} member={member} index={i} />
        ))}
      </div>
    </section>
  );
}
