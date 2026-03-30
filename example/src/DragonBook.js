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
const DRAG_SEGS = 26;
const SEG_DIST = 18;

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

    // Perpendicular normal at segment i
    const norm = (i) => {
      const a = segs[Math.max(0, i - 1)];
      const b = segs[Math.min(n - 1, i + 1)];
      const dx = b.x - a.x, dy = b.y - a.y;
      const len = Math.hypot(dx, dy) || 1;
      return { x: -dy / len, y: dx / len };
    };
    const getR = (i) => 16 * Math.pow(1 - i / n, 0.45) + 2;

    // Build ribbon edges
    const top = segs.map((s, i) => { const nv = norm(i); const r = getR(i); return { x: s.x + nv.x * r, y: s.y + nv.y * r }; });
    const bot = segs.map((s, i) => { const nv = norm(i); const r = getR(i); return { x: s.x - nv.x * r, y: s.y - nv.y * r }; });

    // === BODY SHADOW AURA ===
    ctx.save();
    ctx.shadowBlur = 28;
    ctx.shadowColor = 'rgba(200, 40, 10, 0.65)';

    // Body fill
    ctx.beginPath();
    ctx.moveTo(top[0].x, top[0].y);
    for (let i = 1; i < n; i++) ctx.lineTo(top[i].x, top[i].y);
    for (let i = n - 1; i >= 0; i--) ctx.lineTo(bot[i].x, bot[i].y);
    ctx.closePath();
    const bodyGrd = ctx.createLinearGradient(segs[0].x, segs[0].y, segs[n - 1].x, segs[n - 1].y);
    bodyGrd.addColorStop(0, '#c01818');
    bodyGrd.addColorStop(0.5, '#860c0c');
    bodyGrd.addColorStop(1, '#3e0505');
    ctx.fillStyle = bodyGrd;
    ctx.fill();
    ctx.restore();

    // Underbelly highlight strip
    ctx.save();
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const nv = norm(i); const r = getR(i) * 0.45;
      i === 0 ? ctx.moveTo(segs[i].x + nv.x * r, segs[i].y + nv.y * r)
              : ctx.lineTo(segs[i].x + nv.x * r, segs[i].y + nv.y * r);
    }
    for (let i = n - 1; i >= 0; i--) {
      const nv = norm(i); const r = getR(i) * 0.45;
      ctx.lineTo(segs[i].x - nv.x * r, segs[i].y - nv.y * r);
    }
    ctx.closePath();
    ctx.fillStyle = 'rgba(255, 140, 60, 0.18)';
    ctx.fill();
    ctx.restore();

    // Scale texture (arcs along body)
    for (let i = 3; i < n - 1; i += 2) {
      const nv = norm(i); const r = getR(i);
      const ang = Math.atan2(segs[i].y - segs[Math.max(0, i-1)].y, segs[i].x - segs[Math.max(0, i-1)].x);
      ctx.save();
      ctx.beginPath();
      ctx.arc(segs[i].x, segs[i].y, r * 0.75, ang + 0.3, ang + Math.PI - 0.3);
      ctx.strokeStyle = `rgba(180, 30, 30, ${0.5 * (1 - i / n)})`;
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();
    }

    // === DORSAL SPINES ===
    ctx.save();
    ctx.shadowBlur = 10;
    ctx.shadowColor = 'rgba(255, 120, 30, 0.6)';
    for (let i = 2; i < n - 3; i += 3) {
      const nv = norm(i); const r = getR(i);
      const spLen = r * 1.4 + 3;
      const bx = segs[i].x + nv.x * r, by = segs[i].y + nv.y * r;
      ctx.beginPath();
      ctx.moveTo(bx - nv.y * r * 0.25, by + nv.x * r * 0.25);
      ctx.lineTo(bx + nv.x * spLen, by + nv.y * spLen);
      ctx.lineTo(bx + nv.y * r * 0.25, by - nv.x * r * 0.25);
      ctx.closePath();
      const spGrd = ctx.createLinearGradient(bx, by, bx + nv.x * spLen, by + nv.y * spLen);
      spGrd.addColorStop(0, `hsl(${20 - i}, 85%, 40%)`);
      spGrd.addColorStop(1, `hsl(${40 - i}, 90%, 60%)`);
      ctx.fillStyle = spGrd;
      ctx.fill();
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
        const outerX = bx - wn.x * 55 * side + Math.cos(wAng + Math.PI) * 15;
        const outerY = by - wn.y * 55 * side + Math.sin(wAng + Math.PI) * 15;
        const fwdX = bx - wn.x * 35 * side + Math.cos(wAng) * 38;
        const fwdY = by - wn.y * 35 * side + Math.sin(wAng) * 38;
        const midX = (outerX + fwdX) / 2;
        const midY = (outerY + fwdY) / 2;

        ctx.save();
        ctx.shadowBlur = 12;
        ctx.shadowColor = 'rgba(160, 10, 10, 0.55)';
        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.quadraticCurveTo(outerX + (bx - outerX) * 0.1, outerY + (by - outerY) * 0.1, outerX, outerY);
        ctx.quadraticCurveTo(midX, midY, fwdX, fwdY);
        ctx.closePath();
        const wingGrd = ctx.createRadialGradient(bx, by, 0, bx, by, 65);
        wingGrd.addColorStop(0, 'rgba(160, 15, 15, 0.9)');
        wingGrd.addColorStop(0.6, 'rgba(100, 8, 8, 0.75)');
        wingGrd.addColorStop(1, 'rgba(60, 5, 5, 0.4)');
        ctx.fillStyle = wingGrd;
        ctx.fill();
        ctx.restore();

        // Wing veins
        ctx.save();
        ctx.strokeStyle = 'rgba(220, 60, 60, 0.35)';
        ctx.lineWidth = 0.8;
        [[outerX, outerY], [fwdX, fwdY], [midX, midY]].forEach(([tx, ty]) => {
          ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(tx, ty); ctx.stroke();
        });
        ctx.restore();
      });
    }

    // === HEAD ===
    const h = segs[0];
    const neck = segs[1] ?? h;
    const ha = Math.atan2(h.y - neck.y, h.x - neck.x);
    const hp = ha + Math.PI / 2;

    // Head glow
    ctx.save();
    ctx.shadowBlur = 35;
    ctx.shadowColor = 'rgba(255, 60, 20, 0.8)';

    // Skull
    ctx.beginPath();
    ctx.ellipse(h.x + Math.cos(ha) * 3, h.y + Math.sin(ha) * 3, 17, 12, ha, 0, Math.PI * 2);
    const skullGrd = ctx.createRadialGradient(
      h.x - Math.cos(ha) * 6, h.y - Math.sin(ha) * 6, 0,
      h.x, h.y, 20
    );
    skullGrd.addColorStop(0, '#d42020');
    skullGrd.addColorStop(1, '#6a0808');
    ctx.fillStyle = skullGrd;
    ctx.fill();

    // Snout
    ctx.beginPath();
    ctx.ellipse(h.x + Math.cos(ha) * 17, h.y + Math.sin(ha) * 17, 10, 6.5, ha, 0, Math.PI * 2);
    ctx.fillStyle = '#961010';
    ctx.fill();
    ctx.restore();

    // Jaw line
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(h.x + Math.cos(hp) * 6, h.y + Math.sin(hp) * 6);
    ctx.quadraticCurveTo(
      h.x + Math.cos(ha) * 14 + Math.cos(hp) * 10,
      h.y + Math.sin(ha) * 14 + Math.sin(hp) * 10,
      h.x + Math.cos(ha) * 22,
      h.y + Math.sin(ha) * 22,
    );
    ctx.strokeStyle = 'rgba(80, 5, 5, 0.7)';
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.restore();

    // Fangs
    ctx.save();
    [0.35, -0.35].forEach((offset) => {
      const fx = h.x + Math.cos(ha) * 19 + Math.cos(hp) * offset * 14;
      const fy = h.y + Math.sin(ha) * 19 + Math.sin(hp) * offset * 14;
      ctx.beginPath();
      ctx.moveTo(fx, fy);
      ctx.lineTo(fx + Math.cos(hp) * offset * 2, fy + Math.sin(hp) * offset * 2);
      ctx.lineTo(fx + Math.cos(ha) * 6, fy + Math.sin(ha) * 6);
      ctx.closePath();
      ctx.fillStyle = '#f0ead0';
      ctx.fill();
    });
    ctx.restore();

    // Curved horns
    ctx.save();
    ctx.shadowBlur = 10;
    ctx.shadowColor = 'rgba(255, 190, 40, 0.7)';
    [1, -1].forEach((s) => {
      const hbx = h.x + Math.cos(hp) * s * 9 - Math.cos(ha) * 5;
      const hby = h.y + Math.sin(hp) * s * 9 - Math.sin(ha) * 5;
      const htx = h.x + Math.cos(hp) * s * 5 + Math.cos(ha) * 16;
      const hty = h.y + Math.sin(hp) * s * 5 + Math.sin(ha) * 16;
      const hcx = h.x + Math.cos(hp) * s * 18 + Math.cos(ha) * 6;
      const hcy = h.y + Math.sin(hp) * s * 18 + Math.sin(ha) * 6;
      ctx.beginPath();
      ctx.moveTo(hbx, hby);
      ctx.quadraticCurveTo(hcx, hcy, htx, hty);
      ctx.lineWidth = 3.5;
      ctx.strokeStyle = '#c89010';
      ctx.lineCap = 'round';
      ctx.stroke();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = '#ffd84a';
      ctx.stroke();
    });
    ctx.restore();

    // Glowing eyes with slit pupils
    ctx.save();
    ctx.shadowBlur = 18;
    ctx.shadowColor = 'rgba(255, 210, 50, 1)';
    [1, -1].forEach((s) => {
      const ex = h.x + Math.cos(hp) * s * 5.5 + Math.cos(ha) * 6;
      const ey = h.y + Math.sin(hp) * s * 5.5 + Math.sin(ha) * 6;
      // Iris
      ctx.beginPath();
      ctx.ellipse(ex, ey, 5, 3.5, ha, 0, Math.PI * 2);
      const eyeGrd = ctx.createRadialGradient(ex, ey, 0, ex, ey, 5);
      eyeGrd.addColorStop(0, '#fff8a0');
      eyeGrd.addColorStop(0.5, '#ffcc00');
      eyeGrd.addColorStop(1, '#cc8800');
      ctx.fillStyle = eyeGrd;
      ctx.fill();
      // Slit pupil
      ctx.beginPath();
      ctx.ellipse(ex + Math.cos(ha) * 0.5, ey + Math.sin(ha) * 0.5, 1.2, 3, ha + Math.PI / 2, 0, Math.PI * 2);
      ctx.fillStyle = '#080000';
      ctx.fill();
    });
    ctx.restore();

    // Fire breath (animated-look via multi-layer radial)
    const fireX = h.x + Math.cos(ha) * 26;
    const fireY = h.y + Math.sin(ha) * 26;
    const f1 = ctx.createRadialGradient(fireX, fireY, 0, fireX, fireY, 16);
    f1.addColorStop(0, 'rgba(255, 255, 220, 0.95)');
    f1.addColorStop(0.25, 'rgba(255, 180, 30, 0.85)');
    f1.addColorStop(0.6, 'rgba(255, 60, 0, 0.5)');
    f1.addColorStop(1, 'rgba(180, 10, 0, 0)');
    ctx.save();
    ctx.shadowBlur = 20;
    ctx.shadowColor = 'rgba(255, 100, 0, 0.8)';
    ctx.beginPath();
    ctx.arc(fireX, fireY, 16, 0, Math.PI * 2);
    ctx.fillStyle = f1;
    ctx.fill();
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
