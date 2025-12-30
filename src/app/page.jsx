'use client';
import React, { useState } from 'react';
import { Tabs, Card, Typography } from 'antd';
import { SwapOutlined, CompressOutlined, VideoCameraOutlined, PictureOutlined, FileImageOutlined } from '@ant-design/icons';
import GifToWebp from './components/GifToWebp';
import Mp4Compress from './components/Mp4Compress';
import GifToMp4 from './components/GifToMp4';
import Mp4FirstFrame from './components/Mp4FirstFrame';
import ImageCompress from './components/ImageCompress';

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
  ];

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '2rem' }}>
      <Title level={2} style={{ textAlign: 'center', marginBottom: '2rem' }}>
        多媒体格式转换工具
      </Title>
      <Card>
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={items}
          size="large"
          centered
        />
      </Card>
    </div>
  );
};

export default HomePage;