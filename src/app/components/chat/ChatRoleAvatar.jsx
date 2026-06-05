'use client';

import dynamic from 'next/dynamic';
import { Avatar } from 'antd';
import { UserOutlined } from '@ant-design/icons';

const AssistantAvatarPortrait = dynamic(
  () => import('../digital-human/AssistantAvatarPortrait.jsx'),
  { ssr: false },
);

/**
 * @param {{ role: string, size?: number, className?: string }} props
 */
export default function ChatRoleAvatar({ role, size = 40, className = '' }) {
  if (role === 'user') {
    return (
      <Avatar
        size={size}
        icon={<UserOutlined />}
        className={`shrink-0 !bg-mf-cta ${className}`}
      />
    );
  }

  return (
    <AssistantAvatarPortrait
      size={size}
      className={className}
    />
  );
}
