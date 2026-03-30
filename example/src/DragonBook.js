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
const DRAG_SEGS = 28;
const SEG_DIST = 16;

const TEXT = `Long ago, in the age before stars had names, there lived a great dragon of emerald scales and golden eyes who made his home among the ancient libraries of the mountain realm. He was called Vermithrax the Keeper, and his breath smelled not of fire but of old parchment and forgotten ink.

The scholars who dwelt in those stone halls came to love him, for he would curl among the shelves on winter nights, his warm body heating the cold corridors. Sometimes he would read aloud to the sleeping scribes in a voice like rumbling thunder softened by years of speaking in hushed places.

One morning, a young apprentice named Elara found the dragon hunched over a crumbling manuscript, his great claw tracing the letters with surprising delicacy. She asked what he was reading, and without looking up, he said: every story ever told is still being told, somewhere, by someone who has not yet heard how it ends.`;

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

    canvas.width = page.offsetWidth;
    canvas.height = page.offsetHeight;

    segsRef.current = Array.from({ length: DRAG_SEGS }, () => ({ x: -999, y: -999 }));
  }, []);

  const drawDragon = useCallback((ctx, segs) => {
    if (segs.length < 2) return;
    const n = segs.length;

    const norm = (i) => {
      const a = segs[Math.max(0, i - 1)];
      const b = segs[Math.min(n - 1, i + 1)];
      const dx = b.x - a.x, dy = b.y - a.y;
      const len = Math.hypot(dx, dy) || 1;
      return { x: -dy / len, y: dx / len };
    };
    const getR = (i) => 19 * Math.pow(1 - i / n, 0.42) + 3;

    const INK = '#0e0c0a';
    const BONE = 'rgba(210, 200, 175, 0.22)';

    // Ribbon edges
    const top = segs.map((s, i) => { const nv = norm(i); const r = getR(i); return { x: s.x + nv.x * r, y: s.y + nv.y * r }; });
    const bot = segs.map((s, i) => { const nv = norm(i); const r = getR(i); return { x: s.x - nv.x * r, y: s.y - nv.y * r }; });

    // === BODY ===
    ctx.save();
    ctx.shadowBlur = 14;
    ctx.shadowColor = 'rgba(0, 0, 0, 0.55)';
    ctx.beginPath();
    ctx.moveTo(top[0].x, top[0].y);
    for (let i = 1; i < n; i++) ctx.lineTo(top[i].x, top[i].y);
    for (let i = n - 1; i >= 0; i--) ctx.lineTo(bot[i].x, bot[i].y);
    ctx.closePath();
    ctx.fillStyle = INK;
    ctx.fill();
    ctx.restore();

    // Scale arcs (faint ink lines on body)
    ctx.save();
    ctx.strokeStyle = BONE;
    ctx.lineWidth = 0.9;
    for (let i = 3; i < n - 1; i += 2) {
      const nv = norm(i); const r = getR(i);
      const ang = Math.atan2(segs[i].y - segs[Math.max(0, i - 1)].y, segs[i].x - segs[Math.max(0, i - 1)].x);
      ctx.beginPath();
      ctx.arc(segs[i].x + nv.x * 0, segs[i].y + nv.y * 0, r * 0.78, ang + 0.35, ang + Math.PI - 0.35);
      ctx.stroke();
    }
    ctx.restore();

    // === DORSAL SPINES ===
    ctx.save();
    for (let i = 1; i < n - 4; i += 2) {
      const nv = norm(i); const r = getR(i);
      const spLen = r * 1.7 + 5;
      const bx = segs[i].x + nv.x * r, by = segs[i].y + nv.y * r;
      ctx.beginPath();
      ctx.moveTo(bx - nv.y * r * 0.22, by + nv.x * r * 0.22);
      ctx.lineTo(bx + nv.x * spLen, by + nv.y * spLen);
      ctx.lineTo(bx + nv.y * r * 0.22, by - nv.x * r * 0.22);
      ctx.closePath();
      ctx.fillStyle = INK;
      ctx.fill();
      ctx.strokeStyle = BONE;
      ctx.lineWidth = 0.5;
      ctx.stroke();
    }
    ctx.restore();

    // === WINGS ===
    const wi = Math.floor(n * 0.3);
    if (segs[wi] && segs[wi + 1]) {
      const ws = segs[wi];
      const wn = norm(wi);
      const wr = getR(wi);
      const wAng = Math.atan2(ws.y - segs[wi + 1].y, ws.x - segs[wi + 1].x);

      [1, -1].forEach((side) => {
        const bx = ws.x - wn.x * wr * side;
        const by = ws.y - wn.y * wr * side;
        // Wing fingertips (3 points for bat-wing silhouette)
        const tip1x = bx - wn.x * 72 * side + Math.cos(wAng + Math.PI) * 28;
        const tip1y = by - wn.y * 72 * side + Math.sin(wAng + Math.PI) * 28;
        const tip2x = bx - wn.x * 80 * side + Math.cos(wAng) * 8;
        const tip2y = by - wn.y * 80 * side + Math.sin(wAng) * 8;
        const tip3x = bx - wn.x * 55 * side + Math.cos(wAng) * 52;
        const tip3y = by - wn.y * 55 * side + Math.sin(wAng) * 52;

        ctx.save();
        ctx.shadowBlur = 10;
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.lineTo(tip1x, tip1y);
        ctx.quadraticCurveTo(
          (tip1x + tip2x) / 2, (tip1y + tip2y) / 2,
          tip2x, tip2y
        );
        ctx.quadraticCurveTo(
          (tip2x + tip3x) / 2, (tip2y + tip3y) / 2,
          tip3x, tip3y
        );
        ctx.closePath();
        ctx.fillStyle = INK;
        ctx.fill();
        ctx.restore();

        // Wing bone spars
        ctx.save();
        ctx.strokeStyle = BONE;
        ctx.lineWidth = 0.9;
        ctx.lineCap = 'round';
        [[tip1x, tip1y], [tip2x, tip2y], [tip3x, tip3y]].forEach(([tx, ty]) => {
          ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(tx, ty); ctx.stroke();
        });
        // Membrane cross lines
        ctx.strokeStyle = 'rgba(210, 200, 175, 0.1)';
        ctx.lineWidth = 0.7;
        for (let t = 0.3; t < 0.9; t += 0.25) {
          ctx.beginPath();
          ctx.moveTo(bx + (tip1x - bx) * t, by + (tip1y - by) * t);
          ctx.lineTo(bx + (tip3x - bx) * t, by + (tip3y - by) * t);
          ctx.stroke();
        }
        ctx.restore();
      });
    }

    // === HEAD ===
    const h = segs[0];
    const neck = segs[1] ?? h;
    const ha = Math.atan2(h.y - neck.y, h.x - neck.x);
    const hp = ha + Math.PI / 2;

    ctx.save();
    ctx.shadowBlur = 12;
    ctx.shadowColor = 'rgba(0,0,0,0.6)';

    // Skull
    ctx.beginPath();
    ctx.ellipse(h.x + Math.cos(ha) * 4, h.y + Math.sin(ha) * 4, 18, 13, ha, 0, Math.PI * 2);
    ctx.fillStyle = INK;
    ctx.fill();

    // Snout (elongated)
    ctx.beginPath();
    ctx.ellipse(h.x + Math.cos(ha) * 19, h.y + Math.sin(ha) * 19, 12, 7, ha, 0, Math.PI * 2);
    ctx.fillStyle = INK;
    ctx.fill();
    ctx.restore();

    // Upper jaw profile line
    ctx.save();
    ctx.strokeStyle = BONE;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(h.x - Math.cos(ha) * 8, h.y - Math.sin(ha) * 8);
    ctx.quadraticCurveTo(
      h.x + Math.cos(ha) * 10 + Math.cos(hp) * 14,
      h.y + Math.sin(ha) * 10 + Math.sin(hp) * 14,
      h.x + Math.cos(ha) * 26, h.y + Math.sin(ha) * 26,
    );
    ctx.stroke();
    // Lower jaw
    ctx.beginPath();
    ctx.moveTo(h.x - Math.cos(ha) * 6, h.y - Math.sin(ha) * 6);
    ctx.quadraticCurveTo(
      h.x + Math.cos(ha) * 12 - Math.cos(hp) * 10,
      h.y + Math.sin(ha) * 12 - Math.sin(hp) * 10,
      h.x + Math.cos(ha) * 26, h.y + Math.sin(ha) * 26,
    );
    ctx.stroke();
    ctx.restore();

    // Teeth (small sharp triangles, ink fill with bone edge)
    ctx.save();
    ctx.fillStyle = 'rgba(235, 228, 205, 0.82)';
    [-0.28, 0.28].forEach((off) => {
      const tx = h.x + Math.cos(ha) * 21 + Math.cos(hp) * off * 15;
      const ty = h.y + Math.sin(ha) * 21 + Math.sin(hp) * off * 15;
      ctx.beginPath();
      ctx.moveTo(tx - Math.cos(hp) * off * 3, ty - Math.sin(hp) * off * 3);
      ctx.lineTo(tx + Math.cos(ha) * 7, ty + Math.sin(ha) * 7);
      ctx.lineTo(tx + Math.cos(hp) * off * 3, ty + Math.sin(hp) * off * 3);
      ctx.closePath();
      ctx.fill();
    });
    ctx.restore();

    // Swept-back horns
    ctx.save();
    ctx.shadowBlur = 6;
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    [1, -1].forEach((s) => {
      const hbx = h.x + Math.cos(hp) * s * 11 - Math.cos(ha) * 3;
      const hby = h.y + Math.sin(hp) * s * 11 - Math.sin(ha) * 3;
      const htx = h.x + Math.cos(hp) * s * 7 - Math.cos(ha) * 18;
      const hty = h.y + Math.sin(hp) * s * 7 - Math.sin(ha) * 18;
      const hcx = h.x + Math.cos(hp) * s * 20 - Math.cos(ha) * 10;
      const hcy = h.y + Math.sin(hp) * s * 20 - Math.sin(ha) * 10;
      // Thick horn as triangle
      ctx.beginPath();
      ctx.moveTo(hbx, hby);
      ctx.quadraticCurveTo(hcx, hcy, htx, hty);
      ctx.lineTo(h.x + Math.cos(hp) * s * 4 - Math.cos(ha) * 2, h.y + Math.sin(hp) * s * 4 - Math.sin(ha) * 2);
      ctx.closePath();
      ctx.fillStyle = INK;
      ctx.fill();
      // Horn highlight edge
      ctx.beginPath();
      ctx.moveTo(hbx, hby);
      ctx.quadraticCurveTo(hcx, hcy, htx, hty);
      ctx.strokeStyle = BONE;
      ctx.lineWidth = 0.7;
      ctx.stroke();
    });
    ctx.restore();

    // Frill / neck crest
    ctx.save();
    [1, -1].forEach((s) => {
      const frBase = segs[Math.min(3, n - 1)];
      const frNv = norm(Math.min(3, n - 1));
      const fr = getR(Math.min(3, n - 1));
      const frx = frBase.x + frNv.x * fr * s;
      const fry = frBase.y + frNv.y * fr * s;
      ctx.beginPath();
      ctx.moveTo(frx, fry);
      ctx.lineTo(frx + frNv.x * 22 * s, fry + frNv.y * 22 * s);
      ctx.lineTo(frx + frNv.x * 14 * s + Math.cos(Math.atan2(segs[0].y - segs[Math.min(3,n-1)].y, segs[0].x - segs[Math.min(3,n-1)].x)) * 12,
                 fry + frNv.y * 14 * s + Math.sin(Math.atan2(segs[0].y - segs[Math.min(3,n-1)].y, segs[0].x - segs[Math.min(3,n-1)].x)) * 12);
      ctx.closePath();
      ctx.fillStyle = INK;
      ctx.fill();
    });
    ctx.restore();

    // Glowing amber eyes — the only color on the whole dragon
    ctx.save();
    ctx.shadowBlur = 16;
    ctx.shadowColor = 'rgba(255, 180, 20, 1)';
    [1, -1].forEach((s) => {
      const ex = h.x + Math.cos(hp) * s * 5.5 + Math.cos(ha) * 6;
      const ey = h.y + Math.sin(hp) * s * 5.5 + Math.sin(ha) * 6;
      const eyeGrd = ctx.createRadialGradient(ex, ey, 0, ex, ey, 5);
      eyeGrd.addColorStop(0, '#fffcb0');
      eyeGrd.addColorStop(0.45, '#ffb800');
      eyeGrd.addColorStop(1, '#a06000');
      ctx.beginPath();
      ctx.ellipse(ex, ey, 4.5, 3.5, ha, 0, Math.PI * 2);
      ctx.fillStyle = eyeGrd;
      ctx.fill();
      // Slit pupil
      ctx.beginPath();
      ctx.ellipse(ex + Math.cos(ha) * 0.5, ey + Math.sin(ha) * 0.5, 1.1, 3, ha + Math.PI / 2, 0, Math.PI * 2);
      ctx.fillStyle = '#080400';
      ctx.fill();
    });
    ctx.restore();
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
