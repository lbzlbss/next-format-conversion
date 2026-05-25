import { ConfigProvider } from 'antd';
import './globals.css';
import { firaCode, firaSans } from './fonts';

export const metadata = {
  title: 'MediaFlow — 多媒体格式转换',
  description: 'GIF/WebP、MP4、SVGA/VAP 动效转换与 AI 助手',
};

export default function RootLayout({ children }) {
  return (
    <html lang="zh-CN" className={`${firaSans.variable} ${firaCode.variable}`}>
      <body className={`${firaSans.className} min-h-screen antialiased`}>
        <ConfigProvider
          theme={{
            token: {
              colorPrimary: '#2563EB',
              colorInfo: '#1E293B',
              borderRadius: 8,
              fontFamily: 'var(--font-fira-sans), system-ui, sans-serif',
              fontSize: 14,
            },
            components: {
              Button: { controlHeight: 40, fontWeight: 600 },
              Input: { controlHeight: 40 },
              Select: { controlHeight: 40 },
            },
          }}
        >
          {children}
        </ConfigProvider>
      </body>
    </html>
  );
}
