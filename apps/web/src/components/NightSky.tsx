'use client';

import { useEffect, useRef } from 'react';

type Star = {
  x: number; y: number; r: number; base: number; speed: number; phase: number; tint: string;
  depth: number; // 0.15 (far) .. 1 (near): how fast it drifts and how much it reacts to parallax
};
type Meteor = { x: number; y: number; vx: number; vy: number; life: number; maxLife: number; len: number };
const TINTS = ['255,255,255', '255,250,235', '220,230,255', '200,215,255'];
const WALK_SPEED = 7; // px/s drift of the nearest star layer

/**
 * Full-screen night sky behind every page, animated as if someone is walking under it:
 * - stars in three depth layers drift sideways at different speeds (parallax) and twinkle
 * - mouse movement and page scroll shift the layers slightly for depth
 * - shooting stars streak across every few seconds
 * Drawn on one canvas at ~30 fps, paused in hidden tabs, static under reduced motion.
 */
export default function NightSky() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

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
        if (t > nextMeteorAt && meteors.length < 3) {
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

    readTheme();
    build();
    start();
    window.addEventListener('resize', onResize);
    document.addEventListener('visibilitychange', onVisibility);
    if (!reduceMotion) window.addEventListener('pointermove', onPointer, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pointermove', onPointer);
    };
  }, []);

  return (
    <div className="night-sky" aria-hidden="true">
      <canvas ref={canvasRef} className="night-sky__stars" />
    </div>
  );
}
