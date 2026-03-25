'use client';

import { useMemo, useState } from 'react';
import { Card, Upload, Button, Select, InputNumber, Space, Tag, message } from 'antd';
import { InboxOutlined, DownloadOutlined } from '@ant-design/icons';

function guessFilenameFromDisposition(disposition, fallback) {
  if (!disposition) return fallback;
  // try filename*=utf-8''...
  const mStar = /filename\*\s*=\s*utf-8''([^;]+)/i.exec(disposition);
  if (mStar?.[1]) return decodeURIComponent(mStar[1].replace(/"/g, ''));
  const m = /filename\s*=\s*"([^"]+)"/i.exec(disposition) || /filename\s*=\s*([^;]+)/i.exec(disposition);
  if (m?.[1]) return decodeURIComponent(String(m[1]).trim().replace(/"/g, ''));
  return fallback;
}

export default function AssetZipConvert() {
  const [fileList, setFileList] = useState([]);
  const [format, setFormat] = useState('vap'); // vap | svga
  const [fit, setFit] = useState('contain'); // contain | cover | stretch
  const [fps, setFps] = useState(30);
  const [width, setWidth] = useState(null);
  const [height, setHeight] = useState(null);
  const [loading, setLoading] = useState(false);

  const help = useMemo(() => {
    return (
      <Space wrap>
        <Tag color='purple'>ZIP</Tag>
        <Tag color='cyan'>序列帧</Tag>
        <Tag color='magenta'>SVGA/VAP</Tag>
        <Tag color='blue'>可选改尺寸</Tag>
      </Space>
    );
  }, []);

  const onConvert = async () => {
    const f = fileList?.[0]?.originFileObj ?? null;
    if (!f) {
      message.error('请先上传一个 zip 压缩包');
      return;
    }
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('file', f);
      fd.append('format', format);
      fd.append('fit', fit);
      fd.append('fps', String(fps ?? 30));
      if (width) fd.append('width', String(width));
      if (height) fd.append('height', String(height));

      const resp = await fetch('/api/asset-convert', { method: 'POST', body: fd });
      if (!resp.ok) {
        const err = await resp.json().catch(() => null);
        throw new Error(err?.message || err?.error || `转换失败 (${resp.status})`);
      }
      const blob = await resp.blob();
      const dispo = resp.headers.get('content-disposition');
      const fallbackName = `${(f.name || 'asset').replace(/\.zip$/i, '')}.${format}`;
      const filename = guessFilenameFromDisposition(dispo, fallbackName);

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      message.success('已生成并开始下载');
    } catch (e) {
      message.error(e?.message || '转换失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card title='压缩包动效转换（ZIP → SVGA / VAP）' extra={help}>
      <Space direction='vertical' size={12} style={{ width: '100%' }}>
        <Upload.Dragger
          multiple={false}
          accept='.zip'
          fileList={fileList}
          beforeUpload={() => false}
          onChange={(info) => setFileList(info.fileList.slice(-1))}
        >
          <p className='ant-upload-drag-icon'>
            <InboxOutlined />
          </p>
          <p className='ant-upload-text'>拖拽或点击上传 ZIP（内含序列帧图片）</p>
          <p className='ant-upload-hint'>支持 png / jpg / jpeg / webp。按文件名自然排序作为帧序列。</p>
        </Upload.Dragger>

        <Card size='small' title='转换参数'>
          <Space wrap>
            <span>输出</span>
            <Select
              value={format}
              onChange={setFormat}
              style={{ width: 140 }}
              options={[
                { value: 'vap', label: 'VAP (.vap)' },
                { value: 'svga', label: 'SVGA (.svga)' },
              ]}
            />

            <span>适配</span>
            <Select
              value={fit}
              onChange={setFit}
              style={{ width: 160 }}
              options={[
                { value: 'contain', label: 'Contain（等比留边）' },
                { value: 'cover', label: 'Cover（等比裁切）' },
                { value: 'stretch', label: 'Stretch（强制拉伸）' },
              ]}
            />

            <span>FPS</span>
            <InputNumber min={1} max={60} value={fps} onChange={setFps} />

            <span>宽</span>
            <InputNumber min={1} value={width} onChange={setWidth} placeholder='默认原始' />
            <span>高</span>
            <InputNumber min={1} value={height} onChange={setHeight} placeholder='默认原始' />
          </Space>
        </Card>

        <Button type='primary' icon={<DownloadOutlined />} loading={loading} onClick={onConvert}>
          开始转换并下载
        </Button>
      </Space>
    </Card>
  );
}

