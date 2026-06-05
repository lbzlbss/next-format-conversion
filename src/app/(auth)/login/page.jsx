'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { Button, Checkbox, Form, Input, message } from 'antd';
import AuthCard from '../../components/auth/AuthCard';

export const dynamic = 'force-dynamic';

export default function LoginPage() {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || '/';

  const onFinish = async (values) => {
    setLoading(true);
    try {
      const result = await signIn('credentials', {
        email: values.email.trim(),
        password: values.password,
        redirect: false,
      });

      if (result?.error) {
        message.error('邮箱或密码错误');
        return;
      }

      message.success('登录成功');
      router.push(callbackUrl);
      router.refresh();
    } catch {
      message.error('登录失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthCard
      title="登录 MediaFlow"
      subtitle="登录后文生图 20 次/日、对话 100 轮/日"
      footer={
        <span className="text-mf-muted">
          还没有账号？{' '}
          <Link href="/register" className="font-medium text-mf-cta hover:underline">
            注册
          </Link>
        </span>
      }
    >
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
          <Form.Item name="remember" valuePropName="checked" noStyle initialValue>
            <Checkbox>记住我</Checkbox>
          </Form.Item>
          <Link href="/forgot-password" className="text-sm text-mf-cta hover:underline">
            忘记密码？
          </Link>
        </div>
        <Button type="primary" htmlType="submit" block size="large" loading={loading}>
          登录
        </Button>
      </Form>
    </AuthCard>
  );
}
