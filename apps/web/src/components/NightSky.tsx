'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

type Star = {
  x: number; y: number; r: number; base: number; speed: number; phase: number; tint: string;
  depth: number; // 0.15 (far) .. 1 (near): how fast it drifts and how much it reacts to parallax
};
type Meteor = { x: number; y: number; vx: number; vy: number; life: number; maxLife: number; len: number };
const TINTS = ['255,255,255', '255,250,235', '220,230,255', '200,215,255'];
const WALK_SPEED = 7; // px/s drift of the nearest star layer

/**
 * Full-screen night sky behind every page, animated as if someone is walking under it.
 * Tapping the moon brings morning (light blue sky, the sun rises); tapping the sun brings night back:
 * - stars in three depth layers drift sideways at different speeds (parallax) and twinkle
 * - mouse movement and page scroll shift the layers slightly for depth
 * - shooting stars streak across every few seconds; the moon stays put, like a real distant moon
 * Drawn on one canvas at ~30 fps, paused in hidden tabs, static under reduced motion.
 */
export default function NightSky() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const moonRef = useRef<HTMLDivElement>(null);
  const haloRef = useRef<HTMLDivElement>(null);
  const sunRef = useRef<HTMLDivElement>(null);
  // On the architecture map the graph sits over the sky, so the moon is faded there
  const dimMoon = /\/architecture$/.test(usePathname() || '');

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let width = 0;
    let height = 0;
    let stars: Star[] = [];
    let meteors: Meteor[] = [];
    let starAlpha = 1;
    let nextMeteorAt = performance.now() + 800 + Math.random() * 1200;
    let raf = 0;
    let last = 0;
    let startTime = performance.now();
    // Parallax input, smoothed towards the target each frame
    let pointerX = 0, pointerY = 0, targetX = 0, targetY = 0;

    const readTheme = () => {
      const css = getComputedStyle(document.documentElement);
      const a = parseFloat(css.getPropertyValue('--star-alpha'));
      starAlpha = isNaN(a) ? 1 : a;
    };

    const build = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const count = Math.min(900, Math.round((width * height) / 1900));
      stars = Array.from({ length: count }, () => {
        const big = Math.random() < 0.05;
        const layer = Math.random();
        return {
          x: Math.random() * width,
          y: Math.random() * height,
          r: big ? 1.2 + Math.random() * 0.9 : Math.random() < 0.55 ? 0.25 + Math.random() * 0.35 : 0.5 + Math.random() * 0.6,
          base: 0.35 + Math.random() * 0.65,
          speed: 0.6 + Math.random() * 1.8,
          phase: Math.random() * Math.PI * 2,
          tint: TINTS[Math.floor(Math.random() * TINTS.length)],
          depth: big ? 1 : layer < 0.55 ? 0.15 : layer < 0.85 ? 0.45 : 0.8,
        };
      });
    };

    const spawnMeteor = () => {
      const fromLeft = Math.random() < 0.5;
      const angle = Math.PI / 7 + Math.random() * (Math.PI / 9); // 25-45 degrees below horizontal
      const speed = 9 + Math.random() * 6;
      const vx = Math.cos(angle) * speed;
      meteors.push({
        x: fromLeft ? Math.random() * width * 0.6 : width * 0.4 + Math.random() * width * 0.6,
        y: Math.random() * height * 0.35,
        vx: fromLeft ? vx : -vx,
        vy: Math.sin(angle) * speed,
        life: 0,
        maxLife: 45 + Math.random() * 25,
        len: 90 + Math.random() * 80,
      });
    };

    const wrap = (v: number, size: number) => ((v % size) + size) % size;

    const drawStars = (t: number, walked: number, scrollY: number) => {
      for (const s of stars) {
        const twinkle = reduceMotion ? 1 : 0.55 + 0.45 * Math.sin(t * 0.001 * s.speed + s.phase);
        const a = s.base * twinkle * starAlpha;
        const x = wrap(s.x - walked * s.depth + pointerX * 14 * s.depth, width);
        const y = wrap(s.y - scrollY * 0.04 * s.depth + pointerY * 8 * s.depth, height);
        ctx.beginPath();
        ctx.fillStyle = `rgba(${s.tint},${a})`;
        ctx.arc(x, y, s.r, 0, Math.PI * 2);
        ctx.fill();
        if (s.r > 1.2) {
          ctx.fillStyle = `rgba(${s.tint},${a * 0.18})`;
          ctx.beginPath();
          ctx.arc(x, y, s.r * 3.2, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = `rgba(${s.tint},${a * 0.35})`;
          ctx.lineWidth = 0.6;
          ctx.beginPath();
          ctx.moveTo(x - s.r * 4, y); ctx.lineTo(x + s.r * 4, y);
          ctx.moveTo(x, y - s.r * 4); ctx.lineTo(x, y + s.r * 4);
          ctx.stroke();
        }
      }
    };

    const drawMeteor = (m: Meteor) => {
      const progress = m.life / m.maxLife;
      const fade = progress < 0.15 ? progress / 0.15 : 1 - Math.max(0, (progress - 0.6) / 0.4);
      const mag = Math.hypot(m.vx, m.vy);
      const tx = m.x - (m.vx / mag) * m.len;
      const ty = m.y - (m.vy / mag) * m.len;
      const grad = ctx.createLinearGradient(m.x, m.y, tx, ty);
      grad.addColorStop(0, `rgba(255,255,255,${0.95 * fade})`);
      grad.addColorStop(0.3, `rgba(200,220,255,${0.45 * fade})`);
      grad.addColorStop(1, 'rgba(200,220,255,0)');
      ctx.strokeStyle = grad;
      ctx.lineWidth = 1.8;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(m.x, m.y);
      ctx.lineTo(tx, ty);
      ctx.stroke();
      ctx.fillStyle = `rgba(255,255,255,${fade})`;
      ctx.beginPath();
      ctx.arc(m.x, m.y, 1.6, 0, Math.PI * 2);
      ctx.fill();
    };

    const render = (t: number) => {
      const elapsed = reduceMotion ? 0 : (t - startTime) / 1000;
      pointerX += (targetX - pointerX) * 0.06;
      pointerY += (targetY - pointerY) * 0.06;
      ctx.clearRect(0, 0, width, height);
      drawStars(t, elapsed * WALK_SPEED, window.scrollY || 0);

      if (!reduceMotion) {
        if (t > nextMeteorAt && meteors.length < 3 && document.documentElement.dataset.sky !== 'day') {
          spawnMeteor();
          // Every 1.5-4.5 seconds, sometimes a quick pair; at most 3 in the sky at once
          nextMeteorAt = t + (Math.random() < 0.25 ? 450 : 1500 + Math.random() * 3000);
        }
        meteors = meteors.filter((m) => m.life < m.maxLife && m.x > -200 && m.x < width + 200 && m.y < height + 200);
        for (const m of meteors) {
          m.x += m.vx;
          m.y += m.vy;
          m.life += 1;
          drawMeteor(m);
        }
      }
    };

    const frame = (t: number) => {
      raf = requestAnimationFrame(frame);
      if (t - last < 33) return; // ~30 fps is plenty for a backdrop
      last = t;
      render(t);
    };

    const start = () => {
      cancelAnimationFrame(raf);
      if (reduceMotion) { render(0); return; }
      raf = requestAnimationFrame(frame);
    };

    const onResize = () => { build(); start(); };
    const onVisibility = () => {
      if (document.hidden) { cancelAnimationFrame(raf); return; }
      start();
    };
    const onPointer = (e: PointerEvent) => {
      targetX = (e.clientX / width - 0.5) * 2;   // -1 .. 1
      targetY = (e.clientY / height - 0.5) * 2;
    };

    // ---- Day / night: tap the moon for morning, tap the sun for night -------------------
    // The moon sets along an arc (∩) from the top-right towards the left while the sun rises
    // along a matching arc from the lower right into the moon's place (and the reverse).
    // Bodies are moved with transforms only, so the animation stays smooth.
    const DURATION = 3000;
    let animating = false;

    const home = (el: HTMLElement) => {
      const size = el.offsetWidth;
      return {
        size,
        x: window.innerWidth - window.innerWidth * 0.09 - size / 2,
        y: window.innerHeight * 0.09 + size / 2,
      };
    };
    const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
    const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

    // Offset from the home position along an arc that lifts by `lift` px at its middle
    const arc = (from: { x: number; y: number }, to: { x: number; y: number }, t: number, lift: number, h: { x: number; y: number }) => ({
      dx: from.x + (to.x - from.x) * t - h.x,
      dy: from.y + (to.y - from.y) * t - lift * Math.sin(Math.PI * t) - h.y,
    });

    const place = (el: HTMLElement | null, dx: number, dy: number, opacity: number) => {
      if (!el) return;
      el.style.transform = dx || dy ? `translate3d(${dx}px, ${dy}px, 0)` : '';
      el.style.opacity = String(opacity);
    };

    const switchSky = () => {
      const root = document.documentElement;
      const toDay = root.dataset.sky !== 'day';
      const setting = toDay ? moonRef.current : sunRef.current;
      const rising = toDay ? sunRef.current : moonRef.current;
      if (!setting || !rising || animating) return;
      root.dataset.sky = toDay ? 'day' : 'night';
      readTheme();

      const h = home(setting);
      const W = window.innerWidth;
      const H = window.innerHeight;
      const setEnd = { x: -h.size, y: H * 0.62 };        // sets beyond the left edge
      const riseStart = { x: W + h.size, y: H * 0.62 };  // rises from beyond the right edge
      const lift = Math.max(60, (setEnd.y - h.y) * 0.5 + h.y * 0.55);

      if (reduceMotion) {
        place(setting, setEnd.x - h.x, setEnd.y - h.y, 0);
        place(rising, 0, 0, 1);
        if (toDay) place(haloRef.current, setEnd.x - h.x, setEnd.y - h.y, 0);
        else place(haloRef.current, 0, 0, 1);
        return;
      }

      animating = true;
      const t0 = performance.now();
      const step = (now: number) => {
        const p = clamp01((now - t0) / DURATION);
        // Setting body travels during 0-75%, rising body during 25-100%
        const ps = ease(clamp01(p / 0.75));
        const pr = ease(clamp01((p - 0.25) / 0.75));
        const so = arc(h, setEnd, ps, lift, h);
        const ro = arc(riseStart, h, pr, lift, h);
        place(setting, so.dx, so.dy, 1 - clamp01((ps - 0.7) / 0.3));
        place(rising, ro.dx, ro.dy, clamp01(pr / 0.25));
        // The moon's halo travels with the moon
        if (toDay) place(haloRef.current, so.dx, so.dy, 1 - ps);
        else place(haloRef.current, ro.dx, ro.dy, pr);
        if (p < 1) requestAnimationFrame(step);
        else {
          animating = false;
          place(rising, 0, 0, 1);
        }
      };
      requestAnimationFrame(step);
    };

    // The sky sits behind the page, so taps are detected by position; taps on buttons,
    // links, fields, cards or the graph are ignored.
    const INTERACTIVE = 'a,button,input,textarea,select,label,[role="button"],[role="tab"],[role="link"],.card,.react-flow,.glass-bar';
    const onBody = (x: number, y: number, target: EventTarget | null) => {
      const el = document.documentElement.dataset.sky === 'day' ? sunRef.current : moonRef.current;
      if (!el || animating || (target instanceof Element && target.closest(INTERACTIVE))) return false;
      const r = el.getBoundingClientRect();
      return Math.hypot(x - (r.left + r.width / 2), y - (r.top + r.height / 2)) <= r.width / 2;
    };
    const onClick = (e: MouseEvent) => {
      if (onBody(e.clientX, e.clientY, e.target)) switchSky();
    };
    const onHover = (e: PointerEvent) => {
      document.documentElement.classList.toggle('moon-hover', onBody(e.clientX, e.clientY, e.target));
    };

    // Initial state: night (moon home, sun hidden below the right edge)
    if (document.documentElement.dataset.sky === 'day') {
      place(moonRef.current, 0, 0, 0);
      place(haloRef.current, 0, 0, 0);
      place(sunRef.current, 0, 0, 1);
    } else {
      place(sunRef.current, 0, 0, 0);
    }

    readTheme();
    build();
    start();
    document.addEventListener('click', onClick);
    window.addEventListener('pointermove', onHover, { passive: true });
    window.addEventListener('resize', onResize);
    document.addEventListener('visibilitychange', onVisibility);
    if (!reduceMotion) window.addEventListener('pointermove', onPointer, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pointermove', onPointer);
      document.removeEventListener('click', onClick);
      window.removeEventListener('pointermove', onHover);
      document.documentElement.classList.remove('moon-hover');
    };
  }, []);

  return (
    <div className="night-sky" data-dim-moon={dimMoon ? '' : undefined} aria-hidden="true">
      <div className="night-sky__day" />
      <div className="night-sky__moonlight" />
      <canvas ref={canvasRef} className="night-sky__stars" />
      <div ref={haloRef} className="night-sky__moon-halo" />
      <div ref={moonRef} className="night-sky__moon" />
      <div ref={sunRef} className="night-sky__sun" />
    </div>
  );
}
