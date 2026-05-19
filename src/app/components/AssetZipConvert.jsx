'use client';

import { useEffect, useMemo, useState } from 'react';
import { Alert, Card, Upload, Button, Select, InputNumber, Space, Tag, message } from 'antd';
import { InboxOutlined, DownloadOutlined } from '@ant-design/icons';
import { upload } from '@vercel/blob/client';

function guessFilenameFromDisposition(disposition, fallback) {
  if (!disposition) return fallback;
  // try filename*=utf-8''...
  const mStar = /filename\*\s*=\s*utf-8''([^;]+)/i.exec(disposition);
  if (mStar?.[1]) return decodeURIComponent(mStar[1].replace(/"/g, ''));
  const m = /filename\s*=\s*"([^"]+)"/i.exec(disposition) || /filename\s*=\s*([^;]+)/i.exec(disposition);
  if (m?.[1]) return decodeURIComponent(String(m[1]).trim().replace(/"/g, ''));
  return fallback;
}

const PENDING_TASK_KEY = 'asset_zip_convert_pending_v1';

export default function AssetZipConvert() {
  const [fileList, setFileList] = useState([]);
  const [format, setFormat] = useState('vap'); // vap | svga
  const [fit, setFit] = useState('contain'); // contain | cover | stretch
  const [fps, setFps] = useState(30);
  const [width, setWidth] = useState(null);
  const [height, setHeight] = useState(null);
  const [loading, setLoading] = useState(false);
  const [pack, setPack] = useState('right');
  const [stage, setStage] = useState('idle'); // idle | uploading | converting
  const [pendingTask, setPendingTask] = useState(null);

  const help = useMemo(() => {
    return (
      <Space wrap>
        <Tag color='green'>ZIP</Tag>
        <Tag color='cyan'>序列帧</Tag>
        <Tag color='magenta'>SVGA/VAP</Tag>
        <Tag color='blue'>可选改尺寸</Tag>
      </Space>
    );
  }, []);

  useEffect(() => {
    try {
      const raw = window.sessionStorage.getItem(PENDING_TASK_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed?.blobUrl && parsed?.filename) {
        setPendingTask(parsed);
      }
    } catch (_) {}
  }, []);

  useEffect(() => {
    if (!loading) return;
    const onBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = '转换进行中，离开页面会中断当前任务。';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [loading]);

  const runConvertRequest = async (payload, fallbackFileName) => {
    setStage('converting');
    window.sessionStorage.setItem(PENDING_TASK_KEY, JSON.stringify(payload));
    setPendingTask(payload);

    const resp = await fetch('/api/asset-convert', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!resp.ok) {
      const err = await resp.json().catch(() => null);
      throw new Error(err?.message || err?.error || `转换失败 (${resp.status})`);
    }

    const blob = await resp.blob();
    const dispo = resp.headers.get('content-disposition');
    const fallbackName = `${(fallbackFileName || 'asset').replace(/\.zip$/i, '')}.${payload.format}`;
    const filename = guessFilenameFromDisposition(dispo, fallbackName);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);

    window.sessionStorage.removeItem(PENDING_TASK_KEY);
    setPendingTask(null);
  };

  const onConvert = async () => {
    const f = fileList?.[0]?.originFileObj ?? null;
    if (!f) {
      message.error('请先上传一个 zip 压缩包');
      return;
    }
    setLoading(true);
    try {
      setStage('uploading');
      const uploaded = await upload(f.name, f, {
        access: 'public',
        handleUploadUrl: '/api/blob/upload',
      });

      const payload = {
        blobUrl: uploaded.url,
        filename: f.name,
        format,
        fit,
        fps: Number(fps ?? 30),
        width: width || null,
        height: height || null,
        pack,
      };
      await runConvertRequest(payload, f.name);
      message.success('已生成并开始下载');
    } catch (e) {
      message.error(e?.message || '转换失败');
    } finally {
      setStage('idle');
      setLoading(false);
    }
  };

  const onResumePending = async () => {
    if (!pendingTask?.blobUrl) {
      message.info('没有可恢复的任务');
      return;
    }
    setLoading(true);
    try {
      await runConvertRequest(pendingTask, pendingTask.filename);
      message.success('已恢复并完成下载');
    } catch (e) {
      message.error(e?.message || '恢复任务失败');
    } finally {
      setStage('idle');
      setLoading(false);
    }
  };

  return (
    <Card title='压缩包动效转换（ZIP → SVGA / VAP）' extra={help}>
      <Space direction='vertical' size={12} style={{ width: '100%' }}>
        {pendingTask?.blobUrl ? (
          <Alert
            type='warning'
            showIcon
            title='检测到上次转换任务'
            description={`文件：${pendingTask.filename || 'asset.zip'}，可直接继续转换（无需重新上传）。`}
            action={
              <Button size='small' onClick={onResumePending} loading={loading}>
                继续转换
              </Button>
            }
          />
        ) : null}

        {loading ? (
          <Alert
            type='info'
            showIcon
            title={stage === 'uploading' ? '正在上传到 Blob...' : '正在服务端转换，请勿刷新页面...'}
          />
        ) : null}

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

            {format === 'vap' ? (
              <>
                <span>拼接</span>
                <Select
                  value={pack}
                  onChange={setPack}
                  style={{ width: 180 }}
                  options={[
                    { value: 'right', label: '左右拼接（RGB左 + Alpha右）' },
                    { value: 'bottom', label: '上下拼接（RGB上 + Alpha下）' },
                  ]}
                />
              </>
            ) : null}

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

