import Link from 'next/link';
import { ArrowLeftOutlined } from '@ant-design/icons';

export const metadata = {
  title: '账号 — MediaFlow',
};

export default function AuthLayout({ children }) {
  return (
    <div className="flex min-h-[100dvh] flex-col bg-mf-canvas">
      <header className="shrink-0 border-b border-mf-border bg-mf-surface px-4 py-3">
        <div className="mx-auto flex max-w-md items-center gap-3">
          <Link
            href="/"
            className="mf-focus-ring flex size-9 items-center justify-center rounded-lg text-mf-muted transition hover:bg-mf-canvas hover:text-mf-text"
            aria-label="返回首页"
          >
            <ArrowLeftOutlined />
          </Link>
          <span className="font-mono text-sm font-semibold text-mf-text">MediaFlow</span>
        </div>
      </header>
      <main className="flex flex-1 items-center justify-center px-4 py-8">
        {children}
      </main>
      <footer className="shrink-0 pb-6 text-center text-xs text-mf-muted">
        继续使用即表示同意服务条款与隐私政策（待发布）
      </footer>
    </div>
  );
}
