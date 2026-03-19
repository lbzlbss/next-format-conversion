'use client';

import {
  useState,
  useRef,
  useEffect,
  useCallback,
  createContext,
  useContext,
  useMemo,
} from 'react';
import {
  Upload,
  Button,
  Card,
  Tabs,
  Slider,
  Select,
  InputNumber,
  Tag,
  message,
  Spin,
  Descriptions,
  Alert,
} from 'antd';
import {
  InboxOutlined,
  DownloadOutlined,
  PlayCircleOutlined,
  PauseCircleOutlined,
  InfoCircleOutlined,
  ExperimentOutlined,
  RetweetOutlined,
} from '@ant-design/icons';

// ─── useVapCanvasPlayer hook (2D canvas compositing) ───────────────────────────
function useVapCanvasPlayer(videoElRef, beforeCanvasRef, canvasRef) {
  const rafRef     = useRef(null);
  const configRef  = useRef(null);
  const offRgbRef  = useRef(null);
  const offARef    = useRef(null);
  const beforeModeRef = useRef('raw'); // 'raw' | 'rgb'
  const cleanupRef = useRef(null);
  const didSeekRef = useRef(false);

  const [playing, setPlaying]   = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [hasAlpha, setHasAlpha] = useState(false);
  const [canPlay, setCanPlay] = useState(false);
  const [debug, setDebug] = useState({
    readyState: 0,
    networkState: 0,
    paused: true,
    ended: false,
    error: null,
    lastEvent: '',
  });

  const ensureOffscreen = useCallback((w, h) => {
    if (!offRgbRef.current) offRgbRef.current = document.createElement('canvas');
    if (!offARef.current) offARef.current = document.createElement('canvas');
    const rgbC = offRgbRef.current;
    const aC = offARef.current;
    if (rgbC.width !== w || rgbC.height !== h) {
      rgbC.width = w;
      rgbC.height = h;
    }
    if (aC.width !== w || aC.height !== h) {
      aC.width = w;
      aC.height = h;
    }
    return { rgbC, aC };
  }, []);

  const drawFrame2d = useCallback(() => {
    const video = videoElRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    if (video.readyState < 2) return;

    const vw = video.videoWidth;
    const vh = video.videoHeight;
    if (!vw || !vh) return;

    const cfg = configRef.current;
    const info = cfg?.info;

    const normRect = (r) => {
      if (!r) return null;
      // Support array form: [x, y, w, h]
      if (Array.isArray(r) && r.length >= 4) {
        const x = Number(r[0] ?? 0);
        const y = Number(r[1] ?? 0);
        const w = Number(r[2] ?? 0);
        const h = Number(r[3] ?? 0);
        if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(w) || !Number.isFinite(h)) return null;
        return { x, y, w, h };
      }
      const x = Number(r.x ?? 0);
      const y = Number(r.y ?? 0);
      const w = Number(r.w ?? r.width ?? 0);
      const h = Number(r.h ?? r.height ?? 0);
      if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(w) || !Number.isFinite(h)) return null;
      return { x, y, w, h };
    };

    const normInfoWH = (v, fallback) => {
      const n = Number(v);
      return Number.isFinite(n) && n > 0 ? n : fallback;
    };

    // Resolve output size and layout
    const videoW = normInfoWH(info?.videoW, vw);
    const videoH = normInfoWH(info?.videoH, vh);
    const displayW = normInfoWH(info?.w, Math.floor(videoW / 2));
    const displayH = normInfoWH(info?.h, videoH);

    const rl0 = normRect(info?.rgbLayout ?? info?.rgbFrame);
    const al0 = normRect(info?.aLayout ?? info?.aFrame);
    const halfW = Math.floor(videoW / 2);
    const rl = rl0 ?? { x: 0, y: 0, w: halfW, h: videoH };
    const al = al0 ?? { x: halfW, y: 0, w: halfW, h: videoH };
    const hasVapcLayout = !!(rl && al);

    const outW = hasVapcLayout ? displayW : vw;
    const outH = hasVapcLayout ? displayH : vh;

    // 1) 合成后（canvasRef）：无 vapc 就直接画原始帧；有 vapc 就合成 RGBA
    if (canvas.width !== outW || canvas.height !== outH) {
      canvas.width = outW;
      canvas.height = outH;
    }
    const ctx = canvas.getContext('2d', { alpha: true, willReadFrequently: true });
    if (!ctx) return;
    ctx.clearRect(0, 0, outW, outH);

    if (!hasVapcLayout) {
      ctx.drawImage(video, 0, 0, vw, vh, 0, 0, outW, outH);
    } else {
      const { rgbC, aC } = ensureOffscreen(outW, outH);
      const rgbCtx = rgbC.getContext('2d', { alpha: true, willReadFrequently: true });
      const aCtx = aC.getContext('2d', { alpha: true, willReadFrequently: true });
      if (!rgbCtx || !aCtx) return;

      rgbCtx.clearRect(0, 0, outW, outH);
      aCtx.clearRect(0, 0, outW, outH);
      rgbCtx.drawImage(video, rl.x, rl.y, rl.w, rl.h, 0, 0, outW, outH);
      aCtx.drawImage(video, al.x, al.y, al.w, al.h, 0, 0, outW, outH);

      const rgbImg = rgbCtx.getImageData(0, 0, outW, outH);
      const aImg = aCtx.getImageData(0, 0, outW, outH);
      const rgbData = rgbImg.data;
      const aData = aImg.data;
      for (let i = 0; i < rgbData.length; i += 4) {
        rgbData[i + 3] = aData[i]; // grayscale alpha in R channel
      }
      ctx.putImageData(rgbImg, 0, 0);
    }

    // 2) 合成前仅 RGB（beforeCanvasRef）：当 mode=rgb 且 vapc layout 存在时绘制
    const beforeMode = beforeModeRef.current;
    const beforeCanvas = beforeCanvasRef.current;
    if (beforeCanvas && beforeMode === 'rgb' && hasVapcLayout) {
      if (beforeCanvas.width !== outW || beforeCanvas.height !== outH) {
        beforeCanvas.width = outW;
        beforeCanvas.height = outH;
      }
      const bctx = beforeCanvas.getContext('2d', { alpha: true });
      if (!bctx) return;
      bctx.clearRect(0, 0, outW, outH);
      bctx.drawImage(video, rl.x, rl.y, rl.w, rl.h, 0, 0, outW, outH);
    }
  }, [canvasRef, ensureOffscreen, videoElRef]);

  const animLoop = useCallback(() => {
    drawFrame2d();
    rafRef.current = requestAnimationFrame(animLoop);
  }, [drawFrame2d]);

  const load = useCallback((srcUrl, config) => {
    // cleanup previous listeners
    if (cleanupRef.current) {
      try { cleanupRef.current(); } catch (_) {}
      cleanupRef.current = null;
    }
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    setPlaying(false);
    setCanPlay(false);
    didSeekRef.current = false;

    configRef.current = config;
    const info = config?.info ?? {};
    setHasAlpha(!!((info.aLayout && info.rgbLayout) || (info.aFrame && info.rgbFrame)));

    const vid = videoElRef.current;
    if (!vid) return;

    // Attach src to the visible <video> element
    if (vid.src !== srcUrl) vid.src = srcUrl;
    vid.loop = true;
    vid.muted = true;
    vid.playsInline = true;
    vid.crossOrigin = 'anonymous';
    vid.preload = 'auto';

    setDebug((d) => ({
      ...d,
      readyState: vid.readyState,
      networkState: vid.networkState,
      paused: vid.paused,
      ended: vid.ended,
      error: vid.error ? { code: vid.error.code, message: vid.error.message } : null,
      lastEvent: 'load()',
    }));

    // Ensure the new src is actually loaded (esp. on Safari / after src switch)
    try {
      vid.load();
    } catch (_) {}

    const onLoadedMeta = () => setDuration(Number.isFinite(vid.duration) ? vid.duration : 0);
    const onCanPlay = () => {
      setCanPlay(true);
      // Only seek once after a fresh load; repeated canplay during playback would rewind.
      if (!didSeekRef.current) {
        didSeekRef.current = true;
        try {
          vid.currentTime = 0;
        } catch (_) {}
      }
      drawFrame2d();
    };
    const onTimeUpdate = () => setCurrentTime(vid.currentTime);
    const onEnded = () => setPlaying(false);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onError = () => {
      setCanPlay(false);
      setDebug({
        readyState: vid.readyState,
        networkState: vid.networkState,
        paused: vid.paused,
        ended: vid.ended,
        error: vid.error ? { code: vid.error.code, message: vid.error.message } : null,
        lastEvent: 'error',
      });
    };
    const mkDebugEvent = (name) => () => {
      setDebug({
        readyState: vid.readyState,
        networkState: vid.networkState,
        paused: vid.paused,
        ended: vid.ended,
        error: vid.error ? { code: vid.error.code, message: vid.error.message } : null,
        lastEvent: name,
      });
    };
    const onWaiting = mkDebugEvent('waiting');
    const onStalled = mkDebugEvent('stalled');
    const onSuspend = mkDebugEvent('suspend');
    const onLoadedData = () => {
      // loadeddata implies HAVE_CURRENT_DATA
      setCanPlay(vid.readyState >= 2);
    };
    const onCanPlayThrough = () => {
      setCanPlay(true);
    };

    vid.addEventListener('loadedmetadata', onLoadedMeta);
    vid.addEventListener('canplay', onCanPlay);
    vid.addEventListener('timeupdate', onTimeUpdate);
    vid.addEventListener('ended', onEnded);
    vid.addEventListener('play', onPlay);
    vid.addEventListener('pause', onPause);
    vid.addEventListener('error', onError);
    vid.addEventListener('waiting', onWaiting);
    vid.addEventListener('stalled', onStalled);
    vid.addEventListener('suspend', onSuspend);
    vid.addEventListener('loadeddata', onLoadedData);
    vid.addEventListener('canplaythrough', onCanPlayThrough);

    rafRef.current = requestAnimationFrame(animLoop);

    // Cleanup listeners on next load
    cleanupRef.current = () => {
      vid.removeEventListener('loadedmetadata', onLoadedMeta);
      vid.removeEventListener('canplay', onCanPlay);
      vid.removeEventListener('timeupdate', onTimeUpdate);
      vid.removeEventListener('ended', onEnded);
      vid.removeEventListener('play', onPlay);
      vid.removeEventListener('pause', onPause);
      vid.removeEventListener('error', onError);
      vid.removeEventListener('waiting', onWaiting);
      vid.removeEventListener('stalled', onStalled);
      vid.removeEventListener('suspend', onSuspend);
      vid.removeEventListener('loadeddata', onLoadedData);
      vid.removeEventListener('canplaythrough', onCanPlayThrough);
    };
  }, [animLoop, drawFrame2d, videoElRef]);

  const play = useCallback(() => {
    const v = videoElRef.current;
    if (!v) return;
    if (!v.src) {
      message.warning('视频未加载完成，请重新上传或稍等');
      return;
    }
    if (v.readyState < 2) {
      // Not ready yet — UI will show disabled, but keep a safe guard here.
      return;
    }

    const doPlay = () => {
      try {
        const p = v.play();
        if (p && typeof p.then === 'function') {
          p.catch((e) => {
            console.error('[vap player] video.play() failed', e);
            message.error(`播放失败：${e?.message || e || 'unknown error'}`);
          });
        }
      } catch (e) {
        console.error('[vap player] video.play() threw', e);
        message.error(`播放失败：${e?.message || e || 'unknown error'}`);
      }
    };

    // If not ready, wait for canplay once, then play.
    if (v.readyState < 2) {
      const onReadyOnce = () => {
        v.removeEventListener('canplay', onReadyOnce);
        v.removeEventListener('canplaythrough', onReadyOnce);
        doPlay();
      };
      // Some browsers may fire canplaythrough without firing canplay reliably
      v.addEventListener('canplay', onReadyOnce);
      v.addEventListener('canplaythrough', onReadyOnce);
      try {
        v.load();
      } catch (_) {}
      return;
    }

    doPlay();
  }, [videoElRef]);

  const pause = useCallback(() => {
    const v = videoElRef.current;
    if (!v) return;
    v.pause();
    setPlaying(false);
  }, [videoElRef]);

  const seekTo = useCallback((t) => {
    const v = videoElRef.current;
    if (!v) return;
    v.currentTime = t;
    drawFrame2d();
  }, [drawFrame2d, videoElRef]);

  const destroy = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (cleanupRef.current) {
      try { cleanupRef.current(); } catch (_) {}
      cleanupRef.current = null;
    }
    const v = videoElRef.current;
    if (v) {
      v.pause();
      v.src = '';
    }
    setPlaying(false);
  }, [videoElRef]);

  const setBeforeMode = useCallback((mode) => {
    beforeModeRef.current = mode === 'rgb' ? 'rgb' : 'raw';
  }, []);

  return { playing, duration, currentTime, hasAlpha, canPlay, debug, load, play, pause, seekTo, destroy, setBeforeMode };
}

