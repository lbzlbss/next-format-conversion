'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { normalizeVapConfigForPlayer } from '../lib/vap-config';

/**
 * 基于 video-animation-player（腾讯 VAP WebGL）的预览播放器
 */
export function useVapWebglPlayer() {
  const containerRef = useRef(null);
  const vapInstanceRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [hasAlpha, setHasAlpha] = useState(false);
  const [canPlay, setCanPlay] = useState(false);
  const [webglSupported, setWebglSupported] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const syncTimeFromVideo = useCallback(() => {
    const v = vapInstanceRef.current?.video;
    if (!v) return;
    if (Number.isFinite(v.duration)) setDuration(v.duration);
    if (Number.isFinite(v.currentTime)) setCurrentTime(v.currentTime);
  }, []);

  const destroy = useCallback(() => {
    if (vapInstanceRef.current) {
      try {
        vapInstanceRef.current.destroy?.();
      } catch {
        /* ignore */
      }
      vapInstanceRef.current = null;
    }
    if (containerRef.current) {
      containerRef.current.replaceChildren();
    }
    setPlaying(false);
    setCanPlay(false);
    setLoadError(null);
  }, []);

  const load = useCallback(
    async (srcUrl, rawConfig) => {
      destroy();
      const container = containerRef.current;
      if (!container || !srcUrl) return;

      const config = normalizeVapConfigForPlayer(rawConfig);
      if (!config) {
        setHasAlpha(false);
        setCanPlay(false);
        setLoadError('缺少 vapc 配置，无法使用 VAP WebGL 合成');
        return;
      }

      setHasAlpha(true);
      setLoadError(null);
      setDuration(0);
      setCurrentTime(0);

      try {
        const mod = await import('video-animation-player');
        const Vap = mod.default;
        const canWebGL = typeof mod.canWebGL === 'function' ? mod.canWebGL() : true;
        setWebglSupported(canWebGL);

        const { info } = config;
        const instance = Vap({
          container,
          src: srcUrl,
          config,
          width: info.w,
          height: info.h,
          fps: info.fps,
          mute: true,
          loop: true,
          type: 0,
          accurate: true,
          precache: false,
          onLoadError: (e) => {
            setLoadError(e?.message || 'VAP 资源加载失败');
            setCanPlay(false);
          },
        });

        vapInstanceRef.current = instance;

        if (typeof instance.on === 'function') {
          instance.on('playing', () => {
            setPlaying(true);
            setCanPlay(true);
            syncTimeFromVideo();
          });
          instance.on('pause', () => setPlaying(false));
          instance.on('ended', () => setPlaying(false));
          instance.on('loadedmetadata', () => {
            setCanPlay(true);
            syncTimeFromVideo();
          });
          instance.on('frame', () => syncTimeFromVideo());
        }

        instance.play?.();
      } catch (e) {
        console.error('[vap-webgl]', e);
        setLoadError(e?.message || 'VAP 播放器初始化失败');
        setCanPlay(false);
      }
    },
    [destroy, syncTimeFromVideo],
  );

  const play = useCallback(() => {
    try {
      vapInstanceRef.current?.play?.();
      setPlaying(true);
    } catch (e) {
      console.error('[vap-webgl] play', e);
    }
  }, []);

  const pause = useCallback(() => {
    try {
      vapInstanceRef.current?.pause?.();
      setPlaying(false);
    } catch (e) {
      console.error('[vap-webgl] pause', e);
    }
  }, []);

  const seekTo = useCallback(
    (t) => {
      const inst = vapInstanceRef.current;
      if (!inst) return;
      try {
        if (typeof inst.setTime === 'function') {
          inst.setTime(t);
        } else if (inst.video) {
          inst.video.currentTime = t;
        }
        syncTimeFromVideo();
      } catch (e) {
        console.error('[vap-webgl] seek', e);
      }
    },
    [syncTimeFromVideo],
  );

  useEffect(() => () => destroy(), [destroy]);

  return {
    containerRef,
    playing,
    duration,
    currentTime,
    hasAlpha,
    canPlay,
    webglSupported,
    loadError,
    load,
    play,
    pause,
    seekTo,
    destroy,
  };
}
