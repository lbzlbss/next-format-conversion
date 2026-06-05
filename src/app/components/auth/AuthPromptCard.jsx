'use client';

import Link from 'next/link';
import { Button } from 'antd';
import { LoginOutlined, UserAddOutlined } from '@ant-design/icons';

/**
 * @param {{ message?: string, detail?: { upgradeUrl?: string, loginUrl?: string } }} props
 */
export default function AuthPromptCard({ message, detail = {} }) {
  const loginUrl = detail.loginUrl || '/login';
  const registerUrl = detail.upgradeUrl || '/register';

  return (
    <div className="rounded-xl border border-mf-border bg-mf-accent-soft/40 p-4">
      <p className="text-sm text-mf-text">{message || '今日额度已用完，登录后可获得更多次数。'}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Link href={loginUrl}>
          <Button type="primary" size="small" icon={<LoginOutlined />}>
            登录
          </Button>
        </Link>
        <Link href={registerUrl}>
          <Button size="small" icon={<UserAddOutlined />}>
            注册
          </Button>
        </Link>
      </div>
    </div>
  );
}
