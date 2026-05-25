'use client';

import dynamic from 'next/dynamic';
import ToolPanelSkeleton from './ToolPanelSkeleton';

/** Next 要求 dynamic 第二参数为对象字面量，故用工厂函数 */
function lazyTool(importFn) {
  return dynamic(importFn, {
    loading: () => <ToolPanelSkeleton />,
    ssr: false,
  });
}

export const LazyGifToWebp = lazyTool(() => import('../GifToWebp'));
export const LazyMp4Compress = lazyTool(() => import('../Mp4Compress'));
export const LazyGifToMp4 = lazyTool(() => import('../GifToMp4'));
export const LazyMp4FirstFrame = lazyTool(() => import('../Mp4FirstFrame'));
export const LazyImageCompress = lazyTool(() => import('../ImageCompress'));
export const LazyGifCompress = lazyTool(() => import('../GifCompress'));
export const LazyImageGenerate = lazyTool(() => import('../ImageGenerate'));
export const LazyAssetZipConvert = lazyTool(() => import('../AssetZipConvert'));
export const LazyVideoWatermarkRemover = lazyTool(() => import('../VideoWatermarkRemover'));

export const LazySvgaWorkspace = lazyTool(() => import('./SvgaWorkspace'));
export const LazyVapWorkspace = lazyTool(() => import('./VapWorkspace'));

export const SIMPLE_TOOL_COMPONENTS = {
  gifToWebp: LazyGifToWebp,
  mp4Compress: LazyMp4Compress,
  gifToMp4: LazyGifToMp4,
  mp4FirstFrame: LazyMp4FirstFrame,
  imageCompress: LazyImageCompress,
  gifCompress: LazyGifCompress,
  imageGenerate: LazyImageGenerate,
  assetZipConvert: LazyAssetZipConvert,
  videoWatermark: LazyVideoWatermarkRemover,
};
