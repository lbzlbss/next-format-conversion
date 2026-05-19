import Link from 'next/link';
import fs from 'fs';
import path from 'path';
import { notFound } from 'next/navigation';
import { MessageOutlined } from '@ant-design/icons';
import SubPageHeader from '../../components/layout/SubPageHeader';
import WikiArticleView from '../../components/wiki/WikiArticleView';
import { extractHeadings } from '../../components/wiki/markdown-utils';

function loadIndex() {
  const indexPath = path.join(process.cwd(), 'data/wiki-index.json');
  if (!fs.existsSync(indexPath)) return { articles: [] };
  return JSON.parse(fs.readFileSync(indexPath, 'utf8'));
}

export function generateStaticParams() {
  const index = loadIndex();
  return (index.articles || []).map((a) => ({ slug: a.slug }));
}

export default async function WikiArticlePage({ params }) {
  const { slug } = await params;
  const index = loadIndex();
  const article = index.articles?.find((a) => a.slug === slug);

  if (!article) {
    notFound();
  }

  const headings = extractHeadings(article.markdown);
  const related = (index.articles || [])
    .filter((a) => a.slug !== slug && a.category === article.category)
    .slice(0, 4)
    .map((a) => ({ slug: a.slug, title: a.title }));

  const subtitle = [
    article.description,
    article.updatedAt ? `更新于 ${article.updatedAt}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className="min-h-screen bg-mf-canvas">
      <SubPageHeader
        title={article.title}
        subtitle={subtitle || undefined}
        backHref="/wiki"
        backLabel="返回知识库"
        actions={
          <Link
            href={`/chat?wiki=${article.slug}`}
            className="mf-focus-ring flex items-center gap-1.5 rounded-lg border border-mf-border px-3 py-1.5 text-xs font-medium text-mf-cta transition hover:border-mf-cta hover:bg-mf-accent-soft md:text-sm"
          >
            <MessageOutlined />
            就此提问
          </Link>
        }
      />

      <WikiArticleView article={article} headings={headings} related={related} />
    </div>
  );
}
