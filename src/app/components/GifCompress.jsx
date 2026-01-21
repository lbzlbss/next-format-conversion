'use client';

import { useState } from 'react';
import { Button, Card, Space, Tag, Progress, Checkbox, Slider, message, Typography } from 'antd';
const { Text } = Typography;
import { UploadOutlined, DownloadOutlined, DeleteOutlined, ReloadOutlined, CompressOutlined } from '@ant-design/icons';
import JSZip from 'jszip';

export default function GifCompress() {
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [config, setConfig] = useState({
    quality: 30,
    effort: 10,
    speed: 1,
    colors: 256,
    dither: 0.2,
    compressionLevel: 9,
    lossy: true
  });
  const [converting, setConverting] = useState(false);
  const [toastLoading, setToastLoading] = useState(null);

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

    setConverting(true);
    const toastId = message.loading('开始压缩...', 0);
    setToastLoading(toastId);

    try {
      // 重置所有要压缩的文件状态
      setUploadedFiles(prev => prev.map(file => 
        filesToCompress.some(f => f.uid === file.uid) ? 
          { ...file, status: 'converting', error: null, progress: 0, convertedUrl: null } : file
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

        const response = await fetch('/api/compress-gif', {
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
        const convertedUrl = URL.createObjectURL(blob);

        // 获取压缩前后的体积信息
        const originalSize = parseInt(response.headers.get('X-Original-Size')) || 0;
        const compressedSize = parseInt(response.headers.get('X-Compressed-Size')) || 0;
        const compressionRate = response.headers.get('X-Compression-Rate') || '0%';
        const compressionResult = response.headers.get('X-Compression-Result') || 'compressed';
        
        // 更新当前文件状态为成功，并保存体积信息
        setUploadedFiles(prev => prev.map(f => 
          f.uid === file.uid ? { 
            ...f, 
            status: 'success', 
            progress: 100, 
            convertedUrl,
            originalSize,
            compressedSize,
            compressionRate,
            compressionResult
          } : f
        ));
      }

      // 设置自动关闭时间
      message.success('所有文件压缩完成', 3);
    } catch (error) {
      console.error('压缩失败:', error);
      message.error(`压缩失败: ${error.message}`);
    } finally {
      setConverting(false);
      if (toastLoading) {
        message.destroy(toastLoading);
        setToastLoading(null);
      }
    }
  };

  // 处理下载单个文件
  const handleDownload = (file) => {
    if (!file.convertedUrl) return;

    const link = document.createElement('a');
    link.href = file.convertedUrl;
    link.download = `compressed-${file.file.name}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // 处理下载全部文件
  const handleDownloadAll = async () => {
    const successFiles = uploadedFiles.filter(file => file.status === 'success' && file.convertedUrl);
    if (successFiles.length === 0) {
      message.warning('没有可下载的文件');
      return;
    }

    const zip = new JSZip();
    const toastId = message.loading('正在准备压缩包...', 0);

    try {
      for (const file of successFiles) {
        const response = await fetch(file.convertedUrl);
        const blob = await response.blob();
        const fileName = `compressed-${file.file.name}`;
        zip.file(fileName, blob);
      }

      const content = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(content);

      const link = document.createElement('a');
      link.href = url;
      link.download = 'compressed-gif-files.zip';
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
      if (fileToRemove?.convertedUrl) {
        URL.revokeObjectURL(fileToRemove.convertedUrl);
      }
      return prev.filter(f => f.uid !== uid);
    });
  };

  // 处理重试压缩
  const handleRetryConvert = (uid) => {
    setUploadedFiles(prev => prev.map(f => 
      f.uid === uid ? { ...f, status: 'uploaded', error: null, progress: 0, convertedUrl: null } : f
    ));
  };

  return (
    <Space orientation="vertical" size="large" style={{ width: '100%' }}>
      {/* 文件上传区域 */}
      <Card title="上传 GIF 文件">
        <input
          type="file"
          id="file-upload-gif-compress"
          accept="image/gif"
          multiple
          style={{ display: 'none' }}
          onChange={(e) => {
            const files = Array.from(e.target.files);
            files.forEach(file => {
              if (file.type === 'image/gif') {
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
                    convertedUrl: null,
                    error: null,
                    progress: 0
                  };
                    
                  // 读取文件预览
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
                message.error(`${file.name} 不是 GIF 格式，已忽略`);
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
          onClick={() => document.getElementById('file-upload-gif-compress').click()}
        >
          选择多个 GIF 文件
        </Button>

        <Text type="secondary" style={{ marginLeft: '1rem' }}>
          支持批量上传，仅接受 GIF 格式
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
                  alignItems: 'center'
                }}
              >
                <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
                  <Text ellipsis style={{ maxWidth: 200 }}>{item.file.name}</Text>
                  <Tag
                    style={{ marginLeft: '8px' }}
                    color={
                      item.status === 'uploaded' ? 'blue' :
                      item.status === 'converting' ? 'orange' :
                      item.status === 'success' ? 'green' :
                      'red'
                    }
                  >
                    {item.status === 'uploaded' && '已上传'}
                    {item.status === 'converting' && '压缩中'}
                    {item.status === 'success' && '压缩成功'}
                    {item.status === 'failed' && '压缩失败'}
                  </Tag>
                </div>
                <Space orientation="vertical" style={{ width: '100%' }}>
                  {item.status === 'converting' && (
                    <Progress percent={item.progress} size="small" status="active" />
                  )}
                  {item.status === 'failed' && (
                    <Text type="danger">{item.error || '压缩失败'}</Text>
                  )}
                  
                  {/* 显示上传的GIF预览 */}
                  {item.previewUrl && (
                    <div style={{ marginBottom: '8px' }}>
                      <Text type="secondary">原图预览：</Text>
                      <img
                        src={item.previewUrl}
                        alt="GIF Preview"
                        width={100}
                        height={100}
                        style={{ border: '1px solid #d9d9d9', borderRadius: '4px' }}
                      />
                    </div>
                  )}
                  
                  {/* 显示压缩后的GIF图片 */}
                  {item.convertedUrl && (
                    <div>
                      <Text type="secondary">压缩后：</Text>
                      <img
                        src={item.convertedUrl}
                        alt="Compressed GIF Preview"
                        width={100}
                        height={100}
                        style={{ border: '1px solid #d9d9d9', borderRadius: '4px' }}
                      />
                    </div>
                  )}
                  
                  {/* 显示压缩前后体积对比 */}
                  {item.originalSize > 0 && item.compressedSize > 0 && (
                    <div style={{ 
                      backgroundColor: '#f0f9ff', 
                      padding: '10px', 
                      borderRadius: '8px',
                      marginTop: '8px'
                    }}>
                      <Space orientation="vertical" style={{ width: '100%' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Text type="secondary">原始体积：</Text>
                          <Text strong>{(item.originalSize / 1024).toFixed(2)} KB</Text>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Text type="secondary">压缩后体积：</Text>
                          <Text strong>{(item.compressedSize / 1024).toFixed(2)} KB</Text>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Text type="secondary">压缩率：</Text>
                          <Text strong style={{ 
                            color: item.compressionResult === 'original' ? '#faad14' : '#52c41a' 
                          }}>
                            {item.compressionResult === 'original' ? '未压缩（文件已最优）' : item.compressionRate}
                          </Text>
                        </div>
                        <div style={{ marginTop: '4px' }}>
                          <Progress 
                            percent={item.compressionResult === 'original' ? 0 : parseFloat(item.compressionRate.replace('%', ''))} 
                            size="small" 
                            status={item.compressionResult === 'original' ? 'exception' : 'success'}
                            strokeColor={{
                              '0%': '#108ee9',
                              '100%': '#87d068',
                            }}
                          />
                        </div>
                      </Space>
                    </div>
                  )}
                </Space>
              </div>
                <div style={{ display: 'flex', gap: '8px', marginLeft: '16px' }}>
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
                      onClick={() => handleRetryConvert(item.uid)}
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
      <Card title="压缩配置" className="shadow-md hover:shadow-lg transition-shadow">
        <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
          {/* 质量控制 */}
          <div className="p-3 bg-gray-50 rounded-lg">
            <Text strong className="block mb-1">质量 ({config.quality})</Text>
            <Slider
              min={1}
              max={100}
              value={config.quality}
              onChange={(value) => handleConfigChange('quality', value)}
              tooltip={{ formatter: (value) => `${value}%` }}
            />
          </div>

          {/* 颜色数量控制 */}
          <div className="p-3 bg-gray-50 rounded-lg">
            <Text strong className="block mb-1">颜色数量 ({config.colors})</Text>
            <Slider
              min={2}
              max={256}
              step={4}
              value={config.colors}
              onChange={(value) => handleConfigChange('colors', value)}
              tooltip={{ formatter: (value) => `${value} 色` }}
            />
          </div>

          {/* 压缩效率控制 */}
          <div className="p-3 bg-gray-50 rounded-lg">
            <Text strong className="block mb-1">压缩效率 ({config.effort})</Text>
            <Slider
              min={1}
              max={10}
              value={config.effort}
              onChange={(value) => handleConfigChange('effort', value)}
              tooltip={{ formatter: (value) => `${value}` }}
            />
          </div>

          {/* 编码速度控制 */}
          <div className="p-3 bg-gray-50 rounded-lg">
            <Text strong className="block mb-1">编码速度 ({config.speed})</Text>
            <Slider
              min={1}
              max={10}
              value={config.speed}
              onChange={(value) => handleConfigChange('speed', value)}
              tooltip={{ formatter: (value) => `${value}` }}
            />
          </div>

          {/* 抖动控制 */}
          <div className="p-3 bg-gray-50 rounded-lg">
            <Text strong className="block mb-1">抖动强度 ({config.dither.toFixed(1)})</Text>
            <Slider
              min={0}
              max={1}
              step={0.1}
              value={config.dither}
              onChange={(value) => handleConfigChange('dither', value)}
              tooltip={{ formatter: (value) => `${value.toFixed(1)}` }}
            />
          </div>

          {/* 压缩级别控制 */}
          <div className="p-3 bg-gray-50 rounded-lg">
            <Text strong className="block mb-1">压缩级别 ({config.compressionLevel})</Text>
            <Slider
              min={1}
              max={9}
              value={config.compressionLevel}
              onChange={(value) => handleConfigChange('compressionLevel', value)}
              tooltip={{ formatter: (value) => `${value}` }}
            />
          </div>

          {/* 有损压缩选项 */}
          <div className="p-3 bg-gray-50 rounded-lg">
            <Checkbox
              checked={config.lossy}
              onChange={(e) => handleConfigChange('lossy', e.target.checked)}
            >
              <Text strong>启用有损压缩</Text>
            </Checkbox>
            <Text type="secondary" style={{ marginLeft: '8px' }}>（推荐启用，可显著减小文件体积）</Text>
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
          loading={converting}
          disabled={uploadedFiles.length === 0}
          block
        >
          批量压缩 GIF
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