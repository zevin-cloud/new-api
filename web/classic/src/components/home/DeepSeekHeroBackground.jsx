import React, { useEffect, useRef } from 'react';

/**
 * DeepSeekHeroBackground
 * 实现 DeepSeek Harness 官方标志性的午夜深蓝流体丝绸缎带画布与网格背景
 */
export default function DeepSeekHeroBackground() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId;
    let width = (canvas.width = canvas.parentElement.clientWidth || window.innerWidth);
    let height = (canvas.height = canvas.parentElement.clientHeight || window.innerHeight);

    const handleResize = () => {
      if (!canvas.parentElement) return;
      width = canvas.width = canvas.parentElement.clientWidth || window.innerWidth;
      height = canvas.height = canvas.parentElement.clientHeight || window.innerHeight;
    };

    window.addEventListener('resize', handleResize);

    // 丝绸缎带波纹参数
    let t = 0;
    const ribbons = [
      {
        baseY: 0.35,
        speed: 0.0008,
        wavelength: 0.0018,
        amplitude: 55,
        colorStart: 'rgba(37, 99, 235, 0.16)', // blue-600
        colorMid: 'rgba(59, 130, 246, 0.22)',   // blue-500
        colorEnd: 'rgba(14, 165, 233, 0.08)',  // sky-500
        thickness: 110,
      },
      {
        baseY: 0.48,
        speed: 0.0012,
        wavelength: 0.0022,
        amplitude: 70,
        colorStart: 'rgba(77, 107, 254, 0.20)', // deepseek brand blue
        colorMid: 'rgba(96, 165, 250, 0.18)',   // blue-400
        colorEnd: 'rgba(30, 58, 138, 0.06)',   // blue-900
        thickness: 140,
      },
      {
        baseY: 0.62,
        speed: 0.0009,
        wavelength: 0.0015,
        amplitude: 60,
        colorStart: 'rgba(14, 165, 233, 0.12)', // sky-500
        colorMid: 'rgba(77, 107, 254, 0.15)',   // brand
        colorEnd: 'rgba(15, 23, 42, 0.05)',
        thickness: 120,
      },
      {
        baseY: 0.42,
        speed: 0.0015,
        wavelength: 0.0026,
        amplitude: 45,
        colorStart: 'rgba(255, 255, 255, 0.06)', // white silk sheen
        colorMid: 'rgba(191, 219, 254, 0.10)',
        colorEnd: 'rgba(255, 255, 255, 0.02)',
        thickness: 50,
      },
    ];

    const render = () => {
      t += 1;
      ctx.clearRect(0, 0, width, height);

      // 绘制各层平滑波纹缎带
      ribbons.forEach((ribbon, index) => {
        ctx.save();
        ctx.beginPath();

        const baseY = height * ribbon.baseY;
        ctx.moveTo(0, height);
        ctx.lineTo(0, baseY);

        // 沿 X 轴采样平滑三次贝塞尔
        const step = 40;
        for (let x = 0; x <= width + step; x += step) {
          const yOffset =
            Math.sin(x * ribbon.wavelength + t * ribbon.speed * 1000 + index) * ribbon.amplitude +
            Math.cos(x * 0.001 + t * 0.0006) * 20;
          ctx.lineTo(x, baseY + yOffset);
        }

        ctx.lineTo(width, height);
        ctx.closePath();

        const grad = ctx.createLinearGradient(0, baseY - ribbon.thickness, width, baseY + ribbon.thickness);
        grad.addColorStop(0, ribbon.colorStart);
        grad.addColorStop(0.5, ribbon.colorMid);
        grad.addColorStop(1, ribbon.colorEnd);

        ctx.fillStyle = grad;
        ctx.fill();
        ctx.restore();
      });

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return (
    <div className='absolute inset-0 overflow-hidden pointer-events-none z-0'>
      {/* 渐变午夜深蓝底色 */}
      <div
        className='absolute inset-0'
        style={{
          background:
            'radial-gradient(ellipse 80% 60% at 75% 40%, rgba(30, 58, 138, 0.32) 0%, transparent 70%), radial-gradient(ellipse 60% 50% at 20% 65%, rgba(14, 165, 233, 0.15) 0%, transparent 60%), #070b14',
        }}
      />

      {/* 流体丝绸画布 */}
      <canvas ref={canvasRef} className='absolute inset-0 w-full h-full' />

      {/* DeepSeek 细网格标线底纹 */}
      <div className='ds-grid-bg absolute inset-0' />

      {/* 右侧 3D Digitile 粒子鲸鱼图腾（带悬浮呼吸） */}
      <div className='hidden lg:flex absolute right-6 xl:right-24 top-1/2 -translate-y-1/2 w-[500px] xl:w-[620px] h-[500px] xl:h-[620px] items-center justify-center select-none'>
        <div
          className='absolute inset-0 rounded-full blur-3xl opacity-35'
          style={{
            background: 'radial-gradient(circle, #3b82f6 0%, #1e3a8a 50%, transparent 75%)',
          }}
        />
        <img
          src='/images/hero-digitile.svg'
          alt='DeepSeek Whale Digitile'
          className='relative w-full h-full object-contain opacity-80 filter drop-shadow-[0_0_35px_rgba(59,130,246,0.3)] animate-ds-float'
          draggable={false}
        />
      </div>
    </div>
  );
}
