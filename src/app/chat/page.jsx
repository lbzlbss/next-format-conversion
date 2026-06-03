'use client';

import Link from 'next/link';
import { BookOutlined, RobotOutlined } from '@ant-design/icons';
import ChatPanel from '../components/chat/ChatPanel';
import SubPageHeader from '../components/layout/SubPageHeader';

export default function ChatPage() {
  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-mf-canvas">
      <SubPageHeader
        title="AI 对话助手"
        subtitle="创作专家 · 视频转换 · 八字命理 · 左侧 3D 数字人 · 支持导出 PDF"
        actions={
          <>
            <span className="mf-logo-badge hidden sm:grid">
              <RobotOutlined className="text-mf-cta" />
            </span>
            <Link
              href="/wiki"
              className="mf-focus-ring flex items-center gap-1.5 rounded-lg border border-mf-border px-3 py-1.5 text-xs font-medium text-mf-text transition hover:border-mf-cta hover:text-mf-cta md:text-sm"
            >
              <BookOutlined />
              知识库
            </Link>
          </>
        }
      />
      <main className="min-h-0 flex-1 overflow-hidden">
        <ChatPanel variant="page" className="h-full w-full" />
      </main>
    </div>
  );
}
