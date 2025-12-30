'use client';

import { useState } from 'react';
import { Button, Card, Space, Tag, Progress, Slider, message, Select, Typography, Checkbox } from 'antd';
const { Text } = Typography;
import { UploadOutlined, DownloadOutlined, DeleteOutlined, ReloadOutlined, CompressOutlined } from '@ant-design/icons';
import JSZip from 'jszip';

const { Option } = Select;

export default function ImageCompress() {
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [config, setConfig] = useState({
    quality: 80,
    outputFormat: 'original', // original, jpeg, png, webp
    maxWidth: null,
    maxHeight: null,
    preserveExif: true,
    stripMetadata: false
  });
  const [compressing, setCompressing] = useState(false);
  const [toastLoading, setToastLoading] = useState(null);

  // 输出格式选项
  const formatOptions = [
    { value: 'original', label: '保持原格式' },
    { value: 'jpeg', label: 'JPEG' },
    { value: 'png', label: 'PNG' },
    { value: 'webp', label: 'WebP' }
  ];

  // 处理配置变化
  const handleConfigChange = (key, value) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  // 处理压缩
  const handleCompress = async () => {
    if (uploadedFiles.length === 0) {
      message.warning('请先上传文件');
      return;
    }

    const filesToCompress = uploadedFiles.filter(file => 
      file.status === 'uploaded' || file.status === 'failed'
    );

    if (filesToCompress.length === 0) {
      message.warning('没有需要压缩的文件');
      return;
    }

    setCompressing(true);
    const toastId = message.loading('开始压缩...', 0);
    setToastLoading(toastId);

    try {
      // 重置所有要压缩的文件状态
      setUploadedFiles(prev => prev.map(file => 
        filesToCompress.some(f => f.uid === file.uid) ? 
          { ...file, status: 'compressing', error: null, progress: 0, compressedUrl: null } : file
      ));

      // 批量压缩文件
      for (let i = 0; i < filesToCompress.length; i++) {
        const file = filesToCompress[i];
        
        // 更新当前文件的进度
        setUploadedFiles(prev => prev.map(f => 
          f.uid === file.uid ? { ...f, progress: 30 } : f
        ));

        // 上传文件并压缩
        const formData = new FormData();
        formData.append('file', file.file);
        formData.append('config', JSON.stringify(config));

        const response = await fetch('/api/compress-image', {
          method: 'POST',
          body: formData,
        });

        // 更新当前文件的进度
        setUploadedFiles(prev => prev.map(f => 
          f.uid === file.uid ? { ...f, progress: 70 } : f
        ));

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({
            error: `压缩失败，状态码: ${response.status}`
          }));
          throw new Error(errorData.error || `压缩失败，状态码: ${response.status}`);
        }

        const blob = await response.blob();
        const compressedUrl = URL.createObjectURL(blob);

        // 获取压缩信息
        const compressionInfo = JSON.parse(response.headers.get('x-compression-info') || '{}');

        // 更新当前文件状态为成功
        setUploadedFiles(prev => prev.map(f => 
          f.uid === file.uid ? { 
            ...f, 
            status: 'success', 
            progress: 100, 
            compressedUrl,
            compressionInfo
          } : f
        ));
      }

      // 设置自动关闭时间
      message.success('所有文件压缩完成', 3);
    } catch (error) {
      console.error('压缩失败:', error);
      message.error(`压缩失败: ${error.message}`);
    } finally {
      setCompressing(false);
      if (toastLoading) {
        message.destroy(toastLoading);
        setToastLoading(null);
      }
    }
  };

  // 处理下载单个文件
  const handleDownload = (file) => {
    if (!file.compressedUrl) return;

    const fileExtension = config.outputFormat === 'original' 
      ? file.file.name.split('.').pop() 
      : config.outputFormat;
    
    const link = document.createElement('a');
    link.href = file.compressedUrl;
    link.download = `${file.file.name.replace(/\.[^/.]+$/, '')}_compressed.${fileExtension}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // 处理下载全部文件
  const handleDownloadAll = async () => {
    const successFiles = uploadedFiles.filter(file => file.status === 'success' && file.compressedUrl);
    if (successFiles.length === 0) {
      message.warning('没有可下载的文件');
      return;
    }

    const zip = new JSZip();
    const toastId = message.loading('正在准备压缩包...', 0);

    try {
      for (const file of successFiles) {
        const fileExtension = config.outputFormat === 'original' 
          ? file.file.name.split('.').pop() 
          : config.outputFormat;
        
        const response = await fetch(file.compressedUrl);
        const blob = await response.blob();
        const fileName = `${file.file.name.replace(/\.[^/.]+$/, '')}_compressed.${fileExtension}`;
        zip.file(fileName, blob);
      }

      const content = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(content);

      const link = document.createElement('a');
      link.href = url;
      link.download = 'compressed-images.zip';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      URL.revokeObjectURL(url);
      // 先销毁loading message
      message.destroy(toastId);
      // 再显示成功message
      message.success('压缩包下载完成', 3);
    } catch (error) {
      console.error('下载全部失败:', error);
      // 先销毁loading message
      message.destroy(toastId);
      // 再显示错误message
      message.error(`下载全部失败: ${error.message}`);
    }
  };

  // 处理删除文件
  const handleRemoveFile = (uid) => {
    setUploadedFiles(prev => {
      // 释放URL对象以避免内存泄漏
      const fileToRemove = prev.find(f => f.uid === uid);
      if (fileToRemove?.previewUrl) {
        URL.revokeObjectURL(fileToRemove.previewUrl);
      }
      if (fileToRemove?.compressedUrl) {
        URL.revokeObjectURL(fileToRemove.compressedUrl);
      }
      return prev.filter(f => f.uid !== uid);
    });
  };

  // 处理重试压缩
  const handleRetryCompress = (uid) => {
    setUploadedFiles(prev => prev.map(f => 
      f.uid === uid ? { ...f, status: 'uploaded', error: null, progress: 0, compressedUrl: null, compressionInfo: null } : f
    ));
  };

  return (
    <Space orientation="vertical" size="large" style={{ width: '100%' }}>
      {/* 文件上传区域 */}
      <Card title="上传图片文件">
        <input
          type="file"
          id="file-upload-image"
          accept="image/*"
          multiple
          style={{ display: 'none' }}
          onChange={(e) => {
            const files = Array.from(e.target.files);
            files.forEach(file => {
              if (file.type.startsWith('image/')) {
                // 检查文件是否已经存在
                setUploadedFiles(prev => {
                  const fileExists = prev.some(f => f.file.name === file.name && f.file.size === file.size);
                  if (fileExists) {
                    message.warning(`${file.name} 已经上传过了`);
                    return prev;
                  }
                    
                  const newFile = {
                    uid: Date.now() + Math.random(),
                    file: file,
                    status: 'uploaded',
                    previewUrl: null,
                    compressedUrl: null,
                    error: null,
                    progress: 0,
                    compressionInfo: null
                  };
                    
                  // 读取图片预览
                  const reader = new FileReader();
                  reader.onload = (e) => {
                    setUploadedFiles(current => current.map(f => 
                      f.uid === newFile.uid ? { ...f, previewUrl: e.target.result } : f
                    ));
                  };
                  reader.readAsDataURL(file);
                    
                  return [...prev, newFile];
                });
              } else {
                message.error(`${file.name} 不是图片格式，已忽略`);
              }
            });
            // 清空文件输入，以便可以重新选择相同的文件
            e.target.value = '';
          }}
        />
        <Button
          icon={<UploadOutlined />}
          size="large"
          type="primary"
          onClick={() => document.getElementById('file-upload-image').click()}
        >
          选择多个图片文件
        </Button>

        <Text type="secondary" style={{ marginLeft: '1rem' }}>
          支持批量上传，接受 JPEG, PNG, WebP, GIF 等各种图片格式
        </Text>
      </Card>

      {/* 已上传文件列表 */}
      {uploadedFiles.length > 0 && (
        <Card title={`已上传文件 (${uploadedFiles.length})`}>
          <div style={{ padding: '0 16px' }}>
            {uploadedFiles.map((item) => (
              <div
                key={item.uid}
                style={{
                  padding: '12px 0',
                  borderBottom: '1px solid #f0f0f0',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start'
                }}
              >
                <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
                  <Text ellipsis style={{ maxWidth: 200 }}>{item.file.name}</Text>
                  <Tag
                    style={{ marginLeft: '8px' }}
                    color={
                      item.status === 'uploaded' ? 'blue' :
                      item.status === 'compressing' ? 'orange' :
                      item.status === 'success' ? 'green' :
                      'red'
                    }
                  >
                    {item.status === 'uploaded' && '已上传'}
                    {item.status === 'compressing' && '压缩中'}
                    {item.status === 'success' && '压缩成功'}
                    {item.status === 'failed' && '压缩失败'}
                  </Tag>
                </div>
                <Space orientation="vertical" style={{ width: '100%' }}>
                  {item.status === 'compressing' && (
                    <Progress percent={item.progress} size="small" status="active" />
                  )}
                  {item.status === 'failed' && (
                    <Text type="danger">{item.error || '压缩失败'}</Text>
                  )}
                  {item.status === 'success' && item.compressionInfo && (
                    <Text type="success">
                      压缩率: {(item.compressionInfo.compressionRatio || 0).toFixed(1)}%
                      {' | '}
                      原始大小: {((item.compressionInfo.originalSize || 0) / (1024 * 1024)).toFixed(2)} MB
                      {' | '}
                      压缩后: {((item.compressionInfo.compressedSize || 0) / (1024 * 1024)).toFixed(2)} MB
                    </Text>
                  )}
                  
                  {/* 显示图片预览 */}
                  {item.previewUrl && (
                    <div style={{ marginBottom: '8px' }}>
                      <Text type="secondary">图片预览：</Text>
                      <img
                        src={item.previewUrl}
                        alt="Image Preview"
                        width={150}
                        height={100}
                        style={{ border: '1px solid #d9d9d9', borderRadius: '4px', objectFit: 'contain' }}
                      />
                    </div>
                  )}
                </Space>
              </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginLeft: '16px' }}>
                  {item.status === 'success' && (
                    <Button
                      type="link"
                      icon={<DownloadOutlined />}
                      onClick={() => handleDownload(item)}
                      size="small"
                    >
                      下载
                    </Button>
                  )}
                  {item.status === 'failed' && (
                    <Button
                      type="link"
                      icon={<ReloadOutlined />}
                      onClick={() => handleRetryCompress(item.uid)}
                      size="small"
                    >
                      重试
                    </Button>
                  )}
                  <Button
                    type="link"
                    danger
                    icon={<DeleteOutlined />}
                    onClick={() => handleRemoveFile(item.uid)}
                    size="small"
                  >
                    删除
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* 配置选项 */}
      <Card title="压缩配置">
        <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
          <div>
            <Text strong>质量 ({config.quality})</Text>
            <Slider
              min={1}
              max={100}
              value={config.quality}
              onChange={(value) => handleConfigChange('quality', value)}
            />
          </div>

          <div>
            <Text strong>输出格式</Text>
            <Select
              value={config.outputFormat}
              onChange={(value) => handleConfigChange('outputFormat', value)}
              style={{ width: '100%' }}
            >
              {formatOptions.map(option => (
                <Option key={option.value} value={option.value}>
                  {option.label}
                </Option>
              ))}
            </Select>
          </div>

          <div>
            <Text strong>最大宽度 (像素)</Text>
            <Slider
              min={0}
              max={8192}
              step={100}
              value={config.maxWidth || 0}
              onChange={(value) => handleConfigChange('maxWidth', value === 0 ? null : value)}
              marks={{
                0: '原始',
                1920: '1920px',
                3840: '4K',
                7680: '8K'
              }}
            />
          </div>

          <div>
            <Text strong>最大高度 (像素)</Text>
            <Slider
              min={0}
              max={8192}
              step={100}
              value={config.maxHeight || 0}
              onChange={(value) => handleConfigChange('maxHeight', value === 0 ? null : value)}
              marks={{
                0: '原始',
                1080: '1080px',
                2160: '2K',
                4320: '4K'
              }}
            />
          </div>

          <div>
            <Checkbox
              checked={config.preserveExif}
              onChange={(e) => handleConfigChange('preserveExif', e.target.checked)}
            >
              保留 EXIF 数据
            </Checkbox>
          </div>

          <div>
            <Checkbox
              checked={config.stripMetadata}
              onChange={(e) => handleConfigChange('stripMetadata', e.target.checked)}
            >
              移除元数据 (减小文件大小)
            </Checkbox>
          </div>
        </Space>
      </Card>

      {/* 压缩按钮区域 */}
      <Space orientation="horizontal" style={{ width: '100%', justifyContent: 'space-between' }}>
        <Button
          type="primary"
          icon={<CompressOutlined />}
          size="large"
          onClick={handleCompress}
          loading={compressing}
          disabled={uploadedFiles.length === 0}
          block
        >
          批量压缩图片
        </Button>
        
        {uploadedFiles.some(file => file.status === 'success') && (
          <Button
            type="default"
            icon={<DownloadOutlined />}
            size="large"
            onClick={handleDownloadAll}
          >
            下载全部
          </Button>
        )}
      </Space>
    </Space>
  );
}