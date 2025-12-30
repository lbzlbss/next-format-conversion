'use client';
import React, { useState } from 'react';
import { Button, Slider, Checkbox, Card, Space, Typography, message, Tag, Progress } from 'antd';
import { UploadOutlined, DownloadOutlined, SwapOutlined, DeleteOutlined, ReloadOutlined } from '@ant-design/icons';
import Image from 'next/image';
import JSZip from 'jszip';

const { Title, Text } = Typography;

const HomePage = () => {
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [converting, setConverting] = useState(false);
  const [config, setConfig] = useState({
    quality: 40,
    effort: 4,
    speed: 8,
    nearLossless: false
  });



  const handleRemoveFile = (uid) => {
    setUploadedFiles(prev => {
      const updated = prev.filter(file => file.uid !== uid);
      // 清除 URL.createObjectURL 创建的对象 URL
      const removedFile = prev.find(file => file.uid === uid);
      if (removedFile?.convertedUrl) {
        URL.revokeObjectURL(removedFile.convertedUrl);
      }
      return updated;
    });
  };

  const handleConvert = async () => {
    if (uploadedFiles.length === 0) {
      message.error('请先上传 GIF 文件');
      return;
    }

    setConverting(true);
    const filesToConvert = uploadedFiles.filter(file => file.status === 'uploaded' || file.status === 'failed');

    if (filesToConvert.length === 0) {
      message.info('没有需要转换的文件');
      setConverting(false);
      return;
    }

    // 更新所有要转换的文件状态为 converting
    setUploadedFiles(prev => prev.map(file => 
      filesToConvert.find(f => f.uid === file.uid) ? 
        { ...file, status: 'converting', progress: 0, error: null } : 
        file
    ));

    // 逐一转换文件
    for (const fileToConvert of filesToConvert) {
      try {
        // 更新单个文件的进度
        setUploadedFiles(prev => prev.map(file => 
          file.uid === fileToConvert.uid ? { ...file, progress: 30 } : file
        ));

        const formData = new FormData();
        formData.append('file', fileToConvert.file);
        formData.append('config', JSON.stringify(config));

        const response = await fetch('/api/convert-gif', {
          method: 'POST',
          body: formData,
        });

        // 更新进度
        setUploadedFiles(prev => prev.map(file => 
          file.uid === fileToConvert.uid ? { ...file, progress: 70 } : file
        ));

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: '转换失败' }));
          throw new Error(errorData.error || '转换失败');
        }

        const blob = await response.blob();
        const url = URL.createObjectURL(blob);

        // 更新文件状态为成功
        setUploadedFiles(prev => prev.map(file => 
          file.uid === fileToConvert.uid ? 
            { ...file, status: 'success', progress: 100, convertedUrl: url } : 
            file
        ));

      } catch (error) {
        console.error('转换错误:', error);
        // 更新文件状态为失败
        setUploadedFiles(prev => prev.map(file => 
          file.uid === fileToConvert.uid ? 
            { ...file, status: 'failed', progress: 0, error: error.message } : 
            file
        ));
      }
    }

    setConverting(false);
    message.success(`已完成 ${filesToConvert.length} 个文件的转换`);
  };

  const handleDownload = (fileItem) => {
    if (!fileItem.convertedUrl) return;

    const link = document.createElement('a');
    link.href = fileItem.convertedUrl;
    link.download = fileItem.file.name.replace('.gif', '.webp');
    // 添加到DOM中确保在所有浏览器中都能正常工作
    document.body.appendChild(link);
    link.click();
    // 下载完成后移除元素
    setTimeout(() => {
      document.body.removeChild(link);
      // 释放URL对象
      URL.revokeObjectURL(fileItem.convertedUrl);
    }, 100);
  };

  const handleDownloadAll = async () => {
    const successFiles = uploadedFiles.filter(file => file.status === 'success');
    if (successFiles.length === 0) {
      message.info('没有可下载的转换后的文件');
      return;
    }

    // 保存loading提示的返回值，用于手动关闭
    const hideLoading = message.loading('正在准备压缩包，请稍候...', 0);
    
    try {
      const zip = new JSZip();
      
      // 并行下载所有文件并添加到zip中
      await Promise.all(successFiles.map(async (file) => {
        if (file.convertedUrl) {
          // 从convertedUrl获取blob数据
          const response = await fetch(file.convertedUrl);
          const blob = await response.blob();
          // 计算文件名
          const fileName = file.file.name.replace('.gif', '.webp');
          // 添加到zip中
          zip.file(fileName, blob);
        }
      }));
      
      // 生成zip文件
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      
      // 创建下载链接
      const link = document.createElement('a');
      link.href = URL.createObjectURL(zipBlob);
      link.download = `webp_converted_${Date.now()}.zip`;
      document.body.appendChild(link);
      link.click();
      
      // 清理
      setTimeout(() => {
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
      }, 100);
      
      // 关闭loading提示
      hideLoading();
      message.success(`已开始下载包含 ${successFiles.length} 个文件的压缩包`);
    } catch (error) {
      console.error('创建压缩包失败:', error);
      // 关闭loading提示
      hideLoading();
      message.error('创建压缩包失败，请重试');
    }
  };

  const handleConfigChange = (field, value) => {
    setConfig(prev => ({ ...prev, [field]: value }));
  };

  const handleRetryConvert = (uid) => {
    setUploadedFiles(prev => prev.map(file => 
      file.uid === uid ? { ...file, status: 'uploaded', error: null } : file
    ));
  };

  return (
      <div style={{ maxWidth: 800, margin: '0 auto', padding: '2rem' }}>
        <Title level={2} style={{ textAlign: 'center', marginBottom: '2rem' }}>
          GIF 转 WebP 工具
        </Title>

        <Space orientation="vertical" size="large" style={{ width: '100%' }}>
          {/* 文件上传区域 */}
          <Card title="上传 GIF 文件">
            <input
              type="file"
              id="file-upload"
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
              onClick={() => document.getElementById('file-upload').click()}
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
                      
                      {/* 显示转换后的WebP图片 */}
                      {item.convertedUrl && (
                        <div>
                          <Text type="secondary">转换后：</Text>
                          <img
                            src={item.convertedUrl}
                            alt="WebP Preview"
                            width={100}
                            height={100}
                            style={{ border: '1px solid #d9d9d9', borderRadius: '4px' }}
                          />
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
          <Card title="转换配置">
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
                <Text strong>压缩效率 ({config.effort})</Text>
                <Slider
                  min={1}
                  max={6}
                  value={config.effort}
                  onChange={(value) => handleConfigChange('effort', value)}
                />
              </div>

              <div>
                <Text strong>编码速度 ({config.speed})</Text>
                <Slider
                  min={0}
                  max={10}
                  value={config.speed}
                  onChange={(value) => handleConfigChange('speed', value)}
                />
              </div>

              <div>
                <Checkbox
                  checked={config.nearLossless}
                  onChange={(e) => handleConfigChange('nearLossless', e.target.checked)}
                >
                  近无损压缩
                </Checkbox>
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
              批量转换为 WebP
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
      </div>
    );
};

export default HomePage;