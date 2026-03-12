'use client';
import React, { useMemo, useState } from 'react';
import { Input, Select, Slider, Switch } from 'antd';
import {
  SwapOutlined,
  CompressOutlined,
  VideoCameraOutlined,
  PictureOutlined,
  FileImageOutlined,
  EditOutlined,
  SettingOutlined,
  BellOutlined,
  QuestionCircleOutlined,
} from '@ant-design/icons';
import GifToWebp from './components/GifToWebp';
import Mp4Compress from './components/Mp4Compress';
import GifToMp4 from './components/GifToMp4';
import Mp4FirstFrame from './components/Mp4FirstFrame';
import ImageCompress from './components/ImageCompress';
import GifCompress from './components/GifCompress';
import ImageGenerate from './components/ImageGenerate';
import AiChatAssistant from './components/AiChatAssistant';

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
    ],
    []
  );

  const active = useMemo(
    () => navItems.find((it) => it.key === activeKey) ?? navItems[0],
    [activeKey, navItems]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return navItems;
    return navItems.filter((it) => it.label.toLowerCase().includes(q));
  }, [navItems, query]);

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
    <div className="min-h-screen bg-[#f8fafd]">
      <div className="mx-auto flex min-h-screen w-full max-w-[1440px]">
        {/* Left Sidebar */}
        <aside className="hidden w-[288px] shrink-0 flex-col border-r border-[#1e293b] bg-[#0f172a] md:flex">
          <div className="flex items-center gap-3 p-6">
            <div className="grid size-10 place-items-center rounded-2xl bg-[linear-gradient(135deg,#6366f1_0%,#a855f7_100%)]">
              <span className="text-sm font-bold text-white">MF</span>
            </div>
            <div className="leading-tight">
              <div className="text-[20px] font-bold tracking-[-0.5px] text-white">MediaFlow</div>
              <div className="text-[12px] font-medium uppercase tracking-[0.6px] text-[#94a3b8]">
                Pro Edition
              </div>
            </div>
          </div>

          <nav className="flex-1 px-4">
            <div className="flex flex-col gap-1">
              {filtered.map((it) => {
                const isActive = it.key === active.key;
                return (
                  <button
                    key={it.key}
                    type="button"
                    onClick={() => setActiveKey(it.key)}
                    className={[
                      'flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left transition',
                      isActive ? 'bg-[rgba(99,102,241,0.10)]' : 'hover:bg-white/5',
                    ].join(' ')}
                  >
                    <span className="text-[#94a3b8]">{it.icon}</span>
                    <span className={['text-[16px]', isActive ? 'font-semibold text-white' : 'text-[#94a3b8]'].join(' ')}>
                      {it.label}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="mt-6 px-4 text-[10px] font-bold uppercase tracking-[1px] text-[#64748b]">
              Experimental
            </div>
            <button
              type="button"
              className="mt-2 flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left hover:bg-white/5"
            >
              <span className="flex items-center gap-3 text-[#94a3b8]">
                <span className="grid size-[22px] place-items-center rounded-md bg-white/5">
                  <EditOutlined />
                </span>
                <span className="text-[16px]">AI 对话助手</span>
              </span>
              <span className="rounded-full bg-[linear-gradient(135deg,#6366f1_0%,#a855f7_100%)] px-2 py-[2px] text-[10px] font-bold text-white">
                NEW
              </span>
            </button>
          </nav>

          <div className="border-t border-[#1e293b] p-4">
            <div className="rounded-2xl p-4">
              <div className="text-[12px] font-semibold text-white">Cloud Storage</div>
              <div className="mt-2 h-[6px] overflow-hidden rounded-full bg-[#e2e8f0]">
                <div className="h-full w-2/3 bg-[linear-gradient(135deg,#6366f1_0%,#a855f7_100%)]" />
              </div>
              <div className="mt-1 text-[10px] text-[#94a3b8]">12.4 GB of 20 GB used</div>
            </div>

            <div className="mt-4 flex items-center gap-3 rounded-2xl px-2 py-2">
              <div className="grid size-10 place-items-center overflow-hidden rounded-full bg-[#e2e8f0] text-xs font-bold text-[#0f172a]">
                AR
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[14px] font-bold text-white">Alex Rivera</div>
                <div className="truncate text-[12px] text-[#94a3b8]">Pro Member</div>
              </div>
              <button type="button" className="grid size-10 place-items-center rounded-xl text-[#94a3b8] hover:bg-white/5">
                <SettingOutlined />
              </button>
            </div>
          </div>
        </aside>

        {/* Main */}
        <main className="flex min-w-0 flex-1 flex-col">
          {/* Top Bar */}
          <header className="sticky top-0 z-10 flex h-20 items-center justify-between border-b border-[#e2e8f0] bg-white/80 px-4 backdrop-blur md:px-8">
            <div className="text-[20px] font-bold tracking-[-0.5px] text-[#0f172a]">多媒体格式转换工具</div>
            <div className="flex items-center gap-4">
              <div className="w-[280px] md:w-[320px]">
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  allowClear
                  placeholder="Search for tools or formats..."
                  className="h-10 rounded-2xl"
                />
              </div>
              <button type="button" className="relative grid size-10 place-items-center rounded-xl hover:bg-slate-100">
                <BellOutlined />
                <span className="absolute right-[10px] top-[10px] size-2 rounded-full border-2 border-white bg-[#ef4444]" />
              </button>
              <button type="button" className="grid size-10 place-items-center rounded-xl hover:bg-slate-100">
                <QuestionCircleOutlined />
              </button>
            </div>
          </header>

          <div className="flex flex-1 flex-col gap-8 p-4 md:flex-row md:p-8">
            {/* Content */}
            <section className="min-w-0 flex-1">
              <div className="rounded-2xl border border-[#e2e8f0] bg-white p-4 md:p-6">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-[16px] font-semibold text-[#0f172a]">{active.label}</div>
                    <div className="text-[12px] text-slate-500">在左侧切换工具，保留原功能，仅按设计稿换壳。</div>
                  </div>
                </div>
                <div className="min-w-0">
                  <active.Component config={activeSettings} onConfigChange={updateActiveSettings} />
                </div>
              </div>
            </section>

            {/* Right Panel: 转换设置 */}
            <aside className="flex min-h-0 w-full shrink-0 flex-col md:w-[360px]">
              <div className="rounded-2xl border border-[#e2e8f0] bg-white p-5">
                <div className="flex items-center justify-between">
                  <div className="text-[14px] font-bold text-[#0f172a]">{rightPanelSpec.title}</div>
                  <span className="text-slate-400">
                    <SettingOutlined />
                  </span>
                </div>
                <div className="mt-4 space-y-4 text-[12px] text-slate-600">
                  {rightPanelSpec.fields.length === 0 ? (
                    <div className="rounded-2xl bg-[#eef2ff] p-4 text-[#4338ca]">
                      <div className="font-semibold">提示</div>
                      <div className="mt-1 text-[12px] leading-5">当前工具暂未配置右侧联动字段。</div>
                    </div>
                  ) : (
                    rightPanelSpec.fields.map((f) => {
                      const value = activeSettings[f.key];

                      if (f.kind === 'select') {
                        return (
                          <div key={f.key}>
                            <div className="font-semibold text-slate-700">{f.label}</div>
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
                              <div className="font-semibold text-slate-700">{f.label}</div>
                              <div className="text-slate-500">{String(value)}</div>
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
                              <div className="font-semibold text-slate-700">{f.label}</div>
                              <div className="text-slate-500">{sliderValue === 0 ? 'Original' : String(sliderValue)}</div>
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
                              <div className="font-semibold text-slate-700">{f.label}</div>
                              <div className="text-slate-500">{`${sliderKbps}k`}</div>
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
                            <div className="font-semibold text-slate-700">{f.label}</div>
                            <Switch checked={Boolean(value)} onChange={(checked) => updateActiveSettings({ [f.key]: checked })} />
                          </div>
                        );
                      }

                      return null;
                    })
                  )}

                  <div className="rounded-2xl bg-[#eef2ff] p-4 text-[#4338ca]">
                    <div className="font-semibold">提示</div>
                    <div className="mt-1 text-[12px] leading-5">{rightPanelSpec.note}</div>
                  </div>
                </div>
              </div>
            </aside>
          </div>
        </main>
      </div>

      {/* 右下角悬浮 AI 助手（独立于布局） */}
      <AiChatAssistant />
    </div>
  );
};

export default HomePage;