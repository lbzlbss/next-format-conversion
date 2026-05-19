'use client';
import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { Input, Select, Slider, Switch } from 'antd';
import {
  SwapOutlined,
  CompressOutlined,
  VideoCameraOutlined,
  PictureOutlined,
  FileImageOutlined,
  EditOutlined,
  PlayCircleOutlined,
  SettingOutlined,
  BellOutlined,
  BookOutlined,
  QuestionCircleOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import GifToWebp from './components/GifToWebp';
import Mp4Compress from './components/Mp4Compress';
import GifToMp4 from './components/GifToMp4';
import Mp4FirstFrame from './components/Mp4FirstFrame';
import ImageCompress from './components/ImageCompress';
import GifCompress from './components/GifCompress';
import ImageGenerate from './components/ImageGenerate';
import SvgaTool from './components/SvgaTool';
import { SvgaToolProvider, SvgaToolMain, SvgaToolEditPanel } from './components/SvgaToolInternal';
import { VapProvider, VapMain, VapEditPanel } from './components/VapToolInternal';
import VideoWatermarkRemover from './components/VideoWatermarkRemover';
import AssetZipConvert from './components/AssetZipConvert';
import SidebarNav from './components/layout/SidebarNav';

/** 侧栏分组 */
const NAV_GROUPS = [
  {
    id: 'media',
    label: '动效与图片转换',
    defaultOpen: true,
    keys: [
      'gifToWebp',
      'mp4Compress',
      'gifToMp4',
      'mp4FirstFrame',
      'imageCompress',
      'gifCompress',
      'svgaTool',
      'vapTool',
      'assetZipConvert',
    ],
  },
  {
    id: 'ai',
    label: 'AI 图像生成',
    defaultOpen: true,
    keys: ['imageGenerate'],
  },
  {
    id: 'other',
    label: '其他工具',
    defaultOpen: true,
    keys: ['videoWatermark'],
  },
];

/** 工具 nav key → Wiki slug */
const WIKI_SLUG_BY_TOOL = {
  gifToWebp: 'gif-to-webp',
  mp4Compress: 'mp4-compress',
  imageGenerate: 'image-generate',
  svgaTool: 'svga-tool',
};

const TOOL_DESC = {
  gifToWebp: '将 GIF 动画转为 WebP，可调质量、effort 与 near-lossless。',
  mp4Compress: '压缩 MP4 体积，可调编码预设、音频码率与分辨率上限。',
  gifToMp4: 'GIF 转 H.264 MP4，适合需要视频播放的场景。',
  mp4FirstFrame: '从 MP4 提取首帧，输出 WebP / JPEG 等静态图。',
  imageCompress: '压缩图片体积，可选输出格式与 EXIF 处理策略。',
  gifCompress: '缩小 GIF 体积，支持调色板与有损压缩参数。',
  imageGenerate: '基于豆包 Seedream 的文生图 / 图生图。',
  svgaTool: '预览、编辑并导出 SVGA 动效资源。',
  vapTool: '上传 VAP 预览 alpha 通道，支持缩放与格式转换。',
  assetZipConvert: '解压动效压缩包并批量转换 SVGA / VAP。',
  videoWatermark: '框选区域去除视频水印（实验功能）。',
};

const HomePage = () => {
  const [activeKey, setActiveKey] = useState('gifToWebp');
  const [query, setQuery] = useState('');
  const [settingsByToolKey, setSettingsByToolKey] = useState(() => ({
    gifToWebp: { quality: 80, effort: 4, speed: 5, nearLossless: false },
    mp4Compress: { qualityLevel: 'medium', preset: 'medium', audioBitrate: '128k', maxWidth: null, maxHeight: null },
    gifToMp4: { crf: 23, preset: 'medium', fps: 30, bitrate: '192k' },
    mp4FirstFrame: { format: 'webp', quality: 80, effort: 4 },
    imageCompress: {
      quality: 80,
      outputFormat: 'original',
      maxWidth: null,
      maxHeight: null,
      preserveExif: true,
      stripMetadata: false,
    },
    gifCompress: {
      quality: 30,
      effort: 10,
      speed: 1,
      colors: 256,
      dither: 0.2,
      compressionLevel: 9,
      lossy: true,
    },
    imageGenerate: {},
    videoWatermark: {},
    assetZipConvert: {},
  }));

  const navItems = useMemo(
    () => [
      { key: 'gifToWebp', label: 'GIF 转 WebP', icon: <SwapOutlined />, Component: GifToWebp },
      { key: 'mp4Compress', label: 'MP4 压缩', icon: <CompressOutlined />, Component: Mp4Compress },
      { key: 'gifToMp4', label: 'GIF 转 MP4', icon: <VideoCameraOutlined />, Component: GifToMp4 },
      { key: 'mp4FirstFrame', label: 'MP4 获取首帧', icon: <PictureOutlined />, Component: Mp4FirstFrame },
      { key: 'imageCompress', label: '图片压缩', icon: <FileImageOutlined />, Component: ImageCompress },
      { key: 'gifCompress', label: 'GIF 压缩', icon: <CompressOutlined />, Component: GifCompress },
      { key: 'imageGenerate', label: 'AI 图像生成', icon: <EditOutlined />, Component: ImageGenerate },
      { key: 'svgaTool', label: 'SVGA 工具', icon: <PlayCircleOutlined />, Component: SvgaTool },
      { key: 'vapTool',  label: 'VAP 动效',  icon: <ThunderboltOutlined />, Component: null },
      { key: 'assetZipConvert', label: '压缩包动效转换', icon: <SettingOutlined />, Component: AssetZipConvert },
      { key: 'videoWatermark', label: '视频去水印', icon: <EditOutlined />, Component: VideoWatermarkRemover },
    ],
    []
  );

  const active = useMemo(
    () => navItems.find((it) => it.key === activeKey) ?? navItems[0],
    [activeKey, navItems]
  );

  const mobileSelectOptions = useMemo(
    () =>
      NAV_GROUPS.map((g) => ({
        label: g.label,
        options: navItems
          .filter((it) => g.keys.includes(it.key))
          .map((it) => ({ value: it.key, label: it.label })),
      })).filter((g) => g.options.length > 0),
    [navItems]
  );

  const activeSettings = settingsByToolKey[active.key] ?? {};
  const updateActiveSettings = (patch) => {
    setSettingsByToolKey((prev) => ({
      ...prev,
      [active.key]: { ...(prev[active.key] ?? {}), ...patch },
    }));
  };

  const rightPanelSpec = useMemo(() => {
    const shared = {
      title: 'Conversion Settings',
      note: '右侧参数会随工具变化，并会参与实际转换请求。',
    };

    switch (active.key) {
      case 'mp4Compress':
        return {
          ...shared,
          fields: [
            {
              key: 'qualityLevel',
              label: 'Quality / Compression',
              kind: 'select',
              options: [
                { value: 'high', label: 'High (18)' },
                { value: 'medium', label: 'Medium (23)' },
                { value: 'low', label: 'Low (28)' },
                { value: 'lowlow', label: 'Very Low (32)' },
              ],
            },
            {
              key: 'preset',
              label: 'Encoder Preset',
              kind: 'select',
              options: [
                { value: 'ultrafast', label: 'Ultrafast' },
                { value: 'superfast', label: 'Superfast' },
                { value: 'veryfast', label: 'Veryfast' },
                { value: 'faster', label: 'Faster' },
                { value: 'fast', label: 'Fast' },
                { value: 'medium', label: 'Medium' },
                { value: 'slow', label: 'Slow' },
                { value: 'slower', label: 'Slower' },
                { value: 'veryslow', label: 'Veryslow' },
              ],
            },
            {
              key: 'audioBitrate',
              label: 'Audio Bitrate',
              kind: 'sliderKbps',
              min: 32,
              max: 320,
              step: 8,
            },
            { key: 'maxWidth', label: 'Max Width (px)', kind: 'sliderNullable', min: 0, max: 3840, step: 100 },
            { key: 'maxHeight', label: 'Max Height (px)', kind: 'sliderNullable', min: 0, max: 2160, step: 100 },
          ],
        };
      case 'imageCompress':
        return {
          ...shared,
          fields: [
            { key: 'outputFormat', label: 'Output Format', kind: 'select', options: [
              { value: 'original', label: 'Original' },
              { value: 'jpeg', label: 'JPEG' },
              { value: 'png', label: 'PNG' },
              { value: 'webp', label: 'WebP' },
            ]},
            { key: 'quality', label: 'Quality', kind: 'slider', min: 1, max: 100, step: 1 },
            { key: 'maxWidth', label: 'Max Width (px)', kind: 'sliderNullable', min: 0, max: 8192, step: 100 },
            { key: 'maxHeight', label: 'Max Height (px)', kind: 'sliderNullable', min: 0, max: 8192, step: 100 },
            { key: 'preserveExif', label: 'Preserve EXIF', kind: 'switch' },
            { key: 'stripMetadata', label: 'Remove Metadata', kind: 'switch' },
          ],
        };
      case 'gifToWebp':
        return {
          ...shared,
          fields: [
            { key: 'quality', label: 'Quality', kind: 'slider', min: 1, max: 100, step: 1 },
            { key: 'effort', label: 'Effort', kind: 'slider', min: 1, max: 6, step: 1 },
            { key: 'speed', label: 'Speed', kind: 'slider', min: 0, max: 10, step: 1 },
            { key: 'nearLossless', label: 'Near Lossless', kind: 'switch' },
          ],
        };
      case 'gifToMp4':
        return {
          ...shared,
          fields: [
            { key: 'crf', label: 'CRF', kind: 'slider', min: 0, max: 51, step: 1 },
            {
              key: 'preset',
              label: 'Encoder Preset',
              kind: 'select',
              options: [
                { value: 'ultrafast', label: 'Ultrafast' },
                { value: 'superfast', label: 'Superfast' },
                { value: 'veryfast', label: 'Veryfast' },
                { value: 'faster', label: 'Faster' },
                { value: 'fast', label: 'Fast' },
                { value: 'medium', label: 'Medium' },
                { value: 'slow', label: 'Slow' },
                { value: 'slower', label: 'Slower' },
                { value: 'veryslow', label: 'Veryslow' },
              ],
            },
            { key: 'fps', label: 'FPS', kind: 'slider', min: 15, max: 60, step: 5 },
            {
              key: 'bitrate',
              label: 'Audio Bitrate',
              kind: 'select',
              options: [
                { value: '96k', label: '96 kbps' },
                { value: '128k', label: '128 kbps' },
                { value: '192k', label: '192 kbps' },
                { value: '256k', label: '256 kbps' },
                { value: '320k', label: '320 kbps' },
              ],
            },
          ],
        };
      case 'mp4FirstFrame':
        return {
          ...shared,
          fields: [
            { key: 'format', label: 'Output Format', kind: 'select', options: [
              { value: 'webp', label: 'WebP' },
              { value: 'png', label: 'PNG' },
            ]},
            { key: 'quality', label: 'Image Quality', kind: 'slider', min: 1, max: 100, step: 1 },
            { key: 'effort', label: 'Effort', kind: 'slider', min: 1, max: 6, step: 1 },
          ],
        };
      case 'gifCompress':
        return {
          ...shared,
          fields: [
            { key: 'quality', label: 'Quality', kind: 'slider', min: 1, max: 100, step: 1 },
            { key: 'colors', label: 'Colors', kind: 'slider', min: 2, max: 256, step: 4 },
            { key: 'effort', label: 'Effort', kind: 'slider', min: 1, max: 10, step: 1 },
            { key: 'speed', label: 'Speed', kind: 'slider', min: 1, max: 10, step: 1 },
            { key: 'dither', label: 'Dither', kind: 'slider', min: 0, max: 1, step: 0.1 },
            { key: 'compressionLevel', label: 'Compression Level', kind: 'slider', min: 1, max: 9, step: 1 },
            { key: 'lossy', label: 'Lossy', kind: 'switch' },
          ],
        };
      default:
        return { ...shared, fields: [] };
    }
  }, [active.key]);

  return (
    <div className="min-h-screen bg-mf-canvas">
      <div className="mx-auto flex min-h-screen w-full">
        {/* Left Sidebar */}
        <aside className="hidden w-[288px] shrink-0 flex-col border-r border-mf-border-sidebar bg-mf-sidebar md:flex">
          <div className="flex items-center gap-3 p-6">
            <div className="grid size-10 place-items-center rounded-2xl mf-logo-badge">
              <span className="text-sm font-bold text-white">MF</span>
            </div>
            <div className="leading-tight">
              <div className="text-[20px] font-bold tracking-[-0.5px] text-white">MediaFlow</div>
              <div className="text-[12px] font-medium uppercase tracking-[0.6px] text-mf-sidebar-muted">
                Pro Edition
              </div>
            </div>
          </div>

          <nav className="flex-1 overflow-y-auto px-4">
            <SidebarNav
              groups={NAV_GROUPS}
              items={navItems}
              activeKey={activeKey}
              onSelect={setActiveKey}
              query={query}
            />

            <p className="mt-6 px-2 text-[10px] font-bold uppercase tracking-[1px] text-mf-sidebar-muted">
              实验功能
            </p>
            <Link href="/chat" className="mf-sidebar-link mt-2">
              <span className="flex items-center gap-3">
                <span className="grid size-[22px] place-items-center rounded-md bg-white/10 text-mf-sidebar-text">
                  <EditOutlined />
                </span>
                <span className="text-[16px] font-medium">AI 对话助手</span>
              </span>
              <span className="rounded-full mf-logo-badge px-2 py-[2px] text-[10px] font-bold text-white">
                NEW
              </span>
            </Link>
          </nav>

          <div className="border-t border-mf-border-sidebar p-4">
            <div className="rounded-2xl bg-white/5 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wide text-mf-sidebar-muted">当前工具</p>
              <p className="mt-1 text-[13px] font-semibold text-white">{active.label}</p>
              <p className="mt-1 line-clamp-3 text-[11px] leading-relaxed text-mf-sidebar-muted">
                {TOOL_DESC[active.key] || '在上方选择工具开始处理文件。'}
              </p>
              {WIKI_SLUG_BY_TOOL[active.key] ? (
                <Link
                  href={`/wiki/${WIKI_SLUG_BY_TOOL[active.key]}`}
                  className="mf-sidebar-quick-link mt-2 inline-flex text-mf-cta hover:text-white"
                >
                  <BookOutlined />
                  本工具说明
                </Link>
              ) : null}
            </div>

            <div className="mt-3 flex flex-col gap-0.5">
              <Link href="/wiki" className="mf-sidebar-quick-link">
                <BookOutlined />
                知识库
              </Link>
              <Link href="/chat" className="mf-sidebar-quick-link">
                <EditOutlined />
                AI 对话助手
              </Link>
            </div>

            <p className="mt-3 text-[10px] leading-relaxed text-mf-sidebar-muted">
              转换在本地服务器执行，不上传第三方云盘；大文件请留意浏览器与接口大小限制。
            </p>
          </div>
        </aside>

        {/* Main */}
        <main className="flex min-w-0 flex-1 flex-col">
          {/* Top Bar */}
          <header className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-b border-mf-border bg-mf-surface/90 px-4 py-3 backdrop-blur md:px-8">
            <div className="min-w-0 flex-1 space-y-2">
              <h1 className="font-mono text-lg font-bold tracking-tight text-mf-text md:text-xl">多媒体格式转换</h1>
              <Select
                className="w-full max-w-xs md:hidden"
                value={activeKey}
                onChange={setActiveKey}
                options={mobileSelectOptions}
                size="middle"
              />
            </div>
            <div className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto sm:gap-3">
              <div className="hidden min-w-[200px] flex-1 sm:block md:min-w-[280px]">
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  allowClear
                  placeholder="搜索工具或格式…"
                  className="h-10 rounded-xl"
                />
              </div>
              <Link
                href="/wiki"
                className="mf-focus-ring flex items-center gap-1.5 rounded-lg border border-mf-border px-2.5 py-2 text-xs font-medium text-mf-text transition hover:border-mf-cta hover:text-mf-cta sm:px-3"
              >
                <BookOutlined className="text-sm" />
                <span className="hidden sm:inline">知识库</span>
              </Link>
              <button
                type="button"
                className="mf-focus-ring relative grid size-10 cursor-pointer place-items-center rounded-xl text-mf-muted transition hover:bg-mf-canvas"
                aria-label="通知"
              >
                <BellOutlined />
                <span className="absolute right-2.5 top-2.5 size-2 rounded-full border-2 border-mf-surface bg-mf-danger" />
              </button>
              <button
                type="button"
                className="mf-focus-ring grid size-10 cursor-pointer place-items-center rounded-xl text-mf-muted transition hover:bg-mf-canvas"
                aria-label="帮助"
              >
                <QuestionCircleOutlined />
              </button>
            </div>
          </header>

          <div className="flex flex-1 flex-col gap-8 p-4 md:flex-row md:p-8">
            {active.key === 'svgaTool' ? (
              <SvgaToolProvider>
                <section className="min-w-0 flex-1">
                  <div className="mf-card p-4 md:p-6">
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-[16px] font-semibold text-mf-text">{active.label}</div>
                        <p className="text-[12px] text-mf-muted">{TOOL_DESC[active.key] || '选择工具开始处理。'}</p>
                      </div>
                    </div>
                    <div className="min-w-0">
                      <SvgaToolMain />
                    </div>
                  </div>
                </section>
                <aside className="flex min-h-0 w-full shrink-0 flex-col md:w-[360px]">
                  <div className="mf-card p-5">
                    <div className="flex items-center justify-between">
                      <div className="text-[14px] font-bold text-mf-text">{rightPanelSpec.title}</div>
                      <span className="text-mf-muted">
                        <SettingOutlined />
                      </span>
                    </div>
                    <div className="mt-4 min-h-0 flex-1 space-y-4 text-[12px] text-mf-muted">
                      <SvgaToolEditPanel />
                    </div>
                  </div>
                </aside>
              </SvgaToolProvider>
            ) : active.key === 'vapTool' ? (
              <VapProvider>
                <section className="min-w-0 flex-1">
                  <div className="mf-card p-4 md:p-6">
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-[16px] font-semibold text-mf-text">{active.label}</div>
                        <p className="text-[12px] text-mf-muted">{TOOL_DESC[active.key]}</p>
                      </div>
                    </div>
                    <div className="min-w-0">
                      <VapMain />
                    </div>
                  </div>
                </section>
                <aside className="flex min-h-0 w-full shrink-0 flex-col md:w-[360px]">
                  <div className="mf-card p-5">
                    <div className="flex items-center justify-between">
                      <div className="text-[14px] font-bold text-mf-text">VAP 配置 & 导出</div>
                      <span className="text-mf-muted">
                        <SettingOutlined />
                      </span>
                    </div>
                    <div className="mt-4 min-h-0 flex-1 space-y-4 text-[12px] text-mf-muted">
                      <VapEditPanel />
                    </div>
                  </div>
                </aside>
              </VapProvider>
            ) : (
              <>
                <section className="min-w-0 flex-1">
                  <div className="mf-card p-4 md:p-6">
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-[16px] font-semibold text-mf-text">{active.label}</div>
                        <p className="text-[12px] text-mf-muted">{TOOL_DESC[active.key] || '选择工具开始处理。'}</p>
                      </div>
                    </div>
                    <div className="min-w-0">
                      <active.Component config={activeSettings} onConfigChange={updateActiveSettings} />
                    </div>
                  </div>
                </section>
                <aside className="flex min-h-0 w-full shrink-0 flex-col md:w-[360px]">
                  <div className="mf-card p-5">
                    <div className="flex items-center justify-between">
                      <div className="text-[14px] font-bold text-mf-text">{rightPanelSpec.title}</div>
                      <span className="text-mf-muted">
                        <SettingOutlined />
                      </span>
                    </div>
                    <div className="mt-4 space-y-4 text-[12px] text-mf-muted">
                      {rightPanelSpec.fields.length === 0 ? (
                    <div className="mf-tip">
                      <div className="font-semibold">提示</div>
                      <div className="mt-1 text-[12px] leading-5">当前工具暂未配置右侧联动字段。</div>
                    </div>
                  ) : (
                    rightPanelSpec.fields.map((f) => {
                      const value = activeSettings[f.key];

                      if (f.kind === 'select') {
                        return (
                          <div key={f.key}>
                            <div className="font-semibold text-mf-text">{f.label}</div>
                            <div className="mt-2">
                              <Select
                                value={value}
                                onChange={(v) => updateActiveSettings({ [f.key]: v })}
                                options={f.options}
                                className="w-full"
                                size="middle"
                              />
                            </div>
                          </div>
                        );
                      }

                      if (f.kind === 'slider') {
                        return (
                          <div key={f.key}>
                            <div className="flex items-center justify-between">
                              <div className="font-semibold text-mf-text">{f.label}</div>
                              <div className="text-mf-muted">{String(value)}</div>
                            </div>
                            <div className="mt-2 px-1">
                              <Slider
                                min={f.min}
                                max={f.max}
                                step={f.step}
                                value={typeof value === 'number' ? value : f.min}
                                onChange={(v) => updateActiveSettings({ [f.key]: v })}
                              />
                            </div>
                          </div>
                        );
                      }

                      if (f.kind === 'sliderNullable') {
                        const sliderValue = typeof value === 'number' ? value : 0;
                        return (
                          <div key={f.key}>
                            <div className="flex items-center justify-between">
                              <div className="font-semibold text-mf-text">{f.label}</div>
                              <div className="text-mf-muted">{sliderValue === 0 ? 'Original' : String(sliderValue)}</div>
                            </div>
                            <div className="mt-2 px-1">
                              <Slider
                                min={f.min}
                                max={f.max}
                                step={f.step}
                                value={sliderValue}
                                onChange={(v) => updateActiveSettings({ [f.key]: v === 0 ? null : v })}
                              />
                            </div>
                          </div>
                        );
                      }

                      if (f.kind === 'sliderKbps') {
                        const numeric = typeof value === 'string' ? parseInt(value, 10) : 128;
                        const sliderKbps = Number.isFinite(numeric) ? Math.round(numeric / 1) : 128;
                        return (
                          <div key={f.key}>
                            <div className="flex items-center justify-between">
                              <div className="font-semibold text-mf-text">{f.label}</div>
                              <div className="text-mf-muted">{`${sliderKbps}k`}</div>
                            </div>
                            <div className="mt-2 px-1">
                              <Slider
                                min={f.min}
                                max={f.max}
                                step={f.step}
                                value={sliderKbps}
                                onChange={(v) => updateActiveSettings({ [f.key]: `${v}k` })}
                              />
                            </div>
                          </div>
                        );
                      }

                      if (f.kind === 'switch') {
                        return (
                          <div key={f.key} className="flex items-center justify-between">
                            <div className="font-semibold text-mf-text">{f.label}</div>
                            <Switch checked={Boolean(value)} onChange={(checked) => updateActiveSettings({ [f.key]: checked })} />
                          </div>
                        );
                      }

                      return null;
                    })
                  )}

                  <div className="mf-tip">
                    <div className="font-semibold">提示</div>
                    <div className="mt-1 text-[12px] leading-5">{rightPanelSpec.note}</div>
                    {WIKI_SLUG_BY_TOOL[active.key] && (
                      <Link
                        href={`/wiki/${WIKI_SLUG_BY_TOOL[active.key]}`}
                        className="mt-2 inline-block text-[12px] font-medium underline"
                      >
                        查看操作说明 →
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            </aside>
              </>
            )}
          </div>
        </main>
      </div>

    </div>
  );
};

export default HomePage;