// ─── Context ───────────────────────────────────────────────────────────────────
const VapContext = createContext(null);

// ─── VapProvider ───────────────────────────────────────────────────────────────
export function VapProvider({ children }) {
  const canvasRef = useRef(null);
  const videoRef = useRef(null);
  const beforeCanvasRef = useRef(null);
  const player    = useVapCanvasPlayer(videoRef, beforeCanvasRef, canvasRef);

  const [vapFile,    setVapFile]    = useState(null);   // File object
  const [vapUrl,     setVapUrl]     = useState(null);   // object URL
  const [vapConfig,  setVapConfig]  = useState(null);   // parsed vapc
  const [loadingInfo, setLoadingInfo] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [action,  setAction]  = useState('resize');     // resize | vap-to-svga

  // Settings
  const [scaleX,    setScaleX]    = useState(1);
  const [scaleY,    setScaleY]    = useState(1);
  const [lockScale, setLockScale] = useState(true);
  const [maxFrames, setMaxFrames] = useState(60);
  const [extractFps, setExtractFps] = useState(20);

  // SVGA→VAP
  const [svgaFile,   setSvgaFile]   = useState(null);
  const [svgaFps,    setSvgaFps]    = useState(20);
  const [svgaScaleX, setSvgaScaleX] = useState(1);
  const [svgaScaleY, setSvgaScaleY] = useState(1);

  const handleFile = useCallback(async (file) => {
    // Revoke previous URL
    if (vapUrl) URL.revokeObjectURL(vapUrl);

    const url = URL.createObjectURL(file);
    setVapFile(file);
    setVapUrl(url);
    setVapConfig(null);

    // Fetch vapc info
    setLoadingInfo(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('action', 'info');
      const res = await fetch('/api/vap', { method: 'POST', body: fd });
      const json = await res.json();
      if (json.config) {
        setVapConfig(json.config);
      } else {
        // No vapc — still load video for preview
        message.warning(json.error || '无法解析 vapc 配置，将以原始视频模式预览');
      }
    } catch (e) {
      message.error('解析 VAP 失败: ' + e.message);
    } finally {
      setLoadingInfo(false);
    }
  }, [vapUrl]);

  const handleExport = useCallback(async () => {
    if (!vapFile) return message.warning('请先上传 VAP 文件');
    setProcessing(true);
    try {
      const fd = new FormData();
      fd.append('file', vapFile);
      fd.append('action', action);

      if (action === 'resize') {
        fd.append('options', JSON.stringify({ scaleX, scaleY }));
      } else if (action === 'vap-to-svga') {
        fd.append('options', JSON.stringify({ maxFrames, fps: extractFps }));
      }

      const res = await fetch('/api/vap', { method: 'POST', body: fd });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error || '导出失败');
      }

      const blob = await res.blob();
      const ext  = action === 'vap-to-svga' ? 'svga' : 'vap';
      const filename = `${action}_${Date.now()}.${ext}`;
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      a.click();
      URL.revokeObjectURL(a.href);
      message.success('导出成功');
    } catch (e) {
      message.error('导出失败: ' + e.message);
    } finally {
      setProcessing(false);
    }
  }, [vapFile, action, scaleX, scaleY, maxFrames, extractFps]);

  const handleSvgaToVap = useCallback(async () => {
    if (!svgaFile) return message.warning('请先上传 SVGA 文件');
    setProcessing(true);
    try {
      const fd = new FormData();
      fd.append('file', svgaFile);
      fd.append('action', 'svga-to-vap');
      fd.append('options', JSON.stringify({ scaleX: svgaScaleX, scaleY: svgaScaleY, fps: svgaFps }));

      const res = await fetch('/api/vap', { method: 'POST', body: fd });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error || '转换失败');
      }

      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `svga_to_vap_${Date.now()}.vap`;
      a.click();
      URL.revokeObjectURL(a.href);
      message.success('SVGA → VAP 转换成功');
    } catch (e) {
      message.error('转换失败: ' + e.message);
    } finally {
      setProcessing(false);
    }
  }, [svgaFile, svgaScaleX, svgaScaleY, svgaFps]);

  const value = useMemo(() => ({
    canvasRef, beforeCanvasRef, videoRef, player,
    vapFile, vapUrl, vapConfig,
    loadingInfo, processing,
    action, setAction,
    scaleX, setScaleX,
    scaleY, setScaleY,
    lockScale, setLockScale,
    maxFrames, setMaxFrames,
    extractFps, setExtractFps,
    svgaFile, setSvgaFile,
    svgaFps, setSvgaFps,
    svgaScaleX, setSvgaScaleX,
    svgaScaleY, setSvgaScaleY,
    handleFile, handleExport, handleSvgaToVap,
  }), [
    canvasRef, beforeCanvasRef, videoRef, player,
    vapFile, vapUrl, vapConfig,
    loadingInfo, processing,
    action,
    scaleX, scaleY, lockScale,
    maxFrames, extractFps,
    svgaFile, svgaFps, svgaScaleX, svgaScaleY,
    handleFile, handleExport, handleSvgaToVap,
  ]);

  // Cleanup on unmount
  useEffect(() => () => {
    player.destroy();
    if (vapUrl) URL.revokeObjectURL(vapUrl);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <VapContext.Provider value={value}>{children}</VapContext.Provider>;
}

// ─── VapMain ───────────────────────────────────────────────────────────────────
export function VapMain() {
  const {
    canvasRef, beforeCanvasRef, videoRef, player,
    vapFile, vapUrl, vapConfig,
    loadingInfo, handleFile,
  } = useContext(VapContext);

  const { playing, duration, currentTime, hasAlpha, canPlay, play, pause, load, setBeforeMode } = player;
  const [showRgbOnly, setShowRgbOnly] = useState(false);
  const [debugBottom, setDebugBottom] = useState({
    readyState: 0,
    networkState: 0,
    paused: true,
    ended: false,
    currentTime: 0,
    duration: 0,
    error: null,
  });

  useEffect(() => {
    setBeforeMode(showRgbOnly ? 'rgb' : 'raw');
  }, [setBeforeMode, showRgbOnly]);

  // IMPORTANT: load the video AFTER <video> mounts, otherwise videoRef.current is null
  useEffect(() => {
    if (!vapUrl) return;
    load(vapUrl, vapConfig);
  }, [load, vapConfig, vapUrl]);

  // Bottom debug info (low-frequency snapshot; avoids UI flicker)
  useEffect(() => {
    if (!vapUrl) return;
    const tick = () => {
      const v = videoRef.current;
      if (!v) return;
      setDebugBottom({
        readyState: v.readyState,
        networkState: v.networkState,
        paused: v.paused,
        ended: v.ended,
        currentTime: Number.isFinite(v.currentTime) ? v.currentTime : 0,
        duration: Number.isFinite(v.duration) ? v.duration : 0,
        error: v.error ? { code: v.error.code, message: v.error.message } : null,
      });
    };
    tick();
    const id = window.setInterval(tick, 400);
    return () => window.clearInterval(id);
  }, [vapUrl, videoRef]);

  const beforeUpload = useCallback((file) => {
    handleFile(file);
    return false;
  }, [handleFile]);

  const fmtTime = (t) => {
    const m = Math.floor(t / 60);
    const s = (t % 60).toFixed(1).padStart(4, '0');
    return `${m}:${s}`;
  };

  const fmtReadyState = (v) => ['HAVE_NOTHING', 'HAVE_METADATA', 'HAVE_CURRENT_DATA', 'HAVE_FUTURE_DATA', 'HAVE_ENOUGH_DATA'][v] ?? String(v);
  const fmtNetworkState = (v) => ['NETWORK_EMPTY', 'NETWORK_IDLE', 'NETWORK_LOADING', 'NETWORK_NO_SOURCE'][v] ?? String(v);

  const info = vapConfig?.info;

  return (
    <div className="flex flex-col gap-4">
      {/* Upload */}
      <Upload.Dragger
        accept=".mp4,.vap"
        showUploadList={false}
        beforeUpload={beforeUpload}
        className="rounded-2xl"
      >
        <p className="ant-upload-drag-icon">
          <InboxOutlined />
        </p>
        <p className="ant-upload-text">点击或拖拽上传 VAP 文件</p>
        <p className="ant-upload-hint">支持 .vap / .mp4 格式（含 vapc box）</p>
      </Upload.Dragger>

      {/* Status */}
      {loadingInfo && (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Spin size="small" /> 解析 vapc 配置中…
        </div>
      )}

      {/* Info strip */}
      {info && (
        <div className="flex flex-wrap gap-2">
          <Tag color="blue">{info.w} × {info.h}</Tag>
          <Tag color="geekblue">{info.videoW} × {info.videoH} raw</Tag>
          <Tag color="purple">{info.f} fps</Tag>
          {hasAlpha && <Tag color="green">Alpha ✓</Tag>}
          {info.sources?.length > 0 && (
            <Tag color="orange">融合动画 ({info.sources.length})</Tag>
          )}
        </div>
      )}

      {/* Debug strip removed (was causing flicker) */}

      {/* Canvas preview — always rendered once vapUrl is set so canvasRef mounts */}
      {vapUrl && (
        <div className="flex flex-col items-center gap-3">
          {/* Before/After preview */}
          <div className="grid w-full grid-cols-1 gap-3 md:grid-cols-2">
            {/* 合成前：原始视频（包含 RGB/Alpha 拼接布局） */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <div className="text-xs text-slate-500">
                  合成前（{showRgbOnly ? '仅 RGB' : '原始视频'}）
                </div>
                <Button
                  size="small"
                  onClick={() => setShowRgbOnly((v) => !v)}
                  disabled={!hasAlpha}
                >
                  {showRgbOnly ? '看原始视频' : '只看 RGB'}
                </Button>
              </div>
              <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-black">
                <video
                  ref={videoRef}
                  style={{
                    display: showRgbOnly ? 'none' : 'block',
                    width: '100%',
                    maxHeight: 360,
                    objectFit: 'contain',
                  }}
                />
                <canvas
                  ref={beforeCanvasRef}
                  style={{
                    display: showRgbOnly ? 'block' : 'none',
                    width: '100%',
                    maxHeight: 360,
                  }}
                />
              </div>
            </div>

            {/* 合成后：canvas 合成透明通道 */}
            <div className="flex flex-col gap-2">
              <div className="text-xs text-slate-500">合成后（Canvas 透明合成）</div>
              <div
                className="relative overflow-hidden rounded-xl border border-slate-200"
                style={{
                  background: hasAlpha
                    ? 'repeating-conic-gradient(#e2e8f0 0% 25%, #f8fafd 0% 50%) 0 0 / 16px 16px'
                    : '#000',
                }}
              >
                <canvas
                  ref={canvasRef}
                  style={{ display: 'block', width: '100%', maxHeight: 360 }}
                />
              </div>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-3">
            <Button
              type="primary"
              shape="circle"
              icon={playing ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
              onClick={playing ? pause : play}
              disabled={!canPlay && !playing}
            />
            {!canPlay && !playing && (
              <span className="text-xs text-slate-400">加载中…</span>
            )}
            <span className="text-sm tabular-nums text-slate-600">
              {fmtTime(currentTime)} / {fmtTime(duration)}
            </span>
          </div>
        </div>
      )}

      {/* File name */}
      {vapFile && (
        <div className="text-xs text-slate-400 text-center">
          {vapFile.name} — {(vapFile.size / 1024).toFixed(1)} KB
        </div>
      )}

      {/* Debug at bottom */}
      {vapUrl && (
        <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
          <div className="flex flex-wrap gap-x-3 gap-y-1 font-mono">
            <span>readyState={fmtReadyState(debugBottom.readyState)}</span>
            <span>networkState={fmtNetworkState(debugBottom.networkState)}</span>
            <span>paused={String(debugBottom.paused)}</span>
            <span>ended={String(debugBottom.ended)}</span>
            <span>t={debugBottom.currentTime.toFixed(2)}/{debugBottom.duration.toFixed(2)}</span>
            {debugBottom.error && (
              <span className="text-red-600">error={String(debugBottom.error.code)} {debugBottom.error.message || ''}</span>
            )}
          </div>
          {!canPlay && (
            <div className="mt-1 text-slate-500">提示：需要等 readyState 到 HAVE_CURRENT_DATA 以上，播放键才可用。</div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── VapEditPanel ──────────────────────────────────────────────────────────────
export function VapEditPanel() {
  const {
    vapFile, vapConfig, processing,
    action, setAction,
    scaleX, setScaleX,
    scaleY, setScaleY,
    lockScale, setLockScale,
    maxFrames, setMaxFrames,
    extractFps, setExtractFps,
    svgaFile, setSvgaFile,
    svgaFps, setSvgaFps,
    svgaScaleX, setSvgaScaleX,
    svgaScaleY, setSvgaScaleY,
    handleExport, handleSvgaToVap,
  } = useContext(VapContext);

  const info = vapConfig?.info;

  const onScaleXChange = (v) => {
    setScaleX(v);
    if (lockScale) setScaleY(v);
  };

  const onScaleYChange = (v) => {
    setScaleY(v);
    if (lockScale) setScaleX(v);
  };

  const previewW = info ? Math.round(info.w  * scaleX) : '—';
  const previewH = info ? Math.round(info.h  * scaleY) : '—';

  const tabItems = [
    {
      key: 'info',
      label: <span><InfoCircleOutlined /> 文件信息</span>,
      children: vapConfig ? (
        <Descriptions column={1} size="small" bordered>
          <Descriptions.Item label="显示尺寸">{info.w} × {info.h}</Descriptions.Item>
          <Descriptions.Item label="视频尺寸">{info.videoW} × {info.videoH}</Descriptions.Item>
          <Descriptions.Item label="帧率">{info.f} fps</Descriptions.Item>
          <Descriptions.Item label="透明通道">{info.alpha ? '有' : '无'}</Descriptions.Item>
          <Descriptions.Item label="方向">{info.orien ?? 0}</Descriptions.Item>
          {info.rgbLayout && (
            <Descriptions.Item label="RGB 区域">
              {`(${info.rgbLayout.x},${info.rgbLayout.y}) ${info.rgbLayout.w}×${info.rgbLayout.h}`}
            </Descriptions.Item>
          )}
          {info.aLayout && (
            <Descriptions.Item label="Alpha 区域">
              {`(${info.aLayout.x},${info.aLayout.y}) ${info.aLayout.w}×${info.aLayout.h}`}
            </Descriptions.Item>
          )}
          {info.sources?.length > 0 && (
            <Descriptions.Item label="融合源">{info.sources.length} 个</Descriptions.Item>
          )}
        </Descriptions>
      ) : (
        <Alert type="info" title="上传 VAP 文件后显示配置信息" showIcon />
      ),
    },
    {
      key: 'resize',
      label: <span><RetweetOutlined /> 缩放导出</span>,
      children: (
        <div className="flex flex-col gap-4">
          <div>
            <div className="mb-1 text-xs font-medium text-slate-500">操作类型</div>
            <Select
              value={action}
              onChange={setAction}
              className="w-full"
              options={[
                { value: 'resize',      label: 'VAP 缩放 / 重新导出' },
                { value: 'vap-to-svga', label: 'VAP → SVGA（帧序列）' },
              ]}
            />
          </div>

          {action === 'resize' && (
            <>
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-500">水平缩放比例</span>
                  <span className="text-xs text-slate-400">{(scaleX * 100).toFixed(0)}%</span>
                </div>
                <Slider
                  min={0.1} max={4} step={0.05}
                  value={scaleX}
                  onChange={onScaleXChange}
                />
                <InputNumber
                  min={0.1} max={4} step={0.05} precision={2}
                  value={scaleX}
                  onChange={onScaleXChange}
                  className="mt-1 w-full"
                  addonAfter="×"
                />
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-500">垂直缩放比例</span>
                  <span className="text-xs text-slate-400">{(scaleY * 100).toFixed(0)}%</span>
                </div>
                <Slider
                  min={0.1} max={4} step={0.05}
                  value={scaleY}
                  onChange={onScaleYChange}
                />
                <InputNumber
                  min={0.1} max={4} step={0.05} precision={2}
                  value={scaleY}
                  onChange={onScaleYChange}
                  className="mt-1 w-full"
                  addonAfter="×"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  id="lockScale"
                  type="checkbox"
                  checked={lockScale}
                  onChange={(e) => setLockScale(e.target.checked)}
                />
                <label htmlFor="lockScale" className="text-xs text-slate-500 cursor-pointer">
                  等比缩放
                </label>
              </div>

              {info && (
                <Alert
                  type="info"
                  showIcon
                  message={`输出尺寸: ${previewW} × ${previewH}`}
                />
              )}
            </>
          )}

          {action === 'vap-to-svga' && (
            <>
              <Alert
                type="warning"
                showIcon
                message="VAP → SVGA"
                description="将从 VAP 视频中逐帧提取图像（含 alpha），并打包为 SVGA v1 格式。帧数越多导出越慢。"
              />
              <div>
                <div className="mb-1 text-xs font-medium text-slate-500">最大帧数</div>
                <Slider min={10} max={300} step={10} value={maxFrames} onChange={setMaxFrames} />
                <InputNumber
                  min={10} max={300} step={10}
                  value={maxFrames} onChange={setMaxFrames}
                  className="mt-1 w-full" addonAfter="帧"
                />
              </div>
              <div>
                <div className="mb-1 text-xs font-medium text-slate-500">提取帧率</div>
                <Select
                  value={extractFps}
                  onChange={setExtractFps}
                  className="w-full"
                  options={[
                    { value: 10, label: '10 fps' },
                    { value: 15, label: '15 fps' },
                    { value: 20, label: '20 fps' },
                    { value: 24, label: '24 fps' },
                    { value: 30, label: '30 fps' },
                  ]}
                />
              </div>
            </>
          )}

          <Button
            type="primary"
            icon={<DownloadOutlined />}
            loading={processing}
            disabled={!vapFile}
            onClick={handleExport}
            block
          >
            {processing ? '处理中…' : '导出'}
          </Button>
        </div>
      ),
    },
    {
      key: 'svga-to-vap',
      label: <span><ExperimentOutlined /> SVGA → VAP</span>,
      children: (
        <div className="flex flex-col gap-4">
          <Alert
            type="info"
            showIcon
            message="SVGA v1 → VAP"
            description="服务端逐帧合成 SVGA 精灵并编码为含 alpha 通道的 VAP(MP4) 文件。仅支持 SVGA v1（movie.spec）。"
          />

          {/* SVGA Upload */}
          <div>
            <div className="mb-1 text-xs font-medium text-slate-500">上传 SVGA 文件</div>
            <Upload
              accept=".svga"
              showUploadList={false}
              beforeUpload={(f) => { setSvgaFile(f); return false; }}
            >
              <Button icon={<DownloadOutlined />} block>
                {svgaFile ? svgaFile.name : '选择 .svga 文件'}
              </Button>
            </Upload>
            {svgaFile && (
              <div className="mt-1 text-xs text-slate-400">
                {svgaFile.name} — {(svgaFile.size / 1024).toFixed(1)} KB
              </div>
            )}
          </div>

          {/* Scale */}
          <div className="flex gap-2">
            <div className="flex-1">
              <div className="mb-1 text-xs font-medium text-slate-500">宽度缩放</div>
              <InputNumber
                min={0.1} max={4} step={0.1} precision={2}
                value={svgaScaleX} onChange={setSvgaScaleX}
                className="w-full" addonAfter="×"
              />
            </div>
            <div className="flex-1">
              <div className="mb-1 text-xs font-medium text-slate-500">高度缩放</div>
              <InputNumber
                min={0.1} max={4} step={0.1} precision={2}
                value={svgaScaleY} onChange={setSvgaScaleY}
                className="w-full" addonAfter="×"
              />
            </div>
          </div>

          {/* FPS */}
          <div>
            <div className="mb-1 text-xs font-medium text-slate-500">输出帧率</div>
            <Select
              value={svgaFps}
              onChange={setSvgaFps}
              className="w-full"
              options={[
                { value: 10, label: '10 fps' },
                { value: 15, label: '15 fps' },
                { value: 20, label: '20 fps（推荐）' },
                { value: 24, label: '24 fps' },
                { value: 30, label: '30 fps' },
              ]}
            />
          </div>

          <Button
            type="primary"
            icon={<DownloadOutlined />}
            loading={processing}
            disabled={!svgaFile}
            onClick={handleSvgaToVap}
            block
          >
            {processing ? '转换中（逐帧渲染，需要一点时间）…' : '开始转换并下载 .vap'}
          </Button>
        </div>
      ),
    },
  ];

  return (
    <Tabs
      defaultActiveKey="info"
      size="small"
      items={tabItems}
      className="vap-edit-tabs"
    />
  );
}

// ─── Default export (standalone) ──────────────────────────────────────────────
export default function VapToolInternal() {
  return (
    <VapProvider>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-[1fr_360px]">
        <Card className="rounded-2xl">
          <VapMain />
        </Card>
        <Card title="VAP 配置 & 导出" className="rounded-2xl">
          <VapEditPanel />
        </Card>
      </div>
    </VapProvider>
  );
}
