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

// ─── WebGL shader source ───────────────────────────────────────────────────────
const VS_SRC = `
  attribute vec2 a_pos;
  attribute vec2 a_uv;
  varying vec2 v_uv;
  void main() {
    gl_Position = vec4(a_pos, 0.0, 1.0);
    v_uv = a_uv;
  }
`;

// Fragment shader: sample rgb area and alpha area from the same video texture.
// u_useAlpha = 1.0 → composite alpha channel; 0.0 → fully opaque (no vapc).
const FS_SRC = `
  precision mediump float;
  uniform sampler2D u_tex;
  uniform vec2 u_videoSize;
  uniform vec4 u_rgb;      // x, y, w, h in pixels
  uniform vec4 u_alpha;    // x, y, w, h in pixels
  uniform float u_useAlpha; // 1.0 = composite alpha, 0.0 = fully opaque
  varying vec2 v_uv;
  void main() {
    vec2 rgbUv = vec2(
      (u_rgb.x + v_uv.x * u_rgb.z) / u_videoSize.x,
      (u_rgb.y + v_uv.y * u_rgb.w) / u_videoSize.y
    );
    vec2 alphaUv = vec2(
      (u_alpha.x + v_uv.x * u_alpha.z) / u_videoSize.x,
      (u_alpha.y + v_uv.y * u_alpha.w) / u_videoSize.y
    );
    vec4 rgb = texture2D(u_tex, rgbUv);
    vec4 a   = texture2D(u_tex, alphaUv);
    float alpha = mix(1.0, a.r, u_useAlpha);
    gl_FragColor = vec4(rgb.rgb, alpha);
  }
`;

function compileShader(gl, type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  return s;
}

// ─── useVapPlayer hook ─────────────────────────────────────────────────────────
function useVapPlayer(canvasRef) {
  const glRef      = useRef(null);
  const progRef    = useRef(null);
  const texRef     = useRef(null);
  const videoRef   = useRef(null);
  const rafRef     = useRef(null);
  const configRef  = useRef(null);

  const [playing, setPlaying]   = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [hasAlpha, setHasAlpha] = useState(false);

  const initGL = useCallback((canvas) => {
    const gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: false });
    if (!gl) return;

    const prog = gl.createProgram();
    gl.attachShader(prog, compileShader(gl, gl.VERTEX_SHADER,   VS_SRC));
    gl.attachShader(prog, compileShader(gl, gl.FRAGMENT_SHADER, FS_SRC));
    gl.linkProgram(prog);
    gl.useProgram(prog);

    // Full-screen quad: two triangles as TRIANGLE_STRIP
    const posBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(prog, 'a_pos');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    const uvBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, uvBuf);
    // UV flipped on Y for WebGL texture orientation
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0,1, 1,1, 0,0, 1,0]), gl.STATIC_DRAW);
    const aUv = gl.getAttribLocation(prog, 'a_uv');
    gl.enableVertexAttribArray(aUv);
    gl.vertexAttribPointer(aUv, 2, gl.FLOAT, false, 0, 0);

    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    glRef.current   = gl;
    progRef.current = prog;
    texRef.current  = tex;
  }, []);

  const drawFrame = useCallback((video) => {
    const gl = glRef.current;
    if (!gl) return;

    const vw = video.videoWidth;
    const vh = video.videoHeight;
    if (!vw || !vh) return;

    const cfg  = configRef.current;
    const info = cfg?.info;

    // Resolve layout — fall back to full-frame when no vapc info
    let rl, al, dw, dh, videoW, videoH, useAlpha;
    if (info?.rgbLayout && info?.aLayout) {
      rl      = info.rgbLayout;
      al      = info.aLayout;
      dw      = info.w      || vw;
      dh      = info.h      || vh;
      videoW  = info.videoW || vw;
      videoH  = info.videoH || vh;
      useAlpha = 1.0;
    } else {
      // No vapc: render the full frame without alpha compositing
      dw = vw; dh = vh; videoW = vw; videoH = vh;
      rl = { x: 0, y: 0, w: vw, h: vh };
      al = { x: 0, y: 0, w: vw, h: vh };
      useAlpha = 0.0;
    }

    // Resize canvas only when dimensions change
    if (gl.canvas.width !== dw || gl.canvas.height !== dh) {
      gl.canvas.width  = dw;
      gl.canvas.height = dh;
      gl.viewport(0, 0, dw, dh);
    }

    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.bindTexture(gl.TEXTURE_2D, texRef.current);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);

    const prog = progRef.current;
    gl.uniform2f(gl.getUniformLocation(prog, 'u_videoSize'), videoW, videoH);
    gl.uniform4f(gl.getUniformLocation(prog, 'u_rgb'),   rl.x, rl.y, rl.w, rl.h);
    gl.uniform4f(gl.getUniformLocation(prog, 'u_alpha'), al.x, al.y, al.w, al.h);
    gl.uniform1f(gl.getUniformLocation(prog, 'u_useAlpha'), useAlpha);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }, []);

  const animLoop = useCallback(() => {
    const v = videoRef.current;
    // Draw whenever the video has data — covers paused first-frame and playback
    if (v && v.readyState >= 2) {
      drawFrame(v);
    }
    rafRef.current = requestAnimationFrame(animLoop);
  }, [drawFrame]);

  const load = useCallback((srcUrl, config) => {
    // Cleanup previous
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.src = '';
    }
    setPlaying(false);

    configRef.current = config;
    const info = config?.info ?? {};
    setHasAlpha(!!(info.aLayout && info.rgbLayout));

    const vid = document.createElement('video');
    vid.src         = srcUrl;
    vid.loop        = true;
    vid.muted       = true;
    vid.playsInline = true;
    vid.crossOrigin = 'anonymous';
    // Seek to frame 0 so the first frame is available immediately
    vid.currentTime = 0;
    videoRef.current = vid;

    const tryInitGL = () => {
      const canvas = canvasRef.current;
      if (canvas && !glRef.current) {
        initGL(canvas);
      }
    };

    vid.addEventListener('loadedmetadata', () => {
      setDuration(vid.duration);
      tryInitGL();
    });

    // canLoadThrough fires later — ensures first frame pixel data is available
    vid.addEventListener('canplay', () => {
      tryInitGL();
      // Force one draw of the first frame even while paused
      if (videoRef.current) drawFrame(videoRef.current);
    });

    vid.addEventListener('timeupdate', () => setCurrentTime(vid.currentTime));
    vid.addEventListener('ended', () => setPlaying(false));

    // Start animation loop — it will draw as soon as readyState >= 2
    rafRef.current = requestAnimationFrame(animLoop);
  }, [canvasRef, initGL, animLoop, drawFrame]);

  const play  = useCallback(() => { videoRef.current?.play();  setPlaying(true);  }, []);
  const pause = useCallback(() => { videoRef.current?.pause(); setPlaying(false); }, []);
  const seekTo = useCallback((t) => { if (videoRef.current) videoRef.current.currentTime = t; }, []);

  const destroy = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (videoRef.current) { videoRef.current.pause(); videoRef.current.src = ''; }
    setPlaying(false);
  }, []);

  return { playing, duration, currentTime, hasAlpha, load, play, pause, seekTo, destroy };
}

