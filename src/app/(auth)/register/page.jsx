'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { Alert, Button, Checkbox, Form, Input, message } from 'antd';
import AuthCard from '../../components/auth/AuthCard';

export default function RegisterPage() {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const onFinish = async (values) => {
    setLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: values.email.trim(),
          password: values.password,
        }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        message.error(data.message || data.error || '注册失败');
        return;
      }

      const signInResult = await signIn('credentials', {
        email: values.email.trim(),
        password: values.password,
        redirect: false,
      });

      if (signInResult?.error) {
        message.success('注册成功，请登录');
        router.push('/login');
        return;
      }

      message.success('注册成功，已自动登录');
      router.push('/');
      router.refresh();
    } catch {
      message.error('注册失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthCard
      title="创建账号"
      subtitle="注册后文生图 20 次/日、对话 100 轮/日"
      footer={
        <span className="text-mf-muted">
          已有账号？{' '}
          <Link href="/login" className="font-medium text-mf-cta hover:underline">
            登录
          </Link>
        </span>
      }
    >
      <Alert
        type="info"
        showIcon
        className="mb-4"
        message="游客仍可试用"
        description="未登录：文生图每日 2 次、对话 20 轮。注册后额度提升。"
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
          rules={[
            { required: true, message: '请输入密码' },
            { min: 8, message: '至少 8 位' },
            {
              pattern: /^(?=.*[A-Za-z])(?=.*\d).+$/,
              message: '需同时包含字母与数字',
            },
          ]}
          extra="至少 8 位，需包含字母与数字"
        >
          <Input.Password placeholder="••••••••" autoComplete="new-password" size="large" />
        </Form.Item>
        <Form.Item
          name="confirm"
          label="确认密码"
          dependencies={['password']}
          rules={[
            { required: true, message: '请再次输入密码' },
            ({ getFieldValue }) => ({
              validator(_, value) {
                if (!value || getFieldValue('password') === value) {
                  return Promise.resolve();
                }
                return Promise.reject(new Error('两次密码不一致'));
              },
            }),
          ]}
        >
          <Input.Password placeholder="••••••••" autoComplete="new-password" size="large" />
        </Form.Item>
        <Form.Item
          name="terms"
          valuePropName="checked"
          rules={[
            {
              validator: (_, v) =>
                v ? Promise.resolve() : Promise.reject(new Error('请同意服务条款')),
            },
          ]}
        >
          <Checkbox>我已阅读并同意服务条款与隐私政策</Checkbox>
        </Form.Item>
        <Button type="primary" htmlType="submit" block size="large" loading={loading}>
          注册
        </Button>
      </Form>
    </AuthCard>
  );
}
