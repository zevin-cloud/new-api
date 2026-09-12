import React from 'react';
import {
  OpenAI,
  Claude,
  Gemini,
  DeepSeek,
  Zhipu,
  Qwen,
  Minimax,
  Moonshot,
  Hunyuan,
  Wenxin,
  Volcengine,
  XAI,
  Cohere,
} from '@lobehub/icons';

const providers = [
  { name: 'DeepSeek', icon: <DeepSeek size={24} />, desc: 'DeepSeek-V3, R1 全系列' },
  { name: 'OpenAI', icon: <OpenAI size={24} />, desc: 'GPT-4o, o1, o3-mini' },
  { name: 'Anthropic', icon: <Claude size={24} />, desc: 'Claude 3.5 Sonnet, Haiku' },
  { name: 'Google Gemini', icon: <Gemini size={24} />, desc: 'Gemini 1.5, 2.0 Flash' },
  { name: '通义千问', icon: <Qwen size={24} />, desc: 'Qwen-2.5, Max, Plus' },
  { name: '智谱 AI', icon: <Zhipu size={24} />, desc: 'GLM-4, GLM-Zero' },
  { name: 'Moonshot AI', icon: <Moonshot size={24} />, desc: 'Kimi 全系列长上下文' },
  { name: 'MiniMax', icon: <Minimax size={24} />, desc: 'abab6.5, 语音与视频模型' },
  { name: '腾讯混元', icon: <Hunyuan size={24} />, desc: 'Hunyuan-Large, Vision' },
  { name: '百度文心', icon: <Wenxin size={24} />, desc: 'ERNIE-4.0, Turbo' },
  { name: '字节豆包', icon: <Volcengine size={24} />, desc: 'Doubao-Pro, Lite, 向量' },
  { name: 'xAI (Grok)', icon: <XAI size={24} />, desc: 'Grok-2, Grok-Vision' },
];

export default function SupportedModelsSection() {
  return (
    <section className='w-full max-w-[1240px] mx-auto px-4 py-16'>
      <div className='max-w-[720px] mx-auto text-center mb-12'>
        <span className='font-mono text-xs text-sky-400 font-semibold tracking-widest uppercase mb-2 block'>
          ECOSYSTEM & COMPATIBILITY
        </span>
        <h2 className='text-2xl sm:text-3xl font-bold text-white tracking-tight'>
          已支持 40+ 主流模型供应商与开源生态
        </h2>
        <p className='text-sm text-white/60 mt-3'>
          无论是商用闭源旗舰还是开源轻量模型，均可通过统一接口快速聚合与弹性调度。
        </p>
      </div>

      <div className='grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4'>
        {providers.map((p, idx) => (
          <div
            key={idx}
            className='p-4 rounded-xl border border-white/8 bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/20 transition-all flex flex-col items-center text-center gap-2 group'
          >
            <div className='w-10 h-10 rounded-lg bg-black/40 border border-white/10 flex items-center justify-center text-white/80 group-hover:scale-110 transition-transform'>
              {p.icon}
            </div>
            <span className='text-xs sm:text-sm font-medium text-white/90'>{p.name}</span>
            <span className='text-[11px] text-white/40 line-clamp-1'>{p.desc}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
