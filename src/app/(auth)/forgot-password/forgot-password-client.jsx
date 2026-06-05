'use client';

import Link from 'next/link';
import { Alert, Button, Form, Input } from 'antd';
import AuthCard from '../../components/auth/AuthCard';

export default function ForgotPasswordClient() {
  return (
    <AuthCard
      title="找回密码"
      subtitle="我们将向您的邮箱发送重置链接"
      footer={
        <Link href="/login" className="text-mf-cta hover:underline">
          返回登录
        </Link>
      }
    >
      <Alert
        type="info"
        showIcon
        className="mb-4"
        message="邮件服务接入中"
        description="找回密码功能将在 Auth.js + 邮件服务配置后开放。"
      />
      <Form layout="vertical" requiredMark={false}>
        <Form.Item
          name="email"
          label="邮箱"
          rules={[
            { required: true, message: '请输入邮箱' },
            { type: 'email', message: '邮箱格式不正确' },
          ]}
        >
          <Input placeholder="you@example.com" autoComplete="email" size="large" />
        </Form.Item>
        <Button type="primary" htmlType="submit" block size="large" disabled>
          发送重置链接（即将开放）
        </Button>
      </Form>
    </AuthCard>
  );
}

