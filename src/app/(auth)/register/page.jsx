'use client';

import Link from 'next/link';
import { Alert, Button, Checkbox, Form, Input } from 'antd';
import AuthCard from '../../components/auth/AuthCard';

export default function RegisterPage() {
  const [form] = Form.useForm();

  return (
    <AuthCard
      title="创建账号"
      subtitle="注册后可获得更高文生图与对话额度"
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
        message="游客试用说明"
        description="未注册也可使用：文生图每日 2 次、AI 对话每日 20 轮。注册后额度将显著提升。"
      />
      <Form form={form} layout="vertical" requiredMark={false}>
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
          ]}
          extra="至少 8 位，建议包含字母与数字"
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
          <Checkbox>
            我已阅读并同意服务条款与隐私政策
          </Checkbox>
        </Form.Item>
        <Button type="primary" htmlType="submit" block size="large" disabled>
          注册（即将开放）
        </Button>
      </Form>
    </AuthCard>
  );
}
