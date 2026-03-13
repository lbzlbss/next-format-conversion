import dynamic from 'next/dynamic';

// 使用 dynamic 包装组件，确保仅客户端加载
const SvgaTool = dynamic(() => import('./SvgaToolInternal'), {
  ssr: false,
  loading: () => <div className="flex items-center justify-center h-64 text-slate-500">SVGA 工具加载中…</div>,
});

export default SvgaTool;