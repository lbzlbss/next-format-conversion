import { ConfigProvider } from 'antd';

export default function RootLayout({ children }) {
  return (
    <html lang="zh-CN">
      <body>
        <ConfigProvider
          theme={{
            token: {
              colorPrimary: '#1890ff',
              borderRadius: 4,
            },
          }}
        >
          {children}
        </ConfigProvider>
      </body>
    </html>
  );
}