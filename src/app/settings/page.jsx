'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { signOut, useSession } from 'next-auth/react';
import { Button, Progress } from 'antd';
import { LogoutOutlined } from '@ant-design/icons';
import SubPageHeader from '../components/layout/SubPageHeader';

export default function SettingsPage() {
  const { data: session, status } = useSession();
  const [quota, setQuota] = useState(null);

  useEffect(() => {
    if (status !== 'authenticated') return;
    fetch('/api/quota/usage?metric=imageGen')
      .then((r) => (r.ok ? r.json() : null))
      .then(setQuota)
      .catch(() => {});
  }, [status]);

  if (status === 'loading') {
    return (
      <div className="min-h-[100dvh] bg-mf-canvas p-8 text-center text-mf-muted">
        加载中…
      </div>
    );
  }

  if (!session?.user) {
    return (
      <div className="flex min-h-[100dvh] flex-col bg-mf-canvas">
        <SubPageHeader title="账号设置" subtitle="登录后查看配额与资料" />
        <main className="mx-auto max-w-lg p-8 text-center">
          <p className="text-mf-muted">请先登录</p>
          <Link href="/login" className="mt-4 inline-block text-mf-cta hover:underline">
            前往登录
          </Link>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-[100dvh] flex-col bg-mf-canvas">
      <SubPageHeader title="账号设置" subtitle="资料与今日额度" />
      <main className="mx-auto w-full max-w-lg space-y-4 p-4 md:p-8">
        <section className="mf-card rounded-[var(--mf-radius-lg)] bg-mf-surface p-6">
          <h2 className="font-mono text-lg font-semibold text-mf-text">资料</h2>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-mf-muted">昵称</dt>
              <dd className="text-mf-text">{session.user.name || '—'}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-mf-muted">邮箱</dt>
              <dd className="truncate text-mf-text">{session.user.email}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-mf-muted">套餐</dt>
              <dd className="text-mf-text">{session.user.plan === 'pro' ? 'Pro' : 'Free'}</dd>
            </div>
          </dl>
        </section>

        <section className="mf-card rounded-[var(--mf-radius-lg)] bg-mf-surface p-6">
          <h2 className="font-mono text-lg font-semibold text-mf-text">今日额度</h2>
          <div className="mt-4 space-y-4">
            {quota ? (
              <div>
                <div className="mb-1 flex justify-between text-xs text-mf-muted">
                  <span>文生图</span>
                  <span>
                    {quota.used}/{quota.limit}
                  </span>
                </div>
                <Progress
                  percent={Math.min(100, Math.round((quota.used / quota.limit) * 100))}
                  showInfo={false}
                  strokeColor="#2563EB"
                />
              </div>
            ) : (
              <p className="text-sm text-mf-muted">加载配额中…</p>
            )}
            <p className="text-xs text-mf-muted">
              登录用户：文生图 20 次/日，对话 100 轮/日（UTC 日重置）
            </p>
          </div>
        </section>

        <Button
          danger
          icon={<LogoutOutlined />}
          block
          size="large"
          onClick={() => signOut({ callbackUrl: '/' })}
        >
          退出登录
        </Button>
      </main>
    </div>
  );
}
