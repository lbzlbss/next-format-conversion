import Link from 'next/link';
import fs from 'fs';
import path from 'path';
import { BookOutlined, MessageOutlined } from '@ant-design/icons';
import SubPageHeader from '../components/layout/SubPageHeader';
import WikiIndexClient from '../components/wiki/WikiIndexClient';

function loadIndex() {
  const indexPath = path.join(process.cwd(), 'data/wiki-index.json');
  if (!fs.existsSync(indexPath)) {
    return { categories: [], articles: [] };
  }
  return JSON.parse(fs.readFileSync(indexPath, 'utf8'));
}

export default function WikiIndexPage() {
  const index = loadIndex();
  const articles = index.articles || [];

  return (
    <div className="min-h-screen bg-mf-canvas">
      <SubPageHeader
        title="知识库"
        subtitle="MediaFlow 操作手册 · AI 对话引用来源"
        backHref="/"
        backLabel="返回首页"
        actions={
          <Link
            href="/chat"
            className="mf-focus-ring flex items-center gap-1.5 rounded-lg bg-mf-cta px-3 py-1.5 text-xs font-medium text-white transition hover:bg-mf-cta-hover md:text-sm"
          >
            <MessageOutlined />
            去对话
          </Link>
        }
      />

      <main className="mx-auto max-w-5xl px-4 py-6 md:px-6 md:py-8">
        {articles.length === 0 ? (
          <div className="mf-card p-6 text-sm text-mf-muted">
            <BookOutlined className="mb-2 text-lg text-mf-cta" />
            <p>索引未生成，请在项目根目录运行：</p>
            <code className="mt-2 inline-block rounded bg-mf-canvas px-2 py-1 font-mono text-xs">
              pnpm wiki:build
            </code>
          </div>
        ) : (
          <WikiIndexClient categories={index.categories || []} articles={articles} />
        )}
      </main>
    </div>
  );
}
