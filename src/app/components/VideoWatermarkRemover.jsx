'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Upload, Button, Card, InputNumber, Switch, message, Progress } from 'antd';
import { InboxOutlined, ScissorOutlined, ReloadOutlined } from '@ant-design/icons';

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

export default function VideoWatermarkRemover() {
  const [videoUrl, setVideoUrl] = useState('');
  const [videoFile, setVideoFile] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress] = useState(0);

  const [mask, setMask] = useState({ x: 0, y: 0, width: 140, height: 50 });
  const [useAI, setUseAI] = useState(false);
  const [smooth, setSmooth] = useState(false);
  const [keepAudio, setKeepAudio] = useState(true);
  const [maskTracks, setMaskTracks] = useState([]);

  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState(null);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  const videoMeta = useMemo(() => {
    const v = videoRef.current;
    return {
      width: v?.videoWidth || 0,
      height: v?.videoHeight || 0,
    };
  }, [videoUrl]);

  const toVideoCoord = useCallback((clientX, clientY) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const sx = rect.width > 0 ? canvas.width / rect.width : 1;
    const sy = rect.height > 0 ? canvas.height / rect.height : 1;
    return {
      x: clamp(Math.round((clientX - rect.left) * sx), 0, canvas.width),
      y: clamp(Math.round((clientY - rect.top) * sy), 0, canvas.height),
    };
  }, []);

  const drawOverlay = useCallback(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video || !video.videoWidth || !video.videoHeight) return;

    if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // dark mask layer
    ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const x = clamp(mask.x, 0, canvas.width);
    const y = clamp(mask.y, 0, canvas.height);
    const w = clamp(mask.width, 1, canvas.width - x);
    const h = clamp(mask.height, 1, canvas.height - y);

    // clear selected rect
    ctx.clearRect(x, y, w, h);

    // border
    ctx.strokeStyle = '#22c55e';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, h);

    // label
    ctx.fillStyle = 'rgba(15, 23, 42, 0.72)';
    ctx.fillRect(x, Math.max(0, y - 22), 180, 20);
    ctx.fillStyle = '#ffffff';
    ctx.font = '12px sans-serif';
    ctx.fillText(`x:${x} y:${y} w:${w} h:${h}`, x + 6, Math.max(14, y - 8));
  }, [mask]);

  useEffect(() => {
    drawOverlay();
  }, [drawOverlay]);

  useEffect(() => {
    return () => {
      if (videoUrl) URL.revokeObjectURL(videoUrl);
    };
  }, [videoUrl]);

  const resetMaskToBottomRight = useCallback(() => {
    const v = videoRef.current;
    if (!v?.videoWidth || !v?.videoHeight) return;
    const w = Math.min(180, Math.floor(v.videoWidth * 0.22));
    const h = Math.min(70, Math.floor(v.videoHeight * 0.12));
    setMask({
      x: Math.max(0, v.videoWidth - w - 12),
      y: Math.max(0, v.videoHeight - h - 12),
      width: w,
      height: h,
    });
  }, []);

  const beforeUpload = useCallback((file) => {
    if (!file.type.startsWith('video/mp4')) {
      message.error('只支持 MP4 文件');
      return Upload.LIST_IGNORE;
    }
    if (file.size > 50 * 1024 * 1024) {
      message.error('文件过大，请上传小于 50MB 的 MP4');
      return Upload.LIST_IGNORE;
    }
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    const url = URL.createObjectURL(file);
    setVideoUrl(url);
    setVideoFile(file);
    return false;
  }, [videoUrl]);

  const onLoadedMetadata = useCallback(() => {
    resetMaskToBottomRight();
    drawOverlay();
  }, [drawOverlay, resetMaskToBottomRight]);

  const onMouseDown = useCallback((e) => {
    const p = toVideoCoord(e.clientX, e.clientY);
    setDragStart(p);
    setIsDragging(true);
  }, [toVideoCoord]);

  const onMouseMove = useCallback((e) => {
    if (!isDragging || !dragStart) return;
    const p = toVideoCoord(e.clientX, e.clientY);
    setMask({
      x: Math.min(dragStart.x, p.x),
      y: Math.min(dragStart.y, p.y),
      width: Math.max(1, Math.abs(p.x - dragStart.x)),
      height: Math.max(1, Math.abs(p.y - dragStart.y)),
    });
  }, [dragStart, isDragging, toVideoCoord]);

  const onMouseUp = useCallback(() => {
    setIsDragging(false);
    setDragStart(null);
  }, []);

  const processVideo = useCallback(async () => {
    if (!videoFile) {
      message.warning('请先上传视频');
      return;
    }
    setIsProcessing(true);
    try {
      const fd = new FormData();
      fd.append('file', videoFile);
      fd.append('maskX', String(Math.round(mask.x)));
      fd.append('maskY', String(Math.round(mask.y)));
      fd.append('maskWidth', String(Math.round(mask.width)));
      fd.append('maskHeight', String(Math.round(mask.height)));
      fd.append('useAI', String(useAI));
      fd.append('smooth', String(smooth));
      fd.append('keepAudio', String(keepAudio));
      if (maskTracks.length > 0) {
        fd.append('maskTracks', JSON.stringify(maskTracks));
      }

      const res = await fetch('/api/remove-watermark', { method: 'POST', body: fd });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || err.error || '处理失败');
      }

      const blob = await res.blob();
      const outUrl = URL.createObjectURL(blob);
      setVideoUrl(outUrl);
      const a = document.createElement('a');
      const baseName = videoFile.name.replace(/\.mp4$/i, '');
      a.href = outUrl;
      a.download = `${baseName}_no_watermark.mp4`;
      a.click();
      message.success('去水印处理完成');
    } catch (e) {
      message.error(e.message || '处理失败');
    } finally {
      setIsProcessing(false);
    }
  }, [keepAudio, mask.height, mask.width, mask.x, mask.y, maskTracks, smooth, useAI, videoFile]);

  const addTrackAtCurrentTime = useCallback(() => {
    const v = videoRef.current;
    const t = Number.isFinite(v?.currentTime) ? v.currentTime : 0;
    const item = {
      start: Math.max(0, Math.floor(t)),
      end: Math.max(1, Math.floor(t) + 2),
      x: Math.round(mask.x),
      y: Math.round(mask.y),
      width: Math.max(1, Math.round(mask.width)),
      height: Math.max(1, Math.round(mask.height)),
    };
    setMaskTracks((prev) => [...prev, item]);
    message.success('已添加时间段轨迹');
  }, [mask.height, mask.width, mask.x, mask.y]);

  return (
    <div className="space-y-4">
      <Card title="上传视频">
        <Upload.Dragger accept=".mp4" showUploadList={false} beforeUpload={beforeUpload}>
          <p className="ant-upload-drag-icon"><InboxOutlined /></p>
          <p className="ant-upload-text">点击或拖拽 MP4 到此区域</p>
        </Upload.Dragger>
      </Card>

      {videoUrl && (
        <Card title="预览与框选水印">
          <div className="relative">
            <video
              ref={videoRef}
              src={videoUrl}
              controls
              className="w-full rounded-lg"
              onLoadedMetadata={onLoadedMetadata}
            />
            <canvas
              ref={canvasRef}
              className="absolute inset-0 h-full w-full rounded-lg"
              onMouseDown={onMouseDown}
              onMouseMove={onMouseMove}
              onMouseUp={onMouseUp}
              onMouseLeave={onMouseUp}
            />
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
            <InputNumber className="w-full" addonBefore="X" min={0} value={mask.x} onChange={(v) => setMask((m) => ({ ...m, x: Number(v || 0) }))} />
            <InputNumber className="w-full" addonBefore="Y" min={0} value={mask.y} onChange={(v) => setMask((m) => ({ ...m, y: Number(v || 0) }))} />
            <InputNumber className="w-full" addonBefore="宽" min={1} value={mask.width} onChange={(v) => setMask((m) => ({ ...m, width: Number(v || 1) }))} />
            <InputNumber className="w-full" addonBefore="高" min={1} value={mask.height} onChange={(v) => setMask((m) => ({ ...m, height: Number(v || 1) }))} />
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <Button icon={<ReloadOutlined />} onClick={resetMaskToBottomRight}>重置到右下角</Button>
            <Button onClick={addTrackAtCurrentTime}>按当前时间添加轨迹</Button>
            <Button onClick={() => setMaskTracks([])} disabled={maskTracks.length === 0}>清空轨迹</Button>
            <div className="text-xs text-mf-muted self-center">
              视频尺寸: {videoMeta.width} x {videoMeta.height}
            </div>
          </div>

          {maskTracks.length > 0 && (
            <div className="mt-3 space-y-2 rounded-lg border border-mf-border p-3">
              <div className="text-xs font-semibold text-mf-muted">分时段轨迹（用于移动水印）</div>
              {maskTracks.map((trk, idx) => (
                <div key={`${idx}_${trk.start}_${trk.x}`} className="grid grid-cols-4 gap-2 md:grid-cols-8">
                  <InputNumber size="small" addonBefore="S" min={0} value={trk.start} onChange={(v) => setMaskTracks((prev) => prev.map((it, i) => i === idx ? { ...it, start: Number(v || 0) } : it))} />
                  <InputNumber size="small" addonBefore="E" min={0} value={trk.end} onChange={(v) => setMaskTracks((prev) => prev.map((it, i) => i === idx ? { ...it, end: Number(v || 0) } : it))} />
                  <InputNumber size="small" addonBefore="X" min={0} value={trk.x} onChange={(v) => setMaskTracks((prev) => prev.map((it, i) => i === idx ? { ...it, x: Number(v || 0) } : it))} />
                  <InputNumber size="small" addonBefore="Y" min={0} value={trk.y} onChange={(v) => setMaskTracks((prev) => prev.map((it, i) => i === idx ? { ...it, y: Number(v || 0) } : it))} />
                  <InputNumber size="small" addonBefore="W" min={1} value={trk.width} onChange={(v) => setMaskTracks((prev) => prev.map((it, i) => i === idx ? { ...it, width: Number(v || 1) } : it))} />
                  <InputNumber size="small" addonBefore="H" min={1} value={trk.height} onChange={(v) => setMaskTracks((prev) => prev.map((it, i) => i === idx ? { ...it, height: Number(v || 1) } : it))} />
                  <Button size="small" danger onClick={() => setMaskTracks((prev) => prev.filter((_, i) => i !== idx))}>删除</Button>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {videoUrl && (
        <Card title="处理参数">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span>使用 AI 增强（ProPainter）</span>
              <Switch checked={useAI} onChange={setUseAI} />
            </div>
            <div className="flex items-center justify-between">
              <span>平滑处理（减少边缘）</span>
              <Switch checked={smooth} onChange={setSmooth} />
            </div>
            <div className="flex items-center justify-between">
              <span>保留原音频</span>
              <Switch checked={keepAudio} onChange={setKeepAudio} />
            </div>
            <div className="text-xs text-mf-muted">
              说明：当前版本在 Serverless 中使用 FFmpeg `delogo`，`useAI` 参数会透传，默认不启用独立 AI 服务。
            </div>
          </div>
        </Card>
      )}

      {videoUrl && (
        <div className="space-y-3">
          {isProcessing && <Progress percent={progress} status="active" />}
          <Button
            type="primary"
            size="large"
            icon={<ScissorOutlined />}
            loading={isProcessing}
            disabled={!videoFile}
            onClick={processVideo}
            className="w-full md:w-1/2"
          >
            {isProcessing ? '处理中...' : '开始去水印'}
          </Button>
        </div>
      )}
    </div>
  );
}
