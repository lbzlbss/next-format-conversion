'use client';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Button, Card, Input, InputNumber, Slider, Space, Upload, message, Tabs, Select, Switch } from 'antd';
import { UploadOutlined, PlayCircleOutlined, PauseCircleOutlined, ReloadOutlined, SwapOutlined, DownloadOutlined, CompressOutlined, ExportOutlined, PictureOutlined, LinkOutlined } from '@ant-design/icons';

const SvgaToolContext = createContext(null);

function SvgaToolProvider({ children }) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(null);
  const [SVGA, setSVGA] = useState(null);
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const playerRef = useRef(null);
  const parserRef = useRef(null);
  const videoItemRef = useRef(null);
  const [fileList, setFileList] = useState([]);
  const [objectUrl, setObjectUrl] = useState('');
  const [status, setStatus] = useState('idle'); // idle | loaded | playing | paused

  const [canvasWidth, setCanvasWidth] = useState(600);
  const [canvasHeight, setCanvasHeight] = useState(600);
  const [scale, setScale] = useState(1);
  const [background, setBackground] = useState('#ffffff');

  const [assetKeys, setAssetKeys] = useState([]);
  /** 资源列表：key + 原始缩略图 src（URL 或 dataURL） */
  const [assetEntries, setAssetEntries] = useState([]);
  /** 已选中的替换：key -> dataURL，用于预览与导出 */
  const [replaceMap, setReplaceMap] = useState({});
  const [replaceKey, setReplaceKey] = useState('');
  const [replaceUrl, setReplaceUrl] = useState('');
  const [replaceUrlLoading, setReplaceUrlLoading] = useState(false);

  const [audioMute, setAudioMute] = useState(false);
  const [audioVolume, setAudioVolume] = useState(80);

  // 压缩
  const [compressLoading, setCompressLoading] = useState(false);
  const [compressResult, setCompressResult] = useState(null);
  const [compressOptions, setCompressOptions] = useState({
    imageQuality: 0.8,
    removeAudio: false,
    deduplicate: true,
  });

  // 格式转换
  const [convertFormat, setConvertFormat] = useState('gif');
  const [convertLoading, setConvertLoading] = useState(false);
  const [convertResult, setConvertResult] = useState(null);

  // 导出
  const [exportLoading, setExportLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // 只在客户端环境中加载 svgaplayerweb
    if (typeof window !== 'undefined') {
      try {
        // 使用动态 import 加载，避免 Turbopack 静态分析
        import('svgaplayerweb')
          .then((m) => {
            if (cancelled) return;
            console.log('Loaded SVGA module:', m);
            // 尝试不同的解析方式
            const NS = m?.default?.default ?? m?.default ?? m;
            console.log('Parsed SVGA object:', NS);
            if (!NS?.Player || !NS?.Parser) {
              console.error('SVGA module structure:', {
                hasDefault: !!m.default,
                hasDefaultDefault: !!m.default?.default,
                hasPlayer: !!NS?.Player,
                hasParser: !!NS?.Parser,
                moduleKeys: Object.keys(m),
                defaultKeys: m.default ? Object.keys(m.default) : []
              });
              setError(new Error('SVGA 模块中未找到 Player/Parser'));
              return;
            }
            setSVGA(NS);
            setReady(true);
          })
          .catch((err) => {
            console.error('Error loading SVGA module:', err);
            if (!cancelled) setError(err || new Error('加载 SVGA 播放器失败'));
          });
      } catch (err) {
        console.error('Error loading SVGA module:', err);
        setError(err || new Error('加载 SVGA 播放器失败'));
      }
    }
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [objectUrl]);

  useEffect(() => {
    if (!ready || error || !SVGA) return;
    if (!canvasRef.current) {
      console.error('Canvas element not found');
      message.error('SVGA 播放器初始化失败：Canvas 元素未找到');
      return;
    }

    try {
      console.log('SVGA object:', SVGA);
      console.log('Canvas element:', canvasRef.current);
      
      if (!SVGA.Player) {
        console.error('SVGA.Player not found');
        message.error('SVGA 播放器初始化失败：未找到 Player 构造函数');
        return;
      }
      
      if (!SVGA.Parser) {
        console.error('SVGA.Parser not found');
        message.error('SVGA 播放器初始化失败：未找到 Parser 构造函数');
        return;
      }
      
      if (!playerRef.current) {
        console.log('Creating SVGA.Player');
        playerRef.current = new SVGA.Player(canvasRef.current);
        playerRef.current.loops = 0;
        playerRef.current.clearsAfterStop = false;
        console.log('SVGA.Player created successfully');
      }
      
      if (!parserRef.current) {
        console.log('Creating SVGA.Parser');
        parserRef.current = new SVGA.Parser(canvasRef.current);
        console.log('SVGA.Parser created successfully');
      }
      
      console.log('SVGA player initialized successfully');
    } catch (e) {
      console.error('Error initializing SVGA player:', e);
      message.error(`SVGA 播放器初始化失败：${e.message}`);
    }
  }, [ready, error, SVGA]);

  const hasSvga = useMemo(() => fileList.length > 0, [fileList]);

  /** 从 Upload 的 fileList 取出用于接口的 File，校验为有效 .svga */
  const getSvgaFile = () => {
    const item = fileList[0];
    const file = item?.originFileObj ?? item;
    if (!file || !(file instanceof File)) return null;
    if (file.size === 0) return null;
    if (!file.name?.toLowerCase().endsWith('.svga')) return null;
    return file;
  };

  const loadSvga = async () => {
    if (!ready) {
      message.warning('SVGA 播放器脚本加载中…');
      return;
    }
    const file = getSvgaFile();
    if (!file) {
      message.warning(hasSvga ? '请上传有效的 .svga 文件（非空且扩展名为 .svga）' : '请先上传 .svga 文件');
      return;
    }

    if (objectUrl) URL.revokeObjectURL(objectUrl);
    const url = URL.createObjectURL(file);
    setObjectUrl(url);

    const player = playerRef.current;
    const parser = parserRef.current;
    if (!player || !parser) {
      message.error('播放器未就绪');
      return;
    }

    setStatus('idle');
    setAssetKeys([]);
    setAssetEntries([]);
    setReplaceMap({});
    setReplaceKey('');

    try {
      parser.load(
        url,
        (videoItem) => {
          videoItemRef.current = videoItem;
          player.setVideoItem(videoItem);

          const images = videoItem?.images || videoItem?.videoEntity?.images || {};
          const keys = Object.keys(images);
          const makeDataUrl = (val) => {
            if (!val) return '';
            if (typeof val === 'string') {
              if (val.startsWith('data:')) return val;
              if (val.startsWith('http://') || val.startsWith('https://')) return val;
              return `data:image/png;base64,${val}`;
            }
            return '';
          };
          setAssetKeys(keys);
          setAssetEntries(keys.map((key) => ({ key, src: makeDataUrl(images[key]) })));
          setStatus('loaded');

          // 尝试应用音频设置（不同版本能力不同，做 best-effort）
          try {
            if (typeof player.setVolume === 'function') player.setVolume(audioMute ? 0 : audioVolume / 100);
            if ('mute' in player) player.mute = audioMute;
          } catch (_) {}
        },
        (err) => {
          console.error(err);
          message.error('SVGA 解析失败，请检查文件');
        }
      );
    } catch (e) {
      console.error(e);
      message.error('SVGA 加载失败');
    }
  };

  const play = () => {
    const player = playerRef.current;
    if (!player || !videoItemRef.current) {
      message.warning('请先加载 SVGA');
      return;
    }
    try {
      player.startAnimation();
      setStatus('playing');
    } catch (e) {
      console.error(e);
      message.error('播放失败');
    }
  };

  const pause = () => {
    const player = playerRef.current;
    if (!player) return;
    try {
      if (typeof player.stopAnimation === 'function') player.stopAnimation(false);
      setStatus('paused');
    } catch (e) {
      console.error(e);
      message.error('暂停失败');
    }
  };

  const reset = () => {
    const player = playerRef.current;
    if (!player) return;
    try {
      if (typeof player.stopAnimation === 'function') player.stopAnimation(true);
      if (videoItemRef.current) player.setVideoItem(videoItemRef.current);
      setStatus('loaded');
    } catch (e) {
      console.error(e);
      message.error('重置失败');
    }
  };

  /** 将 dataURL 应用到播放器并写入 replaceMap */
  const applyDataUrlToKey = useCallback((key, dataUrl) => {
    const player = playerRef.current;
    setReplaceMap((prev) => ({ ...prev, [key]: dataUrl }));
    if (player && typeof player.setImage === 'function') {
      try {
        player.setImage(dataUrl, key);
      } catch (e) {
        console.error(e);
      }
    }
  }, []);

  /** 从链接下载图片并替换（先下载再替换） */
  const applyReplaceFromUrl = async () => {
    if (!replaceKey) {
      message.warning('请先选择要替换的资源');
      return;
    }
    const url = replaceUrl?.trim();
    if (!url || (!url.startsWith('http') && !url.startsWith('data:'))) {
      message.warning('请填写可访问的图片链接（http/https）或保持 dataURL');
      return;
    }
    if (url.startsWith('data:')) {
      applyDataUrlToKey(replaceKey, url);
      message.success('已应用替换');
      return;
    }
    setReplaceUrlLoading(true);
    try {
      const res = await fetch(url, { mode: 'cors' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const dataUrl = await new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result);
        r.onerror = reject;
        r.readAsDataURL(blob);
      });
      applyDataUrlToKey(replaceKey, dataUrl);
      message.success('已下载并替换该资源');
    } catch (e) {
      message.error(e.message || '链接下载失败，请检查地址或跨域');
    } finally {
      setReplaceUrlLoading(false);
    }
  };

  /** 从本地上传文件替换 */
  const applyReplaceFromFile = (file) => {
    if (!replaceKey) {
      message.warning('请先选择要替换的资源');
      return false;
    }
    const reader = new FileReader();
    reader.onload = () => {
      applyDataUrlToKey(replaceKey, reader.result);
      message.success('已用本地图片替换');
    };
    reader.readAsDataURL(file);
    return false; // 阻止 Upload 自动上传
  };

  const applyReplace = () => {
    if (replaceMap[replaceKey]) {
      const player = playerRef.current;
      if (player && typeof player.setImage === 'function') {
        try {
          player.setImage(replaceMap[replaceKey], replaceKey);
          message.success('已应用当前替换');
        } catch (e) {
          message.error('应用失败');
        }
      } else {
        message.info('替换已记录，导出时将生效');
      }
    } else {
      message.warning('请先通过链接或上传设置替换图');
    }
  };

  const runCompress = async () => {
    const file = getSvgaFile();
    if (!file) {
      message.warning(hasSvga ? '请上传有效的 .svga 文件（非空且扩展名为 .svga）' : '请先上传 .svga 文件');
      return;
    }
    setCompressLoading(true);
    setCompressResult(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('action', 'compress');
      fd.append('options', JSON.stringify(compressOptions));
      const res = await fetch('/api/svga', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '压缩失败');
      setCompressResult(data);
      message.success(`压缩完成，体积减少 ${data.compressionRatio}%`);
    } catch (e) {
      message.error(e.message || '压缩失败');
    } finally {
      setCompressLoading(false);
    }
  };

  const downloadCompressed = () => {
    if (!compressResult?.data || !compressResult?.filename) return;
    try {
      const bin = atob(compressResult.data);
      const arr = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
      const blob = new Blob([arr], { type: 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = compressResult.filename;
      a.click();
      URL.revokeObjectURL(url);
      message.success('已开始下载');
    } catch (e) {
      message.error('下载失败');
    }
  };

  const runConvert = async () => {
    const file = getSvgaFile();
    if (!file) {
      message.warning(hasSvga ? '请上传有效的 .svga 文件（非空且扩展名为 .svga）' : '请先上传 .svga 文件');
      return;
    }
    setConvertLoading(true);
    setConvertResult(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('action', 'convert');
      fd.append('format', convertFormat);
      fd.append('options', JSON.stringify({}));
      const res = await fetch('/api/svga', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '转换失败');
      setConvertResult(data);
      message.info(data.message || '已获取转换信息');
    } catch (e) {
      message.error(e.message || '转换失败');
    } finally {
      setConvertLoading(false);
    }
  };

  const runExport = async () => {
    const file = getSvgaFile();
    if (!file) {
      message.warning(hasSvga ? '请上传有效的 .svga 文件（非空且扩展名为 .svga）' : '请先上传 .svga 文件');
      return;
    }
    setExportLoading(true);
    try {
      const edits = {
        canvas: { width: canvasWidth, height: canvasHeight },
        audio: { remove: audioMute, volume: audioVolume },
      };
      const replaceList = Object.entries(replaceMap).filter(([, v]) => v && typeof v === 'string');
      if (replaceList.length > 0) {
        edits.replace = replaceList.map(([key, imageData]) => ({ key, imageData }));
      }
      const fd = new FormData();
      fd.append('file', file);
      fd.append('action', 'export');
      fd.append('edits', JSON.stringify(edits));
      const res = await fetch('/api/svga', { method: 'POST', body: fd });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || '导出失败');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `edited_${file.name}`;
      a.click();
      URL.revokeObjectURL(url);
      message.success('已导出并开始下载');
    } catch (e) {
      message.error(e.message || '导出失败');
    } finally {
      setExportLoading(false);
    }
  };

  const value = {
    ready,
    error,
    fileList,
    setFileList,
    hasSvga,
    getSvgaFile,
    loadSvga,
    play,
    pause,
    reset,
    status,
    containerRef,
    canvasRef,
    background,
    canvasWidth,
    setCanvasWidth,
    canvasHeight,
    setCanvasHeight,
    scale,
    setScale,
    setBackground,
    assetKeys,
    assetEntries,
    replaceMap,
    setReplaceMap,
    replaceKey,
    setReplaceKey,
    replaceUrl,
    setReplaceUrl,
    replaceUrlLoading,
    applyDataUrlToKey,
    applyReplaceFromUrl,
    applyReplaceFromFile,
    applyReplace,
    audioMute,
    setAudioMute,
    audioVolume,
    setAudioVolume,
    compressOptions,
    setCompressOptions,
    compressLoading,
    compressResult,
    runCompress,
    downloadCompressed,
    convertFormat,
    setConvertFormat,
    convertLoading,
    convertResult,
    runConvert,
    exportLoading,
    runExport,
  };

  return <SvgaToolContext.Provider value={value}>{children}</SvgaToolContext.Provider>;
}

