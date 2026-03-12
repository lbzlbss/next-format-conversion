import React, { useState } from 'react';
import { Button, Input, Upload, message, Card, Space, Progress, Radio } from 'antd';
import { UploadOutlined, EditOutlined, PictureOutlined, CopyOutlined } from '@ant-design/icons';
import axios from 'axios';

const { TextArea } = Input;

const ImageGenerate = () => {
  const [prompt, setPrompt] = useState('');
  const [imageUrl, setImageUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [mode, setMode] = useState('text2image'); // text2image or image2image
  const [fileList, setFileList] = useState([]);

  const handleFileChange = (info) => {
    setFileList(info.fileList);
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      message.error('请输入提示词');
      return;
    }

    if (mode === 'image2image' && fileList.length === 0) {
      message.error('请上传参考图片');
      return;
    }

    setLoading(true);
    setProgress(0);

    try {
      const formData = new FormData();
      formData.append('prompt', prompt);
      formData.append('mode', mode);

      if (mode === 'image2image' && fileList.length > 0) {
        // Append all uploaded images
        fileList.forEach((file) => {
          formData.append('image', file.originFileObj);
        });
      }

      const response = await axios.post('/api/generate-image', formData, {
        // 不要手动设置 multipart/form-data，让浏览器/axios 自动补 boundary
        onUploadProgress: (progressEvent) => {
          const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setProgress(percent);
        },
      });

      setImageUrl(response.data.imageUrl);
      message.success('图片生成成功！');
    } catch (error) {
      console.error('生成图片失败:', error);
      message.error('生成图片失败，请稍后重试');
    } finally {
      setLoading(false);
      setProgress(0);
    }
  };

  const handleCopyDownloadLink = async () => {
    if (!imageUrl) return;
    const filename = `generated_${Date.now()}.png`;
    let textToCopy = imageUrl;
    if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      textToCopy = `${origin}/api/proxy-image?url=${encodeURIComponent(imageUrl)}&filename=${encodeURIComponent(filename)}`;
    }
    try {
      await navigator.clipboard.writeText(textToCopy);
      message.success('下载链接已复制到剪贴板');
    } catch (e) {
      message.error('复制失败，请手动复制');
    }
  };

  const handleDownload = async () => {
    if (!imageUrl) return;
    const filename = `generated_${Date.now()}.png`;
    if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
      const proxyUrl = `/api/proxy-image?url=${encodeURIComponent(imageUrl)}&filename=${encodeURIComponent(filename)}`;
      try {
        const res = await fetch(proxyUrl);
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          message.error(data.error || '下载失败，请重试');
          return;
        }
        const blob = await res.blob();
        const blobUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = filename;
        link.click();
        URL.revokeObjectURL(blobUrl);
        message.success('图片已开始下载');
      } catch (e) {
        console.error(e);
        message.error('下载失败，请重试');
      }
    } else {
      const link = document.createElement('a');
      link.href = imageUrl;
      link.download = filename;
      link.click();
    }
  };

  return (
    <div style={{ padding: '2rem' }}>
      <Card 
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <PictureOutlined style={{ fontSize: '18px', color: '#667eea' }} />
            <span>AI 图像生成</span>
          </div>
        } 
        style={{ 
          borderRadius: '12px',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          background: 'rgba(255, 255, 255, 0.9)',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)'
        }}
      >
        <div style={{ marginBottom: '20px' }}>
          <Radio.Group 
            value={mode} 
            onChange={(e) => setMode(e.target.value)}
            style={{ marginBottom: '20px' }}
          >
            <Radio.Button value="text2image">文生图</Radio.Button>
            <Radio.Button value="image2image">图生图</Radio.Button>
          </Radio.Group>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
              提示词
            </label>
            <TextArea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="请输入详细的描述，例如：一只可爱的小猫在阳光下玩耍"
              rows={4}
              style={{ 
                borderRadius: '8px',
                border: '1px solid #e8e8e8',
                padding: '12px',
                resize: 'vertical'
              }}
            />
          </div>

          {mode === 'image2image' && (
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                参考图片
              </label>
              <Upload
                fileList={fileList}
                onChange={handleFileChange}
                beforeUpload={() => false}
                maxCount={5}
                style={{ width: '100%' }}
              >
                <Button icon={<UploadOutlined />} style={{ width: '100%' }}>
                  上传图片
                </Button>
              </Upload>
            </div>
          )}

          <Space orientation="vertical" style={{ width: '100%' }}>
            <Button
              type="primary"
              icon={<EditOutlined />}
              onClick={handleGenerate}
              loading={loading}
              style={{ 
                width: '100%',
                padding: '12px',
                fontSize: '16px',
                borderRadius: '8px',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                border: 'none',
                boxShadow: '0 4px 12px rgba(102, 126, 234, 0.4)'
              }}
            >
              {loading ? '生成中...' : '生成图片'}
            </Button>

            {loading && (
              <Progress 
                percent={progress} 
                status="active" 
                style={{ marginTop: '16px' }}
              />
            )}
          </Space>
        </div>

        {imageUrl && (
          <div style={{ marginTop: '20px', textAlign: 'center' }}>
            <Card 
              title="生成结果" 
              style={{ 
                borderRadius: '12px',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                background: 'rgba(255, 255, 255, 0.8)',
                display: 'inline-block',
                maxWidth: '100%'
              }}
            >
              <img 
                src={imageUrl} 
                alt="Generated Image" 
                style={{ 
                  maxWidth: '100%', 
                  maxHeight: '400px',
                  borderRadius: '8px',
                  objectFit: 'contain'
                }} 
              />
              <Space style={{ marginTop: '16px' }}>
                <Button
                  type="default"
                  icon={<CopyOutlined />}
                  onClick={handleCopyDownloadLink}
                  style={{ borderRadius: '6px' }}
                >
                  复制下载链接
                </Button>
                <Button
                  type="default"
                  onClick={handleDownload}
                  style={{ borderRadius: '6px' }}
                >
                  下载图片
                </Button>
              </Space>
            </Card>
          </div>
        )}
      </Card>
    </div>
  );
};

export default ImageGenerate;