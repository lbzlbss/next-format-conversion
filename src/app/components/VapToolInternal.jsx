'use client';

import {
  useState,
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
import { useVapWebglPlayer } from '../hooks/useVapWebglPlayer';
import { postVapApi } from '../lib/vap-api-client';
import { BLOB_CLIENT_UPLOAD_THRESHOLD_BYTES, formatBytes } from '../lib/upload-limits';

// ─── Context ───────────────────────────────────────────────────────────────────
const VapContext = createContext(null);

// ─── VapProvider ───────────────────────────────────────────────────────────────
export function VapProvider({ children }) {
  const player = useVapWebglPlayer();

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
      const res = await postVapApi({ file, action: 'info' });
      const json = await res.json();
      if (json.config) {
        setVapConfig(json.config);
      } else {
        message.warning(json.error || '无法解析 vapc 配置，WebGL 合成预览需要 vapc box');
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
      const options =
        action === 'resize'
          ? { scaleX, scaleY }
          : action === 'vap-to-svga'
            ? { maxFrames, fps: extractFps }
            : {};

      const res = await postVapApi({ file: vapFile, action, options });
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
      const res = await postVapApi({
        file: svgaFile,
        action: 'svga-to-vap',
        options: { scaleX: svgaScaleX, scaleY: svgaScaleY, fps: svgaFps },
      });
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
    player,
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
    player,
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
    player,
    vapFile, vapUrl, vapConfig,
    loadingInfo, handleFile,
  } = useContext(VapContext);

  const {
    containerRef,
    playing,
    duration,
    currentTime,
    hasAlpha,
    canPlay,
    webglSupported,
    loadError,
    play,
    pause,
    load,
  } = player;

  useEffect(() => {
    if (!vapUrl) return;
    load(vapUrl, vapConfig);
  }, [load, vapConfig, vapUrl]);

  const beforeUpload = useCallback((file) => {
    handleFile(file);
    return false;
  }, [handleFile]);

  const fmtTime = (t) => {
    const m = Math.floor(t / 60);
    const s = (t % 60).toFixed(1).padStart(4, '0');
    return `${m}:${s}`;
  };

  const info = vapConfig?.info ?? vapConfig;
  const previewW = info?.w ? Math.min(Number(info.w), 720) : undefined;

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
        <p className="ant-upload-hint">
          支持 .vap / .mp4（含 vapc）。大于 {formatBytes(BLOB_CLIENT_UPLOAD_THRESHOLD_BYTES)} 自动 Blob 直传，绕过
          Vercel 4.5MB 限制。
        </p>
      </Upload.Dragger>

      {/* Status */}
      {loadingInfo && (
        <div className="flex items-center gap-2 text-sm text-mf-muted">
          <Spin size="small" /> 解析 vapc 配置中…
        </div>
      )}

      {/* Info strip */}
      {info && (
        <div className="flex flex-wrap gap-2">
          <Tag color="blue">{info.w} × {info.h}</Tag>
          <Tag color="geekblue">{info.videoW} × {info.videoH} raw</Tag>
          <Tag color="green">{info.f} fps</Tag>
          {hasAlpha && <Tag color="green">Alpha ✓</Tag>}
          {info.sources?.length > 0 && (
            <Tag color="orange">融合动画 ({info.sources.length})</Tag>
          )}
        </div>
      )}

      {!webglSupported && vapUrl && (
        <Alert type="warning" showIcon message="当前浏览器不支持 WebGL，无法使用 VAP 合成预览" />
      )}

      {loadError && (
        <Alert type="error" showIcon message={loadError} />
      )}

      {!vapConfig && vapUrl && !loadingInfo && (
        <Alert
          type="info"
          showIcon
          message="未检测到 vapc"
          description="请上传含 vapc box 的 .vap / .mp4，或使用「SVGA → VAP」生成后再预览。"
        />
      )}

      {vapUrl && vapConfig && (
        <div className="flex flex-col items-center gap-3">
          <div className="w-full">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="text-xs text-mf-muted">VAP 透明合成预览</span>
              <Tag color="purple">video-animation-player · WebGL</Tag>
            </div>
            <div
              className="relative mx-auto overflow-hidden rounded-xl border border-mf-border"
              style={{
                width: previewW ? `${previewW}px` : '100%',
                maxWidth: '100%',
                background: hasAlpha
                  ? 'repeating-conic-gradient(#e2e8f0 0% 25%, #f8fafd 0% 50%) 0 0 / 16px 16px'
                  : '#000',
              }}
            >
              <div
                ref={containerRef}
                className="vap-webgl-container flex min-h-[120px] items-center justify-center"
                style={{ width: '100%', minHeight: info?.h ? Math.min(Number(info.h), 360) : 200 }}
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button
              type="primary"
              shape="circle"
              icon={playing ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
              onClick={playing ? pause : play}
              disabled={!canPlay && !playing}
            />
            {!canPlay && !playing && !loadError && (
              <span className="text-xs text-mf-muted">WebGL 初始化中…</span>
            )}
            <span className="text-sm tabular-nums text-mf-muted">
              {fmtTime(currentTime)} / {fmtTime(duration)}
            </span>
          </div>
        </div>
      )}

      {/* File name */}
      {vapFile && (
        <div className="text-xs text-mf-muted text-center">
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
      children: vapConfig && info ? (
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
            <div className="mb-1 text-xs font-medium text-mf-muted">操作类型</div>
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
                  <span className="text-xs font-medium text-mf-muted">水平缩放比例</span>
                  <span className="text-xs text-mf-muted">{(scaleX * 100).toFixed(0)}%</span>
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
                  <span className="text-xs font-medium text-mf-muted">垂直缩放比例</span>
                  <span className="text-xs text-mf-muted">{(scaleY * 100).toFixed(0)}%</span>
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
                <label htmlFor="lockScale" className="text-xs text-mf-muted cursor-pointer">
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
                <div className="mb-1 text-xs font-medium text-mf-muted">最大帧数</div>
                <Slider min={10} max={300} step={10} value={maxFrames} onChange={setMaxFrames} />
                <InputNumber
                  min={10} max={300} step={10}
                  value={maxFrames} onChange={setMaxFrames}
                  className="mt-1 w-full" addonAfter="帧"
                />
              </div>
              <div>
                <div className="mb-1 text-xs font-medium text-mf-muted">提取帧率</div>
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
            <div className="mb-1 text-xs font-medium text-mf-muted">上传 SVGA 文件</div>
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
              <div className="mt-1 text-xs text-mf-muted">
                {svgaFile.name} — {(svgaFile.size / 1024).toFixed(1)} KB
              </div>
            )}
          </div>

          {/* Scale */}
          <div className="flex gap-2">
            <div className="flex-1">
              <div className="mb-1 text-xs font-medium text-mf-muted">宽度缩放</div>
              <InputNumber
                min={0.1} max={4} step={0.1} precision={2}
                value={svgaScaleX} onChange={setSvgaScaleX}
                className="w-full" addonAfter="×"
              />
            </div>
            <div className="flex-1">
              <div className="mb-1 text-xs font-medium text-mf-muted">高度缩放</div>
              <InputNumber
                min={0.1} max={4} step={0.1} precision={2}
                value={svgaScaleY} onChange={setSvgaScaleY}
                className="w-full" addonAfter="×"
              />
            </div>
          </div>

          {/* FPS */}
          <div>
            <div className="mb-1 text-xs font-medium text-mf-muted">输出帧率</div>
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
