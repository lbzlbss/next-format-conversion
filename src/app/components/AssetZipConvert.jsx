'use client';

import { useEffect, useMemo, useState } from 'react';
import { Alert, Card, Upload, Button, Select, InputNumber, Space, Tag, message } from 'antd';
import { InboxOutlined, DownloadOutlined } from '@ant-design/icons';
import { upload } from '@vercel/blob/client';
import VapWebglPreview from './home/VapWebglPreview';
import { parseVapcFromArrayBuffer } from '../lib/vap-mp4-client';
import {
  ASSET_ZIP_MAX_BYTES,
  BLOB_MULTIPART_THRESHOLD_BYTES,
  safeAudioBlobPathname,
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
  const [audioFile, setAudioFile] = useState(null);
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

  const runConvertRequest = async (payload, fallbackFileName) => {
    setStage('converting');
    window.sessionStorage.setItem(PENDING_TASK_KEY, JSON.stringify(payload));
    setPendingTask(payload);
    clearPreview();

    const resp = await fetch('/api/asset-convert', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    await finishConvertResponse(resp, fallbackFileName, payload.format);

    window.sessionStorage.removeItem(PENDING_TASK_KEY);
    setPendingTask(null);
  };

  const runDirectConvert = async (file, fallbackFileName) => {
    setStage('converting');
    clearPreview();

    const fd = new FormData();
    fd.append('file', file);
    if (audioFile) fd.append('audio', audioFile);
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
    try {
      await assertLocalZipFile(f);

      if (f.size < BLOB_MULTIPART_THRESHOLD_BYTES) {
        await runDirectConvert(f, f.name);
      } else {
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

        const payload = {
          blobUrl: uploaded.downloadUrl || uploaded.url,
          filename: f.name,
          expectedBytes: f.size,
          format,
          fit,
          fps: Number(fps ?? 30),
          width: width || null,
          height: height || null,
          pack,
        };

        if (audioFile) {
          const audioPathname = safeAudioBlobPathname(audioFile.name);
          const audioUploaded = await upload(audioPathname, audioFile, {
            access: 'public',
            handleUploadUrl: '/api/blob/upload',
            multipart: audioFile.size >= BLOB_MULTIPART_THRESHOLD_BYTES,
            contentType: audioFile.type || 'application/octet-stream',
          });
          payload.audioUrl = audioUploaded.downloadUrl || audioUploaded.url;
          payload.audioExpectedBytes = audioFile.size;
          payload.audioName = audioFile.name;
        }

        await runConvertRequest(payload, f.name);
      }
      message.success('已生成并开始下载');
    } catch (e) {
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
            内含 png/jpg/webp，按文件名排序，建议 ≤500 帧。大 ZIP 转换占用云端临时盘（约 512MB），帧数过多可能失败。
            小于 {formatBytes(BLOB_MULTIPART_THRESHOLD_BYTES)} 直传转换不占 Blob；更大文件走 Blob 分片（转换后自动删除）。最大{' '}
            {formatBytes(ASSET_ZIP_MAX_BYTES)}。
          </p>
        </Upload.Dragger>

        <Upload
          multiple={false}
          accept='.mp3,.m4a,.aac,.wav,.ogg,audio/*'
          showUploadList={audioFile ? [{ uid: 'audio', name: audioFile.name }] : false}
          beforeUpload={() => false}
          onChange={(info) => {
            const raw = info.fileList?.[0]?.originFileObj ?? null;
            setAudioFile(raw);
          }}
        >
          <Button disabled={loading}>选择可选音频（将合成到输出）</Button>
        </Upload>

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
                    { value: 'right-small', label: '左大右小（Alpha 右侧更窄）' },
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

