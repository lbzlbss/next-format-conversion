'use client';

import Link from 'next/link';
import { useSession, signOut } from 'next-auth/react';
import { Dropdown, Button } from 'antd';
import {
  LoginOutlined,
  LogoutOutlined,
  SettingOutlined,
  UserAddOutlined,
  UserOutlined,
} from '@ant-design/icons';

/**
 * @param {{ compact?: boolean, className?: string }} props
 */
export default function UserMenu({ compact = false, className = '' }) {
  const { data: session, status } = useSession();

  if (status === 'loading') {
    return null;
  }

  if (!session?.user) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <Link
          href="/login"
          className="mf-focus-ring flex items-center gap-1 rounded-lg border border-mf-border px-2.5 py-2 text-xs font-medium text-mf-text transition hover:border-mf-cta hover:text-mf-cta sm:px-3"
        >
          <LoginOutlined className="text-sm" />
          {!compact ? <span>登录</span> : null}
        </Link>
        <Link
          href="/register"
          className="mf-focus-ring hidden items-center gap-1 rounded-lg bg-mf-cta px-2.5 py-2 text-xs font-semibold text-white transition hover:bg-mf-cta-hover sm:inline-flex sm:px-3"
        >
          <UserAddOutlined className="text-sm" />
          注册
        </Link>
      </div>
    );
  }

  const label = session.user.name || session.user.email?.split('@')[0] || '用户';

  const menuItems = [
    {
      key: 'settings',
      label: (
        <Link href="/settings" className="flex items-center gap-2">
          <SettingOutlined />
          账号设置
        </Link>
      ),
    },
    { type: 'divider' },
    {
      key: 'logout',
      label: (
        <span className="flex items-center gap-2 text-mf-danger">
          <LogoutOutlined />
          退出登录
        </span>
      ),
      onClick: () => signOut({ callbackUrl: '/' }),
    },
  ];

  return (
    <Dropdown menu={{ items: menuItems }} trigger={['click']} placement="bottomRight">
      <Button
        type="text"
        className={`mf-focus-ring flex h-10 max-w-[160px] items-center gap-2 rounded-xl px-2 ${className}`}
      >
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-mf-accent-soft text-mf-accent-soft-fg">
          <UserOutlined />
        </span>
        {!compact ? (
          <span className="truncate text-xs font-medium text-mf-text">{label}</span>
        ) : null}
      </Button>
    </Dropdown>
  );
}
