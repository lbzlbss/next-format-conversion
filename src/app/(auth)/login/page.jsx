'use client';

import Link from 'next/link';
import { Alert, Button, Checkbox, Form, Input } from 'antd';
import AuthCard from '../../components/auth/AuthCard';

export default function LoginPage() {
  const [form] = Form.useForm();

  const onFinish = () => {
    // P1: Auth.js signIn('credentials')
  };

  return (
    <AuthCard
      title="登录 MediaFlow"
      subtitle="使用邮箱或第三方账号继续"
      footer={
        <span className="text-mf-muted">
          还没有账号？{' '}
          <Link href="/register" className="font-medium text-mf-cta hover:underline">
            注册
          </Link>
        </span>
      }
    >
      <Alert
        type="info"
        showIcon
        className="mb-4"
        message="账号体系接入中"
        description="当前可使用游客额度（文生图每日 2 次试用）。完整登录功能将在 Neon + Auth.js 接入后开放。"
      />
      <Form form={form} layout="vertical" onFinish={onFinish} requiredMark={false}>
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
        <Form.Item
          name="password"
          label="密码"
          rules={[{ required: true, message: '请输入密码' }]}
        >
          <Input.Password placeholder="••••••••" autoComplete="current-password" size="large" />
        </Form.Item>
        <div className="mb-4 flex items-center justify-between">
          <Form.Item name="remember" valuePropName="checked" noStyle>
            <Checkbox>记住我</Checkbox>
          </Form.Item>
          <Link href="/forgot-password" className="text-sm text-mf-cta hover:underline">
            忘记密码？
          </Link>
        </div>
        <Button type="primary" htmlType="submit" block size="large" disabled>
          登录（即将开放）
        </Button>
      </Form>
    </AuthCard>
  );
}