function SvgaToolMain() {
  const ctx = useContext(SvgaToolContext);
  if (!ctx) return null;
  const {
    ready,
    error,
    fileList,
    setFileList,
    hasSvga,
    loadSvga,
    play,
    pause,
    reset,
    status,
    exportLoading,
    runExport,
    containerRef,
    canvasRef,
    background,
    canvasWidth,
    canvasHeight,
    scale,
  } = ctx;
  return (
    <div className="space-y-4">
      <Card title="SVGA 工具" styles={{ body: { padding: 16 } }}>
        <Space orientation="vertical" style={{ width: '100%' }} size={12}>
          <div className="flex flex-wrap items-center gap-10">
            <Upload
              accept=".svga"
              fileList={fileList}
              beforeUpload={() => false}
              maxCount={1}
              onChange={(info) => setFileList(info.fileList)}
            >
              <Button icon={<UploadOutlined />}>上传 SVGA</Button>
            </Upload>
            <Space>
              <Button icon={<ReloadOutlined />} onClick={loadSvga} disabled={!hasSvga}>
                加载/刷新
              </Button>
              <Button icon={<PlayCircleOutlined />} onClick={play} disabled={status === 'playing'}>
                播放
              </Button>
              <Button icon={<PauseCircleOutlined />} onClick={pause} disabled={status !== 'playing'}>
                暂停
              </Button>
              <Button onClick={reset} disabled={status === 'idle'}>
                重置
              </Button>
              <Button type="primary" icon={<ExportOutlined />} loading={exportLoading} onClick={runExport} disabled={!hasSvga}>
                导出 SVGA
              </Button>
            </Space>
          </div>
          {!ready && <div className="text-[12px] text-slate-500">SVGA 播放器脚本加载中…</div>}
          {error && <div className="text-[12px] text-red-500">SVGA 播放器脚本加载失败，请检查网络。</div>}
        </Space>
      </Card>
      <Card title="SVGA 预览" styles={{ body: { padding: 16 } }}>
        <div
          ref={containerRef}
          className="flex items-center justify-center rounded-2xl border border-dashed border-[#e2e8f0]"
          style={{ background, height: 520, overflow: 'hidden' }}
        >
          <canvas
            ref={canvasRef}
            width={canvasWidth}
            height={canvasHeight}
            style={{ transform: `scale(${scale})`, transformOrigin: 'center center' }}
          />
        </div>
        <div className="mt-3 text-[12px] text-slate-500">
          提示：若预览为空，请点“加载/刷新”。在右侧「Conversion Settings」中可替换资源图、调整画布与导出。
        </div>
      </Card>
    </div>
  );
}

