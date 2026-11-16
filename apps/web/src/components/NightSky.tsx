'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

type Star = {
  x: number; y: number; r: number; base: number; speed: number; phase: number; tint: string;
  depth: number; // 0.15 (far) .. 1 (near): how fast it drifts and how much it reacts to parallax
};
type Meteor = { x: number; y: number; vx: number; vy: number; life: number; maxLife: number; len: number };
type Hill = {
  heights: Float32Array; // ridge height (px) sampled every STEP px over one period
  period: number;        // pattern repeats every `period` px, so scrolling is seamless
  speed: number;         // px per second while "walking"
  depth: number;         // parallax strength
  fill: string;
  rim: string;           // moonlit edge colour (alpha scaled by moonlight)
  trees: { x: number; h: number }[];
};

const TINTS = ['255,255,255', '255,250,235', '220,230,255', '200,215,255'];
const STEP = 6;
const WALK_SPEED = 7; // px/s drift of the nearest star layer

/**
 * Full-screen night sky behind every page, animated as if someone is walking under it:
 * - stars in three depth layers drift sideways at different speeds (parallax) and twinkle
 * - three layers of moonlit hills with pine trees scroll past at the bottom
 * - mouse movement and page scroll shift the layers slightly for depth
 * - shooting stars streak across every few seconds; the moon stays put, like a real distant moon
 * Drawn on one canvas at ~30 fps, paused in hidden tabs, static under reduced motion.
 */
export default function NightSky() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
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
    let hills: Hill[] = [];
    let meteors: Meteor[] = [];
    let starAlpha = 1;
    let moonlight = 0.2;
    let nextMeteorAt = performance.now() + 800 + Math.random() * 1200;
    let raf = 0;
    let last = 0;
    let startTime = performance.now();
    // Parallax input, smoothed towards the target each frame
    let pointerX = 0, pointerY = 0, targetX = 0, targetY = 0;

    const readTheme = () => {
      const css = getComputedStyle(document.documentElement);
      const a = parseFloat(css.getPropertyValue('--star-alpha'));
      const g = parseFloat(css.getPropertyValue('--moon-glow-a'));
      starAlpha = isNaN(a) ? 1 : a;
      moonlight = isNaN(g) ? 0.2 : g;
    };

    // Seamless ridge: a sum of sines whose frequencies are whole multiples of the period
    const makeRidge = (period: number, base: number, amp: number, seed: number) => {
      const n = Math.ceil(period / STEP);
      const heights = new Float32Array(n + 1);
      const waves = [1, 2, 3, 5, 8, 13].map((k, i) => ({
        k, a: amp / (i + 1.4), p: (seed * (i + 1) * 2.399) % (Math.PI * 2),
      }));
      for (let i = 0; i <= n; i++) {
        const x = (i * STEP) / period;
        let h = base;
        for (const w of waves) h += w.a * Math.sin(2 * Math.PI * w.k * x + w.p);
        heights[i] = Math.max(8, h);
      }
      return heights;
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

      const period = Math.max(1400, Math.ceil(width * 1.6));
      const scale = Math.min(1, height / 900);
      const mk = (base: number, amp: number, seed: number, speed: number, depth: number, fill: string, rim: string, treeEvery: number, treeH: number): Hill => {
        const heights = makeRidge(period, base * scale, amp * scale, seed);
        const trees: { x: number; h: number }[] = [];
        if (treeEvery > 0) {
          for (let x = Math.random() * treeEvery; x < period; x += treeEvery * (0.35 + Math.random() * 1.3)) {
            // Small clusters of pines
            const cluster = 1 + Math.floor(Math.random() * 3);
            for (let c = 0; c < cluster; c++) trees.push({ x: (x + c * 9) % period, h: (treeH * (0.6 + Math.random() * 0.7)) * scale });
          }
        }
        return { heights, period, speed, depth, fill, rim, trees };
      };
      hills = [
        mk(170, 70, 1.7, 9, 0.25, '#0a1638', '170,190,255', 0, 0),
        mk(120, 48, 4.1, 20, 0.5, '#071029', '160,180,240', 70, 26),
        mk(70, 30, 7.3, 38, 0.9, '#030816', '140,160,230', 46, 38),
      ];
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

    const ridgeAt = (hill: Hill, worldX: number) => {
      const p = wrap(worldX, hill.period) / STEP;
      const i = Math.floor(p);
      const f = p - i;
      return hill.heights[i] * (1 - f) + hill.heights[i + 1] * f;
    };

    const drawHills = (elapsed: number) => {
      for (const hill of hills) {
        const offset = elapsed * hill.speed - pointerX * 20 * hill.depth;
        const lift = pointerY * 6 * hill.depth;
        ctx.beginPath();
        ctx.moveTo(0, height);
        for (let x = 0; x <= width + STEP; x += STEP) {
          ctx.lineTo(x, height - ridgeAt(hill, x + offset) + lift);
        }
        ctx.lineTo(width, height);
        ctx.closePath();
        ctx.fillStyle = hill.fill;
        ctx.fill();

        // Moonlit rim along the ridge, stronger when the moon is bright
        ctx.strokeStyle = `rgba(${hill.rim},${0.08 + moonlight * 0.25})`;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        for (let x = 0; x <= width + STEP; x += STEP) {
          const y = height - ridgeAt(hill, x + offset) + lift;
          if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();

        // Pine trees standing on the ridge
        if (hill.trees.length) {
          ctx.fillStyle = hill.fill;
          for (const tree of hill.trees) {
            const sx = wrap(tree.x - offset, hill.period);
            for (const x of [sx, sx - hill.period, sx + hill.period]) {
              if (x < -20 || x > width + 20) continue;
              const ground = height - ridgeAt(hill, x + offset) + lift + 2;
              const h = tree.h;
              const w = h * 0.42;
              ctx.beginPath();
              ctx.moveTo(x, ground - h);
              ctx.lineTo(x + w * 0.55, ground - h * 0.55);
              ctx.lineTo(x + w * 0.35, ground - h * 0.55);
              ctx.lineTo(x + w * 0.75, ground - h * 0.2);
              ctx.lineTo(x + w * 0.1, ground - h * 0.2);
              ctx.lineTo(x + w * 0.1, ground);
              ctx.lineTo(x - w * 0.1, ground);
              ctx.lineTo(x - w * 0.1, ground - h * 0.2);
              ctx.lineTo(x - w * 0.75, ground - h * 0.2);
              ctx.lineTo(x - w * 0.35, ground - h * 0.55);
              ctx.lineTo(x - w * 0.55, ground - h * 0.55);
              ctx.closePath();
              ctx.fill();
            }
          }
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
      drawHills(elapsed);
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
    const onTheme = () => { readTheme(); if (reduceMotion) start(); };
    const onPointer = (e: PointerEvent) => {
      targetX = (e.clientX / width - 0.5) * 2;   // -1 .. 1
      targetY = (e.clientY / height - 0.5) * 2;
    };

    readTheme();
    build();
    start();
    window.addEventListener('resize', onResize);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('themechange', onTheme);
    if (!reduceMotion) window.addEventListener('pointermove', onPointer, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('themechange', onTheme);
      window.removeEventListener('pointermove', onPointer);
    };
  }, []);

  return (
    <div className="night-sky" data-dim-moon={dimMoon ? '' : undefined} aria-hidden="true">
      <div className="night-sky__moonlight" />
      <canvas ref={canvasRef} className="night-sky__stars" />
      <div className="night-sky__moon-halo" />
      <div className="night-sky__moon" />
    </div>
  );
}
