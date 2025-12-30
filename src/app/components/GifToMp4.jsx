'use client';

import { useState } from 'react';
import { Button, Card, Space, Tag, Progress, Slider, Select, message, Typography } from 'antd';
const { Text } = Typography;
import { UploadOutlined, DownloadOutlined, DeleteOutlined, ReloadOutlined, SwapOutlined } from '@ant-design/icons';
import JSZip from 'jszip';

const { Option } = Select;

export default function GifToMp4() {
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [config, setConfig] = useState({
    crf: 23,
    preset: 'medium',
    fps: 30,
    bitrate: '192k'
  });
  const [converting, setConverting] = useState(false);
  const [toastLoading, setToastLoading] = useState(null);

  // 编码预设选项
  const presetOptions = [
    { value: 'ultrafast', label: '极快' },
    { value: 'superfast', label: '超快' },
    { value: 'veryfast', label: '非常快' },
    { value: 'faster', label: '更快' },
    { value: 'fast', label: '快' },
    { value: 'medium', label: '中等' },
    { value: 'slow', label: '慢' },
    { value: 'slower', label: '更慢' },
    { value: 'veryslow', label: '极慢' }
  ];

  // 处理配置变化
  const handleConfigChange = (key, value) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  // 处理转换
  const handleConvert = async () => {
    if (uploadedFiles.length === 0) {
      message.warning('请先上传文件');
      return;
    }

    const filesToConvert = uploadedFiles.filter(file => 
      file.status === 'uploaded' || file.status === 'failed'
    );

    if (filesToConvert.length === 0) {
      message.warning('没有需要转换的文件');
      return;
    }

    setConverting(true);
    const toastId = message.loading('开始转换...', 0);
    setToastLoading(toastId);

    try {
      // 重置所有要转换的文件状态
      setUploadedFiles(prev => prev.map(file => 
        filesToConvert.some(f => f.uid === file.uid) ? 
          { ...file, status: 'converting', error: null, progress: 0, convertedUrl: null } : file
      ));

      // 批量转换文件
      for (let i = 0; i < filesToConvert.length; i++) {
        const file = filesToConvert[i];
        
        // 更新当前文件的进度
        setUploadedFiles(prev => prev.map(f => 
          f.uid === file.uid ? { ...f, progress: 30 } : f
        ));

        // 上传文件并转换
        const formData = new FormData();
        formData.append('file', file.file);
        formData.append('config', JSON.stringify(config));

        const response = await fetch('/api/gif-to-mp4', {
          method: 'POST',
          body: formData,
        });

        // 更新当前文件的进度
        setUploadedFiles(prev => prev.map(f => 
          f.uid === file.uid ? { ...f, progress: 70 } : f
        ));

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({
            error: `转换失败，状态码: ${response.status}`
          }));
          throw new Error(errorData.error || `转换失败，状态码: ${response.status}`);
        }

        const blob = await response.blob();
        const convertedUrl = URL.createObjectURL(blob);

        // 更新当前文件状态为成功
        setUploadedFiles(prev => prev.map(f => 
          f.uid === file.uid ? { 
            ...f, 
            status: 'success', 
            progress: 100, 
            convertedUrl
          } : f
        ));
      }

      // 设置自动关闭时间
      message.success('所有文件转换完成', 3);
    } catch (error) {
      console.error('转换失败:', error);
      message.error(`转换失败: ${error.message}`);
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
    link.download = `${file.file.name.replace('.gif', '.mp4')}`;
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
    // 创建loading message
    const loadingToastId = message.loading('正在准备压缩包...', 0);

    try {
      for (const file of successFiles) {
        const response = await fetch(file.convertedUrl);
        const blob = await response.blob();
        const fileName = `${file.file.name.replace('.gif', '.mp4')}`;
        zip.file(fileName, blob);
      }

      const content = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(content);

      const link = document.createElement('a');
      link.href = url;
      link.download = 'converted-mp4-files.zip';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      URL.revokeObjectURL(url);
      // 先销毁loading message
      message.destroy(loadingToastId);
      // 再显示成功message
      message.success('压缩包下载完成', 3);
    } catch (error) {
      console.error('下载全部失败:', error);
      // 先销毁loading message
      message.destroy(loadingToastId);
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

  // 处理重试转换
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
          id="file-upload-gif-to-mp4"
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
                   
                  // 读取GIF预览
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
          onClick={() => document.getElementById('file-upload-gif-to-mp4').click()}
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
                      item.status === 'converting' ? 'orange' :
                      item.status === 'success' ? 'green' :
                      'red'
                    }
                  >
                    {item.status === 'uploaded' && '已上传'}
                    {item.status === 'converting' && '转换中'}
                    {item.status === 'success' && '转换成功'}
                    {item.status === 'failed' && '转换失败'}
                  </Tag>
                </div>
                <Space orientation="vertical" style={{ width: '100%' }}>
                  {item.status === 'converting' && (
                    <Progress percent={item.progress} size="small" status="active" />
                  )}
                  {item.status === 'failed' && (
                    <Text type="danger">{item.error || '转换失败'}</Text>
                  )}
                  
                  {/* 显示GIF预览 */}
                  {item.previewUrl && (
                    <div style={{ marginBottom: '8px' }}>
                      <Text type="secondary">GIF预览：</Text>
                      <img
                        src={item.previewUrl}
                        alt="GIF Preview"
                        width={100}
                        height={100}
                        style={{ border: '1px solid #d9d9d9', borderRadius: '4px' }}
                      />
                    </div>
                  )}
                  
                  {/* 显示转换后的MP4预览 */}
                  {item.convertedUrl && (
                    <div>
                      <Text type="secondary">MP4预览：</Text>
                      <video
                        src={item.convertedUrl}
                        alt="MP4 Preview"
                        width={100}
                        height={100}
                        controls
                        style={{ border: '1px solid #d9d9d9', borderRadius: '4px' }}
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
      <Card title="转换配置">
        <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
          <div>
            <Text strong>质量因子 ({config.crf})</Text>
            <Slider
              min={0}
              max={51}
              value={config.crf}
              onChange={(value) => handleConfigChange('crf', value)}
              marks={{
                0: '无损',
                23: '默认',
                51: '最低质量'
              }}
            />
            <Text type="secondary">数值越小质量越高，文件越大 (0-51)</Text>
          </div>

          <div>
            <Text strong>编码预设</Text>
            <Select
              value={config.preset}
              onChange={(value) => handleConfigChange('preset', value)}
              style={{ width: '100%' }}
            >
              {presetOptions.map(option => (
                <Option key={option.value} value={option.value}>
                  {option.label}
                </Option>
              ))}
            </Select>
            <Text type="secondary">越慢的预设生成的文件越小</Text>
          </div>

          <div>
            <Text strong>帧率 ({config.fps} FPS)</Text>
            <Slider
              min={15}
              max={60}
              step={5}
              value={config.fps}
              onChange={(value) => handleConfigChange('fps', value)}
              marks={{
                15: '15',
                30: '30',
                60: '60'
              }}
            />
            <Text type="secondary">控制视频每秒显示的帧数</Text>
          </div>

          <div>
            <Text strong>音频比特率</Text>
            <Select
              value={config.bitrate}
              onChange={(value) => handleConfigChange('bitrate', value)}
              style={{ width: '100%' }}
            >
              <Option value="96k">96 kbps</Option>
              <Option value="128k">128 kbps</Option>
              <Option value="192k">192 kbps</Option>
              <Option value="256k">256 kbps</Option>
              <Option value="320k">320 kbps</Option>
            </Select>
            <Text type="secondary">控制音频质量</Text>
          </div>
        </Space>
      </Card>

      {/* 转换按钮区域 */}
      <Space orientation="horizontal" style={{ width: '100%', justifyContent: 'space-between' }}>
        <Button
          type="primary"
          icon={<SwapOutlined />}
          size="large"
          onClick={handleConvert}
          loading={converting}
          disabled={uploadedFiles.length === 0}
          block
        >
          批量转换为 MP4
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