function SvgaToolEditPanel() {
  const ctx = useContext(SvgaToolContext);
  if (!ctx) return null;
  const {
    hasSvga,
    canvasWidth,
    setCanvasWidth,
    canvasHeight,
    setCanvasHeight,
    scale,
    setScale,
    background,
    setBackground,
    assetEntries,
    replaceMap,
    replaceKey,
    setReplaceKey,
    replaceUrl,
    setReplaceUrl,
    replaceUrlLoading,
    applyReplaceFromUrl,
    applyReplaceFromFile,
    applyReplace,
    audioMute,
    setAudioMute,
    audioVolume,
    setAudioVolume,
    compressOptions,
    setCompressOptions,
    compressLoading,
    compressResult,
    runCompress,
    downloadCompressed,
    convertFormat,
    setConvertFormat,
    convertLoading,
    convertResult,
    runConvert,
  } = ctx;
  return (
    <div className="h-full overflow-auto">
      <Tabs
            items={[
              {
                key: 'canvas',
                label: '画布调整',
                children: (
                  <Space orientation="vertical" style={{ width: '100%' }} size={12}>
                    <div>
                      <div className="mb-2 text-[12px] font-semibold text-slate-700">画布尺寸</div>
                      <Space>
                        <InputNumber min={64} max={4096} value={canvasWidth} onChange={(v) => setCanvasWidth(Number(v || 600))} />
                        <span className="text-slate-500">×</span>
                        <InputNumber min={64} max={4096} value={canvasHeight} onChange={(v) => setCanvasHeight(Number(v || 600))} />
                      </Space>
                    </div>
                    <div>
                      <div className="mb-2 text-[12px] font-semibold text-slate-700">缩放</div>
                      <Slider min={0.2} max={2} step={0.05} value={scale} onChange={setScale} />
                    </div>
                    <div>
                      <div className="mb-2 text-[12px] font-semibold text-slate-700">背景色</div>
                      <Input value={background} onChange={(e) => setBackground(e.target.value)} placeholder="#ffffff" />
                    </div>
                  </Space>
                ),
              },
              {
                key: 'replace',
                label: '图片替换',
                children: (
                  <Space direction="vertical" style={{ width: '100%' }} size={12}>
                    <div className="text-[12px] font-semibold text-slate-700">资源列表（点击选中并高亮）</div>
                    <div className="grid max-h-[200px] grid-cols-3 gap-2 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-2">
                      {assetEntries.length === 0 ? (
                        <div className="col-span-3 py-4 text-center text-[12px] text-slate-500">加载 SVGA 后显示资源</div>
                      ) : (
                        assetEntries.map(({ key: k, src }) => {
                          const displaySrc = replaceMap[k] || src;
                          const selected = replaceKey === k;
                          return (
                            <button
                              key={k}
                              type="button"
                              onClick={() => setReplaceKey(k)}
                              className={`flex flex-col items-center gap-1 rounded-lg border-2 p-1 transition ${
                                selected ? 'border-indigo-500 bg-indigo-50' : 'border-transparent hover:border-slate-300 hover:bg-white'
                              }`}
                            >
                              <div className="relative h-14 w-14 overflow-hidden rounded bg-white">
                                {displaySrc ? (
                                  <img src={displaySrc} alt="" className="h-full w-full object-contain" onError={(e) => { e.target.style.display = 'none'; }} />
                                ) : (
                                  <div className="flex h-full w-full items-center justify-center text-[10px] text-slate-400">无图</div>
                                )}
                              </div>
                              <span className="max-w-full truncate text-[10px] text-slate-600" title={k}>{k}</span>
                            </button>
                          );
                        })
                      )}
                    </div>
                    <Input
                      value={replaceKey}
                      onChange={(e) => setReplaceKey(e.target.value)}
                      placeholder="或手动填写资源 key"
                    />
                    <div className="text-[12px] font-semibold text-slate-700">替换为</div>
                    <div className="flex flex-wrap gap-2">
                      <Input
                        className="flex-1 min-w-0"
                        value={replaceUrl}
                        onChange={(e) => setReplaceUrl(e.target.value)}
                        placeholder="图片链接 https://..."
                      />
                      <Button
                        type="primary"
                        icon={<LinkOutlined />}
                        loading={replaceUrlLoading}
                        onClick={applyReplaceFromUrl}
                        disabled={!replaceKey}
                      >
                        下载并替换
                      </Button>
                    </div>
                    <Upload accept="image/*" showUploadList={false} beforeUpload={applyReplaceFromFile}>
                      <Button icon={<PictureOutlined />} disabled={!replaceKey}>上传本地图片替换</Button>
                    </Upload>
                    <Button type="default" icon={<SwapOutlined />} onClick={applyReplace} disabled={!replaceKey}>
                      应用当前替换到预览
                    </Button>
                    <div className="text-[12px] text-slate-500">
                      选择 key 后可用链接（先下载）或本地上传替换；导出时所有已替换资源会写入文件。
                    </div>
                  </Space>
                ),
              },
              {
                key: 'audio',
                label: '音频编辑',
                children: (
                  <Space orientation="vertical" style={{ width: '100%' }} size={12}>
                    <div className="flex items-center justify-between">
                      <div className="text-[12px] font-semibold text-slate-700">静音</div>
                      <Switch
                        checked={audioMute}
                        onChange={(v) => {
                          setAudioMute(v);
                          try {
                            const player = playerRef.current;
                            if (player && typeof player.setVolume === 'function') player.setVolume(v ? 0 : audioVolume / 100);
                            if (player && 'mute' in player) player.mute = v;
                          } catch (_) {}
                        }}
                      />
                    </div>
                    <div>
                      <div className="mb-2 text-[12px] font-semibold text-slate-700">音量</div>
                      <Slider
                        min={0}
                        max={100}
                        value={audioVolume}
                        onChange={(v) => {
                          setAudioVolume(v);
                          try {
                            const player = playerRef.current;
                            if (player && typeof player.setVolume === 'function') player.setVolume(audioMute ? 0 : v / 100);
                          } catch (_) {}
                        }}
                      />
                    </div>
                    <div className="text-[12px] text-slate-500">
                      说明：SVGA Web 的音频能力因版本/浏览器差异较大。这里做了 best-effort 的静音/音量控制；如需“剪辑/替换音频”，需要后端解包与重新打包流程（后续可补）。
                    </div>
                  </Space>
                ),
              },
              {
                key: 'compress',
                label: '智能压缩',
                children: (
                  <Space direction="vertical" style={{ width: '100%' }} size={12}>
                    <div>
                      <div className="mb-2 text-[12px] font-semibold text-slate-700">图片质量 (0–1)</div>
                      <Slider
                        min={0.1}
                        max={1}
                        step={0.05}
                        value={compressOptions.imageQuality}
                        onChange={(v) => setCompressOptions((o) => ({ ...o, imageQuality: v }))}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="text-[12px] font-semibold text-slate-700">移除音频</div>
                      <Switch
                        checked={compressOptions.removeAudio}
                        onChange={(v) => setCompressOptions((o) => ({ ...o, removeAudio: v }))}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="text-[12px] font-semibold text-slate-700">资源去重</div>
                      <Switch
                        checked={compressOptions.deduplicate}
                        onChange={(v) => setCompressOptions((o) => ({ ...o, deduplicate: v }))}
                      />
                    </div>
                    <Button
                      type="primary"
                      icon={<CompressOutlined />}
                      loading={compressLoading}
                      onClick={runCompress}
                      disabled={!hasSvga}
                    >
                      开始压缩
                    </Button>
                    {compressResult && (
                      <Card size="small" className="bg-slate-50">
                        <div className="text-[12px] text-slate-700">
                          <div>原始: {(compressResult.originalSize / 1024).toFixed(2)} KB</div>
                          <div>压缩后: {(compressResult.compressedSize / 1024).toFixed(2)} KB</div>
                          <div>体积减少: {compressResult.compressionRatio}%</div>
                        </div>
                        <Button
                          type="link"
                          size="small"
                          icon={<DownloadOutlined />}
                          onClick={downloadCompressed}
                          className="mt-2 p-0"
                        >
                          下载压缩文件
                        </Button>
                      </Card>
                    )}
                    <div className="text-[12px] text-slate-500">
                      通过资源去重、可选移除音频与质量参数重新打包，降低 SVGA 体积。
                    </div>
                  </Space>
                ),
              },
              {
                key: 'convert',
                label: '格式转换',
                children: (
                  <Space direction="vertical" style={{ width: '100%' }} size={12}>
                    <div>
                      <div className="mb-2 text-[12px] font-semibold text-slate-700">目标格式</div>
                      <Select
                        value={convertFormat}
                        onChange={setConvertFormat}
                        options={[
                          { value: 'gif', label: 'GIF' },
                          { value: 'mp4', label: 'MP4' },
                          { value: 'webm', label: 'WebM' },
                          { value: 'png-sequence', label: 'PNG 序列帧' },
                        ]}
                        style={{ width: '100%' }}
                      />
                    </div>
                    <Button
                      type="primary"
                      loading={convertLoading}
                      onClick={runConvert}
                      disabled={!hasSvga}
                    >
                      获取转换信息
                    </Button>
                    {convertResult && (
                      <Card size="small" className="bg-slate-50">
                        <div className="text-[12px] text-slate-700">
                          <div className="mb-1">{convertResult.message}</div>
                          {convertResult.spec && (
                            <div className="text-slate-500">
                              帧数: {convertResult.spec.frames} · FPS: {convertResult.spec.fps} · 尺寸: {convertResult.spec.width}×{convertResult.spec.height}
                              {convertResult.spec.duration != null && ` · 时长: ${convertResult.spec.duration.toFixed(2)}s`}
                            </div>
                          )}
                        </div>
                      </Card>
                    )}
                    <div className="text-[12px] text-slate-500">
                      GIF/MP4/WebM/PNG 序列需服务端或客户端渲染管线，当前接口返回规格信息；完整导出需后续接入渲染能力。
                    </div>
                  </Space>
                ),
              },
            ]}
          />
    </div>
  );
}

function SvgaToolInternal() {
  return (
    <SvgaToolProvider>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          <SvgaToolMain />
        </div>
        <Card title="编辑与转换设置" styles={{ body: { padding: 16 } }} className="h-full overflow-auto">
          <SvgaToolEditPanel />
        </Card>
      </div>
    </SvgaToolProvider>
  );
}

export default SvgaToolInternal;
export { SvgaToolProvider, SvgaToolMain, SvgaToolEditPanel };
