'use client';

import { useEffect, useMemo, useState } from 'react';
import { Alert, Card, Upload, Button, Select, InputNumber, Space, Tag, message } from 'antd';
import { InboxOutlined, DownloadOutlined } from '@ant-design/icons';
import { upload } from '@vercel/blob/client';
import VapWebglPreview from './home/VapWebglPreview';
import { parseVapcFromArrayBuffer } from '../lib/vap-mp4-client';
import { releaseTempBlob } from '../lib/blob-release-client';
import {
  ASSET_ZIP_MAX_BYTES,
  BLOB_MULTIPART_THRESHOLD_BYTES,
  formatBytes,
  assertLocalZipFile,
  safeZipBlobPathname,
} from '../lib/upload-limits';

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
  const [previewUrl, setPreviewUrl] = useState(null);
  const [previewConfig, setPreviewConfig] = useState(null);
  const [previewName, setPreviewName] = useState('');

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

  const clearPreview = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setPreviewConfig(null);
    setPreviewName('');
  };

  useEffect(() => () => clearPreview(), []);

  const finishConvertResponse = async (resp, fallbackFileName, outFormat) => {
    if (!resp.ok) {
      const err = await resp.json().catch(() => null);
      throw new Error(err?.message || err?.error || `转换失败 (${resp.status})`);
    }

    const blob = await resp.blob();
    const buf = await blob.arrayBuffer();
    const dispo = resp.headers.get('content-disposition');
    const fallbackName = `${(fallbackFileName || 'asset').replace(/\.zip$/i, '')}.${outFormat}`;
    const filename = guessFilenameFromDisposition(dispo, fallbackName);

    let vapcRaw = null;
    const vapcHeader = resp.headers.get('x-vapc-config');
    if (vapcHeader) {
      try {
        vapcRaw = JSON.parse(atob(vapcHeader));
      } catch {
        vapcRaw = null;
      }
    }
    if (outFormat === 'vap' && !vapcRaw) {
      try {
        vapcRaw = parseVapcFromArrayBuffer(buf);
      } catch {
        vapcRaw = null;
      }
    }

    const fileBlob = new Blob([buf], { type: blob.type || 'application/octet-stream' });
    const downloadUrl = URL.createObjectURL(fileBlob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();

    if (outFormat === 'vap' && vapcRaw) {
      setPreviewUrl(URL.createObjectURL(fileBlob));
      setPreviewConfig(vapcRaw);
      setPreviewName(filename);
    } else {
      URL.revokeObjectURL(downloadUrl);
    }
  };

  const savePendingTask = (payload) => {
    window.sessionStorage.setItem(PENDING_TASK_KEY, JSON.stringify(payload));
    setPendingTask(payload);
  };

  const clearPendingTask = () => {
    window.sessionStorage.removeItem(PENDING_TASK_KEY);
    setPendingTask(null);
  };

  const abandonPendingTask = async () => {
    const url = pendingTask?.blobUrl;
    clearPendingTask();
    if (url) {
      try {
        await releaseTempBlob(url);
        message.success('已放弃任务并释放云端临时文件');
      } catch (e) {
        message.warning(`任务已清除，云端文件可能需等待定时清理：${e?.message || e}`);
      }
    } else {
      message.info('已清除本地任务记录');
    }
  };

  const runConvertRequest = async (payload, fallbackFileName) => {
    setStage('converting');
    clearPreview();

    const resp = await fetch('/api/asset-convert', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    await finishConvertResponse(resp, fallbackFileName, payload.format);
    clearPendingTask();
  };

  const runDirectConvert = async (file, fallbackFileName) => {
    setStage('converting');
    clearPreview();

    const fd = new FormData();
    fd.append('file', file);
    fd.append('format', format);
    fd.append('fit', fit);
    fd.append('fps', String(fps ?? 30));
    fd.append('pack', pack);
    if (width) fd.append('width', String(width));
    if (height) fd.append('height', String(height));
    fd.append('filename', fallbackFileName || file.name);

    const resp = await fetch('/api/asset-convert', { method: 'POST', body: fd });
    await finishConvertResponse(resp, fallbackFileName, format);
  };

  const onConvert = async () => {
    const f = fileList?.[0]?.originFileObj ?? null;
    if (!f) {
      message.error('请先上传一个 zip 压缩包');
      return;
    }
    if (f.size > ASSET_ZIP_MAX_BYTES) {
      message.error(`压缩包不能超过 ${formatBytes(ASSET_ZIP_MAX_BYTES)}（当前 ${formatBytes(f.size)}）`);
      return;
    }
    setLoading(true);
    /** @type {string | null} */
    let stagedBlobUrl = null;
    let reachedConvert = false;
    try {
      await assertLocalZipFile(f);

      if (f.size < BLOB_MULTIPART_THRESHOLD_BYTES) {
        await runDirectConvert(f, f.name);
      } else {
        if (pendingTask?.blobUrl) {
          await releaseTempBlob(pendingTask.blobUrl).catch(() => {});
          clearPendingTask();
        }

        setStage('uploading');
        const blobPathname = safeZipBlobPathname(f.name);
        const uploaded = await upload(blobPathname, f, {
          access: 'public',
          handleUploadUrl: '/api/blob/upload',
          multipart: true,
          contentType: 'application/zip',
          onUploadProgress: (e) => {
            if (e.total > 0) {
              const pct = Math.round((e.loaded / e.total) * 100);
              setStage(`uploading:${pct}`);
            }
          },
        });

        stagedBlobUrl = uploaded.downloadUrl || uploaded.url;
        const payload = {
          blobUrl: stagedBlobUrl,
          filename: f.name,
          expectedBytes: f.size,
          format,
          fit,
          fps: Number(fps ?? 30),
          width: width || null,
          height: height || null,
          pack,
        };

        savePendingTask(payload);
        reachedConvert = true;
        await runConvertRequest(payload, f.name);
      }
      message.success('已生成并开始下载');
    } catch (e) {
      if (!reachedConvert) {
        clearPendingTask();
        if (stagedBlobUrl) {
          await releaseTempBlob(stagedBlobUrl).catch(() => {});
        }
      }
      const errMsg = e?.message || '转换失败';
      if (/storage quota|BLOB_QUOTA|quota exceeded/i.test(errMsg)) {
        message.error(
          `${errMsg} 临时 ZIP 会在转换后自动删除；请稍后重试，或在 Vercel 控制台清理 Blob 存储（asset-seq/）。`,
          10,
        );
      } else if (/maximumSize|文件过大|413|failed|upload/i.test(errMsg)) {
        message.error(
          `上传失败：${errMsg}。大于 ${formatBytes(BLOB_MULTIPART_THRESHOLD_BYTES)} 将走 Blob 分片；单文件上限 ${formatBytes(ASSET_ZIP_MAX_BYTES)}。`,
          8,
        );
      } else if (reachedConvert) {
        message.error(`${errMsg}。可点击「继续转换」重试（无需重新上传）`, 12);
      } else {
        message.error(errMsg);
      }
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
    const resumeUrl = pendingTask.blobUrl;
    try {
      await runConvertRequest(pendingTask, pendingTask.filename);
      message.success('已恢复并完成下载');
    } catch (e) {
      message.error(e?.message || '恢复任务失败。若提示 Blob 404 请重新上传 ZIP', 10);
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
            description={`文件：${pendingTask.filename || 'asset.zip'}。上传已完成，可继续转换；若不再需要请放弃以释放 Blob 配额。`}
            action={
              <Space>
                <Button size='small' type='primary' onClick={onResumePending} loading={loading}>
                  继续转换
                </Button>
                <Button size='small' onClick={abandonPendingTask} disabled={loading}>
                  放弃并释放
                </Button>
              </Space>
            }
          />
        ) : null}

        {loading ? (
          <Alert
            type='info'
            showIcon
            title={
              stage.startsWith('uploading')
                ? stage.includes(':')
                  ? `正在分片上传到 Blob（${stage.split(':')[1]}%）…`
                  : '正在上传到 Blob…'
                : '正在服务端转换，请勿刷新页面…'
            }
          />
        ) : null}

        <Upload.Dragger
          multiple={false}
          accept='.zip,application/zip,application/x-zip-compressed'
          fileList={fileList}
          beforeUpload={() => false}
          onChange={async (info) => {
            const latest = info.fileList.slice(-1);
            const raw = latest[0]?.originFileObj;
            if (!raw) {
              setFileList([]);
              return;
            }
            try {
              await assertLocalZipFile(raw);
              setFileList(latest);
            } catch (e) {
              setFileList([]);
              message.error(e?.message || '不是有效的 ZIP 文件');
            }
          }}
        >
          <p className='ant-upload-drag-icon'>
            <InboxOutlined />
          </p>
          <p className='ant-upload-text'>拖拽或点击上传 ZIP（内含序列帧图片）</p>
          <p className='ant-upload-hint'>
            请上传<strong>标准 ZIP</strong>（对「序列帧文件夹」右键压缩，勿含 __MACOSX / ._ 文件，勿用 RAR/7z/分卷）。
            内含 png/jpg/webp，按文件名排序；mp3/m4a 等需与序列帧放在<strong>同一文件夹</strong>内（同级）才会自动合成。
            服务端 /tmp 约 512MB：建议单任务 ≤300 帧，或输出边长 ≤720；过大请降分辨率或拆包。
            小于 {formatBytes(BLOB_MULTIPART_THRESHOLD_BYTES)} 直传转换不占 Blob；更大文件走 Blob 分片（转换后自动删除）。最大{' '}
            {formatBytes(ASSET_ZIP_MAX_BYTES)}。
          </p>
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
                  style={{ width: 220 }}
                  options={[
                    { value: 'right', label: '左右拼接（推荐 · 腾讯 VAP 标准）' },
                    { value: 'right-small', label: '左大右小（右上主 Alpha + 右下融合区）' },
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

        {format === 'vap' && previewUrl && previewConfig ? (
          <VapWebglPreview
            srcUrl={previewUrl}
            vapConfig={previewConfig}
            label={`转换结果预览 · ${previewName}`}
          />
        ) : null}
      </Space>
    </Card>
  );
}

