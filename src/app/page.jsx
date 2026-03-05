'use client';
import React, { useState } from 'react';
import { Tabs, Card, Typography } from 'antd';
import { SwapOutlined, CompressOutlined, VideoCameraOutlined, PictureOutlined, FileImageOutlined, EditOutlined } from '@ant-design/icons';
import GifToWebp from './components/GifToWebp';
import Mp4Compress from './components/Mp4Compress';
import GifToMp4 from './components/GifToMp4';
import Mp4FirstFrame from './components/Mp4FirstFrame';
import ImageCompress from './components/ImageCompress';
import GifCompress from './components/GifCompress';
import ImageGenerate from './components/ImageGenerate';

const { Title } = Typography;

const HomePage = () => {
  const [activeTab, setActiveTab] = useState('gifToWebp');

  const items = [
    {
      key: 'gifToWebp',
      label: (
        <span>
          <SwapOutlined />
          GIF 转 WebP
        </span>
      ),
      children: <GifToWebp />,
    },
    {
      key: 'mp4Compress',
      label: (
        <span>
          <CompressOutlined />
          MP4 压缩
        </span>
      ),
      children: <Mp4Compress />,
    },
    {
      key: 'gifToMp4',
      label: (
        <span>
          <VideoCameraOutlined />
          GIF 转 MP4
        </span>
      ),
      children: <GifToMp4 />,
    },
    {
      key: 'mp4FirstFrame',
      label: (
        <span>
          <PictureOutlined />
          MP4 获取首帧
        </span>
      ),
      children: <Mp4FirstFrame />,
    },
    {
      key: 'imageCompress',
      label: (
        <span>
          <FileImageOutlined />
          图片压缩
        </span>
      ),
      children: <ImageCompress />,
    },
    {
      key: 'gifCompress',
      label: (
        <span>
          <CompressOutlined />
          GIF 压缩
        </span>
      ),
      children: <GifCompress />,
    },
    {
      key: 'imageGenerate',
      label: (
        <span>
          <EditOutlined />
          AI 图像生成
        </span>
      ),
      children: <ImageGenerate />,
    },
  ];

  return (
    <div style={{ 
      // 增加页面背景色和渐变效果
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%)',
      minHeight: '100vh',
      padding: '1rem',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'flex-start',
      // 添加背景装饰
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* 背景装饰元素 */}
      <div style={{
        position: 'absolute',
        top: '-10%',
        right: '-10%',
        width: '500px',
        height: '500px',
        background: 'rgba(255, 255, 255, 0.1)',
        borderRadius: '50%',
        filter: 'blur(100px)',
        zIndex: 0
      }}></div>
      <div style={{
        position: 'absolute',
        bottom: '-10%',
        left: '-10%',
        width: '400px',
        height: '400px',
        background: 'rgba(255, 255, 255, 0.05)',
        borderRadius: '50%',
        filter: 'blur(80px)',
        zIndex: 0
      }}></div>
      
      {/* 主内容区域 - 玻璃模态风格 */}
      <div style={{ 
        // 玻璃模态效果
        background: 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(10px)',
        borderRadius: '20px',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.15)',
        padding: '2rem',
        margin: '1rem',
        // 响应式设计
        maxWidth: '1200px',
        width: '100%',
        position: 'relative',
        zIndex: 1
      }}>
        <Title level={2} style={{ 
          textAlign: 'center', 
          marginBottom: '2rem',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          fontWeight: 'bold',
          fontSize: '2.5rem',
          // 响应式字体大小
          '@media (max-width: 768px)': {
            fontSize: '2rem'
          }
        }}>
          多媒体格式转换工具
        </Title>
        <Card style={{ 
          // 卡片玻璃模态效果
          border: '1px solid rgba(255, 255, 255, 0.2)',
          background: 'rgba(255, 255, 255, 0.8)',
          backdropFilter: 'blur(5px)',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)',
          borderRadius: '16px',
          overflow: 'hidden'
        }}>
          <Tabs
            activeKey={activeTab}
            onChange={setActiveTab}
            items={items.map(item => ({
              ...item,
              label: (
                <div style={{
                  padding: '10px 20px',
                  borderRadius: '12px',
                  fontWeight: activeTab === item.key ? 'bold' : 'normal',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  cursor: 'pointer',
                  color: activeTab === item.key ? '#667eea' : '#666',
                  background: activeTab === item.key ? 'rgba(255, 255, 255, 0.9)' : 'transparent',
                  boxShadow: activeTab === item.key ? '0 4px 12px rgba(0, 0, 0, 0.1)' : 'none',
                  // 响应式调整
                  whiteSpace: 'nowrap'
                }} onMouseEnter={(e) => {
                  if (activeTab !== item.key) {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.7)';
                  }
                }} onMouseLeave={(e) => {
                  if (activeTab !== item.key) {
                    e.currentTarget.style.background = 'transparent';
                  }
                }}>
                  {item.label}
                </div>
              )
            }))}
            size="large"
            centered
            style={{ 
              borderBottom: '1px solid rgba(255, 255, 255, 0.3)',
              backgroundColor: 'rgba(248, 249, 250, 0.8)',
              padding: '0.5rem',
              borderRadius: '16px 16px 0 0'
            }}
            tabBarStyle={{
              marginBottom: '0',
              backgroundColor: 'transparent',
              borderBottom: 'none',
              // 响应式调整
              flexWrap: 'wrap'
            }}
            tabBarGutter={12}
          />
        </Card>
      </div>
    </div>
  );
};

export default HomePage;