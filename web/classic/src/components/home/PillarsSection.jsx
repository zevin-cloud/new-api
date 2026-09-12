import React from 'react';

const pillars = [
  {
    tag: 'UNIFIED PROTOCOL',
    title: '多模型路由与协议转换',
    desc: '跨格式统一兼容 OpenAI、Claude、Gemini、DeepSeek 等 40+ 上游主流模型，极简统一入参，一套 SDK 支撑全业务大模型调用需求。',
    icon: (
      <svg width='48' height='48' viewBox='0 0 72 72' fill='none' className='text-sky-400'>
        <circle cx='36' cy='36' r='4' stroke='currentColor' strokeWidth='1.2' />
        <circle cx='36' cy='36' r='1.5' fill='currentColor' />
        <ellipse cx='36' cy='36' rx='25' ry='11' stroke='currentColor' strokeWidth='1' opacity='0.7' transform='rotate(90 36 36)' />
        <ellipse cx='36' cy='36' rx='25' ry='11' stroke='currentColor' strokeWidth='1' opacity='0.7' transform='rotate(30 36 36)' />
        <ellipse cx='36' cy='36' rx='25' ry='11' stroke='currentColor' strokeWidth='1' opacity='0.7' transform='rotate(150 36 36)' />
      </svg>
    ),
  },
  {
    tag: 'QUOTA & BILLING',
    title: '精细化额度计量与计费',
    desc: '支持多用户组倍率定价、令牌管理、充值兑换、实时消耗统计与明细日志审计，提供金融级严谨的配额扣减与用量控制能力。',
    icon: (
      <svg width='48' height='48' viewBox='0 0 72 72' fill='none' className='text-sky-400'>
        <circle cx='36' cy='36' r='17' stroke='currentColor' strokeWidth='0.9' strokeDasharray='2 2.5' opacity='0.5' />
        <circle cx='36' cy='36' r='26' stroke='currentColor' strokeWidth='0.9' opacity='0.7' />
        <circle cx='36' cy='36' r='4.5' stroke='currentColor' strokeWidth='1.2' />
        <circle cx='36' cy='10' r='2.6' fill='currentColor' />
        <circle cx='58.5' cy='23' r='2.6' fill='currentColor' />
        <circle cx='58.5' cy='49' r='2.6' fill='currentColor' />
        <circle cx='36' cy='62' r='2.6' fill='currentColor' />
        <circle cx='13.5' cy='49' r='2.6' fill='currentColor' />
        <circle cx='13.5' cy='23' r='2.6' fill='currentColor' />
      </svg>
    ),
  },
  {
    tag: 'HIGH AVAILABILITY',
    title: '企业级网关与高可用调度',
    desc: '支持多渠道多密钥权重分发、毫秒级健康检测、故障自愈与熔断重试，生产级高并发抗压，为企业关键 AI 业务保驾护航。',
    icon: (
      <svg width='48' height='48' viewBox='0 0 72 72' fill='none' className='text-sky-400'>
        <rect x='18' y='22' width='15' height='15' rx='3' stroke='currentColor' strokeWidth='1.1' opacity='0.85' />
        <rect x='18' y='41' width='15' height='15' rx='3' stroke='currentColor' strokeWidth='1.1' opacity='0.85' />
        <rect x='37' y='41' width='15' height='15' rx='3' stroke='currentColor' strokeWidth='1.1' opacity='0.85' />
        <rect x='37' y='22' width='15' height='15' rx='3' stroke='currentColor' strokeWidth='0.9' strokeDasharray='2.5 2.5' opacity='0.45' />
        <rect x='47' y='12' width='15' height='15' rx='3' stroke='currentColor' strokeWidth='1.2' />
        <circle cx='54.5' cy='19.5' r='1.4' fill='currentColor' />
      </svg>
    ),
  },
];

export default function PillarsSection() {
  return (
    <section className='w-full max-w-[1240px] mx-auto px-4 py-16'>
      <div className='max-w-[800px] mx-auto flex flex-col items-center gap-4 text-center mb-12'>
        <span
          className='inline-flex items-center rounded-lg p-[1px]'
          style={{
            background:
              'linear-gradient(135deg, rgba(255,255,255,0.42) 0%, rgba(255,255,255,0.08) 35%, rgba(255,255,255,0.04) 65%, rgba(255,255,255,0.28) 100%)',
            boxShadow: '0 0 16px rgba(255,255,255,0.08), 0 0 32px rgba(255,255,255,0.04)',
          }}
        >
          <span className='px-2.5 py-1 rounded-[7px] bg-black/40 font-mono text-[11px] font-medium text-white/90 uppercase tracking-widest'>
            One Gateway · All Models
          </span>
        </span>
        <h2 className='text-2xl sm:text-3xl md:text-4xl font-bold text-white tracking-tight'>
          让大模型应用在生产环境中持续高效运转
        </h2>
        <p className='text-sm sm:text-base text-white/60 max-w-[640px] leading-relaxed'>
          屏蔽上游碎片化协议与网络差异，以统一入口、智能分发与严谨鉴权，构建坚固的 AI 基础设施底座。
        </p>
      </div>

      <div className='grid grid-cols-1 md:grid-cols-3 gap-6'>
        {pillars.map((item, idx) => (
          <div
            key={idx}
            className='group relative rounded-2xl border border-white/10 bg-white/[0.02] hover:bg-white/[0.04] backdrop-blur-xl p-8 flex flex-col items-center text-center transition-all duration-300 hover:border-sky-500/30 hover:shadow-xl hover:shadow-sky-500/5'
          >
            <div className='mb-6 p-3 rounded-2xl bg-sky-500/10 border border-sky-500/20 group-hover:scale-105 transition-transform'>
              {item.icon}
            </div>
            <h3 className='text-lg font-semibold text-white mb-2'>{item.title}</h3>
            <span className='font-mono text-[11px] text-sky-400/80 tracking-wider block mb-3 uppercase'>
              {item.tag}
            </span>
            <p className='text-xs sm:text-sm text-white/60 leading-relaxed'>{item.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
