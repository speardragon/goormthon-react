import { useEffect, useRef, useCallback } from 'react';
import { prepareWithSegments, layoutWithLines } from '@chenglou/pretext';
import './DragonBook.css';

const FONT_SIZE = 18;
const FONT = `${FONT_SIZE}px Georgia`;
const LINE_HEIGHT = 34;
const PAD_X = 70;
const PAD_Y = 80;
const REPULSE_R = 120;
const REPULSE_S = 9;
const SPRING_K = 0.12;
const DAMPING = 0.75;
const DRAG_SEGS = 18;
const SEG_DIST = 22;

const TEXT = `Long ago, in the age before stars had names, there lived a great dragon of emerald scales and golden eyes who made his home among the ancient libraries of the mountain realm. He was called Vermithrax the Keeper, and his breath smelled not of fire but of old parchment and forgotten ink.

The scholars who dwelt in those stone halls came to love him, for he would curl among the shelves on winter nights, his warm body heating the cold corridors. Sometimes he would read aloud to the sleeping scribes in a voice like rumbling thunder softened by years of speaking in hushed places.

One morning, a young apprentice named Elara found the dragon hunched over a crumbling manuscript, his great claw tracing the letters with surprising delicacy. She asked what he was reading, and without looking up, he said: every story ever told is still being told, somewhere, by someone who has not yet heard how it ends.

She did not understand him then. But she kept those words in a small box in her memory, and years later, when she became the keeper of the library in his stead, she would take them out and turn them over in her mind like smooth river stones, finding new facets each time, wondering if the dragon had known even then that she would one day need them.`;