// ─── Context ───────────────────────────────────────────────────────────────────
const VapContext = createContext(null);

// ─── VapProvider ───────────────────────────────────────────────────────────────
export function VapProvider({ children }) {
  const canvasRef = useRef(null);
  const player    = useVapPlayer(canvasRef);

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
        player.load(url, json.config);
      } else {
        // No vapc — still load video for preview
        message.warning(json.error || '无法解析 vapc 配置，将以原始视频模式预览');
        player.load(url, null);
      }
    } catch (e) {
      message.error('解析 VAP 失败: ' + e.message);
      player.load(url, null);
    } finally {
      setLoadingInfo(false);
    }
  }, [vapUrl, player]);

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
    canvasRef, player,
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
    canvasRef, player,
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
    canvasRef, player,
    vapFile, vapUrl, vapConfig,
    loadingInfo, handleFile,
  } = useContext(VapContext);

  const { playing, duration, currentTime, hasAlpha, play, pause } = player;

  const beforeUpload = useCallback((file) => {
    handleFile(file);
    return false;
  }, [handleFile]);

  const fmtTime = (t) => {
    const m = Math.floor(t / 60);
    const s = (t % 60).toFixed(1).padStart(4, '0');
    return `${m}:${s}`;
  };

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

      {/* Canvas preview — always rendered once vapUrl is set so canvasRef mounts */}
      {vapUrl && (
        <div className="flex flex-col items-center gap-3">
          <div
            className="relative overflow-hidden rounded-xl border border-slate-200"
            style={{
              // Only show checkerboard when alpha compositing is active
              background: hasAlpha
                ? 'repeating-conic-gradient(#e2e8f0 0% 25%, #f8fafd 0% 50%) 0 0 / 16px 16px'
                : '#000',
              maxWidth: '100%',
            }}
          >
            <canvas
              ref={canvasRef}
              style={{ display: 'block', maxWidth: '100%', maxHeight: 480 }}
            />
          </div>

          {/* Controls */}
          <div className="flex items-center gap-3">
            <Button
              type="primary"
              shape="circle"
              icon={playing ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
              onClick={playing ? pause : play}
            />
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
        <Alert type="info" message="上传 VAP 文件后显示配置信息" showIcon />
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
