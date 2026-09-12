import React, { useRef, useEffect } from 'react';

export default function DeepSeekGrid({
  lineColor = 'rgba(255, 255, 255,',
  dotColor = 'rgba(255, 255, 255,',
  lineOpacity = 0.08,
  dotOpacity = 0.16,
  isStatic = false,
}) {
  const canvasRef = useRef(null);
  const mouseRef = useRef({ x: NaN, y: NaN });
  const animFrameRef = useRef(0);
  const isVisibleRef = useRef(true);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const isTouch = window.matchMedia('(hover: none), (pointer: coarse)').matches;
    if (isTouch) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let points = [];
    let cols = 0;
    let rows = 0;
    let width = 0;
    let height = 0;
    let isIdle = false;

    const rebuildGrid = () => {
      cols = Math.ceil(width / 90) + 1;
      rows = Math.ceil(height / 90) + 1;
      const offsetX = (width - (cols - 1) * 90) / 2;
      const offsetY = (height - (rows - 1) * 90) / 2;
      points = [];
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const x = offsetX + 90 * c;
          const y = offsetY + 90 * r;
          points.push({ restX: x, restY: y, x, y, vx: 0, vy: 0 });
        }
      }
    };

    let resizeTimer = null;
    width = canvas.clientWidth;
    height = canvas.clientHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    rebuildGrid();

    const wakeUp = () => {
      if (isIdle) {
        isIdle = false;
        animFrameRef.current = requestAnimationFrame(loop);
      }
    };

    const handleMouseMove = (e) => {
      if (isStatic) return;
      const rect = canvas.getBoundingClientRect();
      mouseRef.current.x = e.clientX - rect.left;
      mouseRef.current.y = e.clientY - rect.top;
      wakeUp();
    };

    if (!isStatic) {
      window.addEventListener('mousemove', handleMouseMove, { passive: true });
    }

    let lastTime = 0;
    const interval = 1000 / 30;

    const loop = (now) => {
      if (!isVisibleRef.current || now - lastTime < interval) {
        animFrameRef.current = requestAnimationFrame(loop);
        return;
      }
      lastTime = now - ((now - lastTime) % interval);

      const curW = canvas.clientWidth;
      const curH = canvas.clientHeight;
      if (curW !== width || curH !== height) {
        width = curW;
        height = curH;
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        if (resizeTimer) clearTimeout(resizeTimer);
        resizeTimer = setTimeout(rebuildGrid, 150);
      }

      ctx.clearRect(0, 0, width, height);
      const mx = mouseRef.current.x;
      const my = mouseRef.current.y;
      let maxVelocity = 0;

      for (let i = 0; i < points.length; i++) {
        const pt = points[i];
        const dx = pt.x - mx;
        const dy = pt.y - my;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 140 && dist > 0.1) {
          const force = (1 - dist / 140) * 30;
          pt.vx += (dx / dist) * force * 0.1;
          pt.vy += (dy / dist) * force * 0.1;
        }
        const springX = pt.restX - pt.x;
        const springY = pt.restY - pt.y;
        pt.vx += 0.05 * springX;
        pt.vy += 0.05 * springY;
        pt.vx *= 0.85;
        pt.vy *= 0.85;
        pt.x += pt.vx;
        pt.y += pt.vy;

        const vel = Math.abs(pt.vx) + Math.abs(pt.vy);
        if (vel > maxVelocity) maxVelocity = vel;
      }

      // Draw grid lines
      ctx.strokeStyle = `${lineColor} ${lineOpacity})`;
      ctx.lineWidth = 0.5;

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols - 1; c++) {
          const p1 = points[r * cols + c];
          const p2 = points[r * cols + c + 1];
          const segDist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
          if (segDist < 20) continue;
          const ux = (p2.x - p1.x) / segDist;
          const uy = (p2.y - p1.y) / segDist;
          ctx.beginPath();
          ctx.moveTo(p1.x + 10 * ux, p1.y + 10 * uy);
          ctx.lineTo(p2.x - 10 * ux, p2.y - 10 * uy);
          ctx.stroke();
        }
      }

      for (let c = 0; c < cols; c++) {
        for (let r = 0; r < rows - 1; r++) {
          const p1 = points[r * cols + c];
          const p2 = points[(r + 1) * cols + c];
          const segDist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
          if (segDist < 20) continue;
          const ux = (p2.x - p1.x) / segDist;
          const uy = (p2.y - p1.y) / segDist;
          ctx.beginPath();
          ctx.moveTo(p1.x + 10 * ux, p1.y + 10 * uy);
          ctx.lineTo(p2.x - 10 * ux, p2.y - 10 * uy);
          ctx.stroke();
        }
      }

      // Draw grid dots
      ctx.fillStyle = `${dotColor} ${dotOpacity})`;
      for (let i = 0; i < points.length; i++) {
        const pt = points[i];
        let size = 1.8;
        let alpha = dotOpacity;
        if (!isNaN(mx) && !isNaN(my)) {
          const dist = Math.hypot(pt.x - mx, pt.y - my);
          const influence = Math.max(0, 1 - dist / 140);
          size = 1.8 + 2 * influence;
          alpha = dotOpacity + 0.4 * influence;
        }
        ctx.globalAlpha = alpha;
        ctx.fillRect(pt.x - size, pt.y - size, size * 2, size * 2);
      }
      ctx.globalAlpha = 1;

      if (maxVelocity < 0.01) {
        isIdle = true;
      } else {
        animFrameRef.current = requestAnimationFrame(loop);
      }
    };

    animFrameRef.current = requestAnimationFrame(loop);

    const observer = new IntersectionObserver(([entry]) => {
      isVisibleRef.current = entry.isIntersecting;
      if (entry.isIntersecting) wakeUp();
    });
    observer.observe(canvas);

    return () => {
      cancelAnimationFrame(animFrameRef.current);
      if (resizeTimer) clearTimeout(resizeTimer);
      if (!isStatic) {
        window.removeEventListener('mousemove', handleMouseMove);
      }
      observer.disconnect();
    };
  }, [lineColor, dotColor, lineOpacity, dotOpacity, isStatic]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        background: 'transparent',
      }}
    />
  );
}
