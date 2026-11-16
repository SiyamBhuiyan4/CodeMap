'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

type Star = { x: number; y: number; r: number; base: number; speed: number; phase: number; tint: string };
type Meteor = { x: number; y: number; vx: number; vy: number; life: number; maxLife: number; len: number };

const TINTS = ['255,255,255', '255,250,235', '220,230,255', '200,215,255'];

/**
 * Full-screen animated night sky that sits behind every page:
 * a gradient sky, a glowing full moon, twinkling stars and occasional shooting stars.
 * Moonlight is brighter in light mode and dimmer in dark mode (CSS variables in globals.css).
 * Stars and meteors are drawn on one canvas at ~30 fps, paused while the tab is hidden,
 * and frozen when the visitor prefers reduced motion.
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
    let meteors: Meteor[] = [];
    let starAlpha = 1;
    let nextMeteorAt = performance.now() + 1500 + Math.random() * 2500;
    let raf = 0;
    let last = 0;

    const readTheme = () => {
      const v = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--star-alpha'));
      starAlpha = isNaN(v) ? 1 : v;
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

      // Density scales with screen area, capped for performance
      const count = Math.min(420, Math.round((width * height) / 4200));
      stars = Array.from({ length: count }, () => {
        const big = Math.random() < 0.06;
        return {
          x: Math.random() * width,
          y: Math.random() * height,
          r: big ? 1.2 + Math.random() * 0.9 : 0.3 + Math.random() * 0.8,
          base: 0.35 + Math.random() * 0.65,
          speed: 0.6 + Math.random() * 1.8,
          phase: Math.random() * Math.PI * 2,
          tint: TINTS[Math.floor(Math.random() * TINTS.length)],
        };
      });
    };

    const spawnMeteor = () => {
      // Start near the top, travel down-left or down-right at a shallow angle
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

    const drawStar = (s: Star, t: number) => {
      const twinkle = reduceMotion ? 1 : 0.55 + 0.45 * Math.sin(t * 0.001 * s.speed + s.phase);
      const a = s.base * twinkle * starAlpha;
      ctx.beginPath();
      ctx.fillStyle = `rgba(${s.tint},${a})`;
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
      if (s.r > 1.2) {
        // Soft glow and a faint cross sparkle on the brightest stars
        ctx.fillStyle = `rgba(${s.tint},${a * 0.18})`;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r * 3.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = `rgba(${s.tint},${a * 0.35})`;
        ctx.lineWidth = 0.6;
        ctx.beginPath();
        ctx.moveTo(s.x - s.r * 4, s.y); ctx.lineTo(s.x + s.r * 4, s.y);
        ctx.moveTo(s.x, s.y - s.r * 4); ctx.lineTo(s.x, s.y + s.r * 4);
        ctx.stroke();
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
      // Bright head
      ctx.fillStyle = `rgba(255,255,255,${fade})`;
      ctx.beginPath();
      ctx.arc(m.x, m.y, 1.6, 0, Math.PI * 2);
      ctx.fill();
    };

    const frame = (t: number) => {
      raf = requestAnimationFrame(frame);
      if (t - last < 33) return; // ~30 fps is plenty for a backdrop
      last = t;
      ctx.clearRect(0, 0, width, height);
      for (const s of stars) drawStar(s, t);

      if (t > nextMeteorAt) {
        spawnMeteor();
        // Occasionally a pair, otherwise every 4-10 seconds
        nextMeteorAt = t + (Math.random() < 0.2 ? 600 : 4000 + Math.random() * 6000);
      }
      meteors = meteors.filter((m) => m.life < m.maxLife && m.x > -200 && m.x < width + 200 && m.y < height + 200);
      for (const m of meteors) {
        m.x += m.vx;
        m.y += m.vy;
        m.life += 1;
        drawMeteor(m);
      }
    };

    const start = () => {
      cancelAnimationFrame(raf);
      if (reduceMotion) {
        ctx.clearRect(0, 0, width, height);
        for (const s of stars) drawStar(s, 0);
        return;
      }
      raf = requestAnimationFrame(frame);
    };

    const onResize = () => { build(); start(); };
    const onVisibility = () => (document.hidden ? cancelAnimationFrame(raf) : start());
    const onTheme = () => { readTheme(); if (reduceMotion) start(); };

    readTheme();
    build();
    start();
    window.addEventListener('resize', onResize);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('themechange', onTheme);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('themechange', onTheme);
    };
  }, []);

  return (
    <div className="night-sky" data-dim-moon={dimMoon ? '' : undefined} aria-hidden="true">
      <div className="night-sky__moonlight" />
      <canvas ref={canvasRef} className="night-sky__stars" />
      <div className="night-sky__moon-halo" />
      <div className="night-sky__moon" />
      <div className="night-sky__horizon" />
    </div>
  );
}