export default function DragonBook() {
  const pageRef = useRef(null);
  const canvasRef = useRef(null);
  const charsRef = useRef([]);
  const segsRef = useRef([]);
  const mouseRef = useRef({ x: -999, y: -999 });
  const rafRef = useRef(null);

  const buildLayout = useCallback(() => {
    const page = pageRef.current;
    const canvas = canvasRef.current;
    if (!page || !canvas) return;

    // Remove old char spans, preserve canvas
    Array.from(page.children).forEach((c) => {
      if (c !== canvas) page.removeChild(c);
    });
    charsRef.current = [];

    const availW = page.clientWidth - PAD_X * 2;
    if (availW <= 0) return;

    // Canvas context for font measuring
    const mc = document.createElement('canvas');
    const mctx = mc.getContext('2d');
    mctx.font = FONT;

    let lineIdx = 0;
    TEXT.split('\n\n').forEach((para, pi, arr) => {
      const prepared = prepareWithSegments(para.trim(), FONT);
      const { lines } = layoutWithLines(prepared, availW, LINE_HEIGHT);

      lines.forEach((line) => {
        let x = PAD_X;
        const y = PAD_Y + lineIdx * LINE_HEIGHT;
        for (const ch of [...line.text]) {
          const w = mctx.measureText(ch).width;
          const span = document.createElement('span');
          span.textContent = ch;
          span.className = 'bc';
          span.style.cssText = `left:${x}px;top:${y}px`;
          page.appendChild(span);
          charsRef.current.push({ el: span, bx: x, by: y, ox: 0, oy: 0, vx: 0, vy: 0 });
          x += w;
        }
        lineIdx++;
      });

      if (pi < arr.length - 1) lineIdx += 0.7;
    });

    const totalH = PAD_Y * 2 + Math.ceil(lineIdx) * LINE_HEIGHT;
    page.style.height = `${totalH}px`;
    canvas.width = page.offsetWidth;
    canvas.height = totalH;

    segsRef.current = Array.from({ length: DRAG_SEGS }, () => ({ x: -999, y: -999 }));
  }, []);

  const drawDragon = useCallback((ctx, segs) => {
    if (!segs.length) return;

    // Body: tail → head
    for (let i = segs.length - 1; i >= 1; i--) {
      const t = i / (segs.length - 1);
      const r = 13 * (1 - t * 0.5) + 2;
      ctx.beginPath();
      ctx.arc(segs[i].x, segs[i].y, r, 0, Math.PI * 2);
      ctx.fillStyle = `hsl(${120 - t * 30}, ${70 - t * 20}%, ${25 + t * 10}%)`;
      ctx.fill();
      // Scale highlight
      ctx.beginPath();
      ctx.arc(segs[i].x - r * 0.3, segs[i].y - r * 0.3, r * 0.4, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(100, 220, 60, ${0.25 * (1 - t)})`;
      ctx.fill();
    }

    // Wings at ~30% body length
    const wi = Math.floor(segs.length * 0.28);
    if (segs[wi] && segs[wi + 1]) {
      const ws = segs[wi];
      const ang = Math.atan2(ws.y - segs[wi + 1].y, ws.x - segs[wi + 1].x);
      [1, -1].forEach((side) => {
        const perp = ang + (Math.PI / 2) * side;
        ctx.beginPath();
        ctx.moveTo(ws.x + Math.cos(perp) * 8, ws.y + Math.sin(perp) * 8);
        ctx.lineTo(
          ws.x + Math.cos(perp) * 40 + Math.cos(ang + Math.PI) * 8,
          ws.y + Math.sin(perp) * 40 + Math.sin(ang + Math.PI) * 8,
        );
        ctx.lineTo(
          ws.x + Math.cos(perp) * 24 + Math.cos(ang) * 16,
          ws.y + Math.sin(perp) * 24 + Math.sin(ang) * 16,
        );
        ctx.closePath();
        ctx.fillStyle = 'rgba(30, 100, 20, 0.82)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(80, 200, 60, 0.5)';
        ctx.lineWidth = 1;
        ctx.stroke();
      });
    }

    // Head
    const h = segs[0];
    const n = segs[1] ?? h;
    const ha = Math.atan2(h.y - n.y, h.x - n.x);
    const hp = ha + Math.PI / 2;

    ctx.beginPath();
    ctx.arc(h.x, h.y, 15, 0, Math.PI * 2);
    ctx.fillStyle = 'hsl(120, 68%, 22%)';
    ctx.fill();
    ctx.strokeStyle = 'hsl(120, 80%, 48%)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Horns
    [1, -1].forEach((s) => {
      ctx.beginPath();
      ctx.moveTo(h.x + Math.cos(hp) * s * 7, h.y + Math.sin(hp) * s * 7);
      ctx.lineTo(
        h.x + Math.cos(ha) * 13 + Math.cos(hp) * s * 3,
        h.y + Math.sin(ha) * 13 + Math.sin(hp) * s * 3,
      );
      ctx.lineTo(h.x + Math.cos(hp) * s * 3, h.y + Math.sin(hp) * s * 3);
      ctx.closePath();
      ctx.fillStyle = 'hsl(45, 90%, 55%)';
      ctx.fill();
    });

    // Eyes
    [1, -1].forEach((s) => {
      const ex = h.x + Math.cos(hp) * s * 5 + Math.cos(ha) * 5;
      const ey = h.y + Math.sin(hp) * s * 5 + Math.sin(ha) * 5;
      ctx.beginPath();
      ctx.arc(ex, ey, 4, 0, Math.PI * 2);
      ctx.fillStyle = 'hsl(45, 100%, 60%)';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(ex + Math.cos(ha), ey + Math.sin(ha), 2, 0, Math.PI * 2);
      ctx.fillStyle = '#000';
      ctx.fill();
    });

    // Nose glow
    const nx = h.x + Math.cos(ha) * 15;
    const ny = h.y + Math.sin(ha) * 15;
    const grd = ctx.createRadialGradient(nx, ny, 0, nx, ny, 8);
    grd.addColorStop(0, 'rgba(255, 120, 0, 0.9)');
    grd.addColorStop(1, 'rgba(255, 60, 0, 0)');
    ctx.beginPath();
    ctx.arc(nx, ny, 8, 0, Math.PI * 2);
    ctx.fillStyle = grd;
    ctx.fill();
  }, []);

  const animate = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const segs = segsRef.current;
    const { x: mx, y: my } = mouseRef.current;

    // Head follows mouse with lerp
    segs[0].x += (mx - segs[0].x) * 0.15;
    segs[0].y += (my - segs[0].y) * 0.15;

    // Chain body segments
    for (let i = 1; i < segs.length; i++) {
      const dx = segs[i].x - segs[i - 1].x;
      const dy = segs[i].y - segs[i - 1].y;
      const d = Math.hypot(dx, dy);
      if (d > SEG_DIST) {
        const f = (d - SEG_DIST) / d;
        segs[i].x -= dx * f * 0.6;
        segs[i].y -= dy * f * 0.6;
      }
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawDragon(ctx, segs);

    // Character repulsion physics (check only front segments)
    const checkSegs = segs.slice(0, 10);
    for (const c of charsRef.current) {
      let fx = 0;
      let fy = 0;
      for (const s of checkSegs) {
        const dx = c.bx - s.x;
        const dy = c.by - s.y;
        const d = Math.hypot(dx, dy);
        if (d < REPULSE_R && d > 0.1) {
          const mag = ((1 - d / REPULSE_R) ** 2) * REPULSE_S;
          fx += (dx / d) * mag;
          fy += (dy / d) * mag;
        }
      }

      // Spring force toward base position
      fx += (0 - c.ox) * SPRING_K;
      fy += (0 - c.oy) * SPRING_K;

      c.vx = (c.vx + fx) * DAMPING;
      c.vy = (c.vy + fy) * DAMPING;
      c.ox += c.vx;
      c.oy += c.vy;

      if (Math.abs(c.ox) > 0.05 || Math.abs(c.oy) > 0.05) {
        c.el.style.transform = `translate(${c.ox}px,${c.oy}px)`;
      }
    }

    rafRef.current = requestAnimationFrame(animate);
  }, [drawDragon]);

  useEffect(() => {
    buildLayout();
    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [buildLayout, animate]);

  useEffect(() => {
    const onResize = () => {
      cancelAnimationFrame(rafRef.current);
      buildLayout();
      rafRef.current = requestAnimationFrame(animate);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [buildLayout, animate]);

  const onMouseMove = useCallback((e) => {
    const rect = pageRef.current?.getBoundingClientRect();
    if (rect) {
      mouseRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    }
  }, []);

  const onMouseLeave = useCallback(() => {
    mouseRef.current = { x: -999, y: -999 };
  }, []);

  return (
    <div className="book-scene">
      <div
        className="book-page"
        ref={pageRef}
        onMouseMove={onMouseMove}
        onMouseLeave={onMouseLeave}
      >
        <canvas ref={canvasRef} className="dragon-canvas" />
      </div>
    </div>
  );
}
