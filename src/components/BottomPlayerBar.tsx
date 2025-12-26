import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, ChevronUp, Download, Check, Loader2, SkipForward } from 'lucide-react';
import type { Song } from '../types';

interface BottomPlayerBarProps {
  currentSong: Song | null;
  isPlaying: boolean;
  onPlayToggle: () => void;
  onOpenLyrics: () => void;
  onNext?: () => void;
  currentTime?: number;
  duration?: number;
  onSeek?: (time: number) => void;
  onRefreshUrl?: () => Promise<string | null>;
}

const formatTime = (seconds: number): string => {
  if (!seconds || !isFinite(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export const BottomPlayerBar: React.FC<BottomPlayerBarProps> = ({
  currentSong,
  isPlaying,
  onPlayToggle,
  onOpenLyrics,
  onNext,
  currentTime = 0,
  duration = 0,
  onSeek,
  onRefreshUrl
}) => {
  const [downloadState, setDownloadState] = useState<'idle' | 'refreshing' | 'downloading' | 'success'>('idle');
  const [isSeeking, setIsSeeking] = useState(false);
  const [seekTime, setSeekTime] = useState(0);
  const progressBarRef = useRef<HTMLDivElement>(null);

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const displayTime = isSeeking ? seekTime : currentTime;

  // useEffect must always be called before any early returns
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isSeeking || !progressBarRef.current || !onSeek || duration === 0) return;

      const rect = progressBarRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const percentage = Math.max(0, Math.min(1, x / rect.width));
      const newTime = percentage * duration;

      setSeekTime(newTime);
    };

    const handleMouseUp = () => {
      if (isSeeking && onSeek) {
        onSeek(seekTime);
      }
      setIsSeeking(false);
    };

    if (isSeeking) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isSeeking, seekTime, onSeek, duration]);

  if (!currentSong) return null;

  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();

    if (!currentSong.audioUrl || downloadState !== 'idle') return;

    let audioUrl = currentSong.audioUrl;

    // 30-second timeout for entire operation
    const TIMEOUT_MS = 30000;
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('TIMEOUT')), TIMEOUT_MS);
    });

    const downloadOperation = async () => {
      // Always test URL validity first before downloading
      console.log('[Download] Testing URL validity...');
      const testController = new AbortController();
      const testTimeoutId = setTimeout(() => testController.abort(), 5000);

      let needsRefresh = false;
      try {
        const testResponse = await fetch(audioUrl, { method: 'HEAD', signal: testController.signal });
        clearTimeout(testTimeoutId);
        if (!testResponse.ok) {
          console.log('[Download] URL test failed with status:', testResponse.status);
          needsRefresh = true;
        }
      } catch (testError) {
        clearTimeout(testTimeoutId);
        console.log('[Download] URL test failed:', testError);
        needsRefresh = true;
      }

      // Also check if expired by time
      if (!needsRefresh && onRefreshUrl && currentSong.audioUrlUpdatedAt) {
        const updatedAt = new Date(currentSong.audioUrlUpdatedAt).getTime();
        const now = Date.now();
        const SIX_HOURS = 6 * 60 * 60 * 1000;
        if (now - updatedAt >= SIX_HOURS) {
          console.log('[Download] URL expired by time, needs refresh');
          needsRefresh = true;
        }
      }

      // Refresh URL if needed
      if (needsRefresh && onRefreshUrl) {
        setDownloadState('refreshing');
        console.log('[Download] Refreshing URL...');
        const newUrl = await onRefreshUrl();
        if (newUrl) {
          audioUrl = newUrl;
          console.log('[Download] URL refreshed successfully');
        } else {
          throw new Error('无法刷新下载链接');
        }
      }

      setDownloadState('downloading');

      const response = await fetch(audioUrl);
      const blob = await response.blob();

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${currentSong.artist} - ${currentSong.title}.flac`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      setDownloadState('success');
      setTimeout(() => setDownloadState('idle'), 2000);
    };

    try {
      await Promise.race([downloadOperation(), timeoutPromise]);
    } catch (error) {
      console.error('Download failed:', error);
      setDownloadState('idle');

      if (error instanceof Error && error.message === 'TIMEOUT') {
        alert(`下载超时 ⏱️\n\n歌曲 "${currentSong.title}" 下载时间超过30秒。\n\n可能的原因：\n• 网络连接较慢\n• 服务器响应延迟\n• 文件较大\n\n请稍后重试，或检查网络连接。`);
      } else {
        const errorMessage = error instanceof Error ? error.message : '未知错误';
        alert(`下载失败 ❌\n\n${errorMessage}\n\n请检查网络连接或稍后重试。`);
      }
    }
  };

  const handleProgressBarClick = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (!progressBarRef.current || !onSeek || duration === 0) return;

    const rect = progressBarRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, x / rect.width));
    const newTime = percentage * duration;

    onSeek(newTime);
  };

  const handleProgressBarMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressBarRef.current || duration === 0) return;

    const rect = progressBarRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, x / rect.width));
    const hoverTime = percentage * duration;

    setSeekTime(hoverTime);
  };

  const handleProgressBarMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (duration === 0) return;
    setIsSeeking(true);
  };

  const getDownloadIcon = () => {
    switch (downloadState) {
      case 'refreshing':
      case 'downloading':
        return <Loader2 size={18} className="animate-spin" />;
      case 'success':
        return <Check size={18} />;
      default:
        return <Download size={18} />;
    }
  };

  const getDownloadButtonClasses = () => {
    const base = "w-9 h-9 rounded-full flex items-center justify-center transition-all duration-300 relative group/download";

    switch (downloadState) {
      case 'refreshing':
        return `${base} bg-slate-700 text-yellow-400 animate-pulse`;
      case 'downloading':
        return `${base} bg-slate-700 text-neon-accent animate-pulse`;
      case 'success':
        return `${base} bg-green-500/20 text-green-400 scale-110`;
      default:
        return `${base} bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-neon-accent hover:scale-105 active:scale-95`;
    }
  };

  return (
    <div
      className="fixed bottom-0 left-0 w-full z-[60] px-4 pb-4 pt-2"
    >
      <div
        className="max-w-3xl mx-auto bg-slate-900/70 backdrop-blur-xl border border-slate-700/50 rounded-2xl shadow-2xl overflow-hidden"
      >
        {/* Top Section: Info & Main Controls */}
        <div
          className="flex items-center justify-between p-3 cursor-pointer group hover:bg-slate-800/80 transition-colors"
          onClick={onOpenLyrics}
        >
          {/* Left: Info */}
          <div className="flex items-center gap-3 overflow-hidden">
            <div className={`relative w-10 h-10 rounded-full overflow-hidden border border-slate-600 ${isPlaying ? 'animate-[spin_4s_linear_infinite]' : ''}`}>
              <img src={currentSong.coverUrl} alt="cover" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <ChevronUp size={16} className="text-white" />
              </div>
            </div>

            <div className="flex flex-col min-w-0">
              <h4 className="text-white text-sm font-bold truncate pr-4">{currentSong.title}</h4>
              <p className="text-slate-400 text-xs truncate">{currentSong.artist}</p>
            </div>
          </div>

          {/* Right: Controls */}
          <div className="flex items-center gap-3 pr-2">
            {/* Download Button */}
            {currentSong.audioUrl && (
              <button
                onClick={handleDownload}
                disabled={downloadState !== 'idle'}
                className={getDownloadButtonClasses()}
                title={downloadState === 'refreshing' ? '刷新链接中...' : downloadState === 'downloading' ? '下载中...' : downloadState === 'success' ? '下载完成!' : '下载歌曲'}
              >
                {getDownloadIcon()}

                <span className="absolute -top-10 left-1/2 -translate-x-1/2 px-2 py-1 bg-slate-800 text-xs text-white rounded opacity-0 group-hover/download:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                  {downloadState === 'refreshing' ? '刷新链接...' : downloadState === 'downloading' ? '下载中...' : downloadState === 'success' ? '完成!' : '下载'}
                </span>

                {downloadState === 'success' && (
                  <span className="absolute inset-0 rounded-full bg-green-400/30 animate-ping" />
                )}
              </button>
            )}

            {/* Play/Pause Button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onPlayToggle();
              }}
              className="w-10 h-10 rounded-full bg-neon-accent hover:bg-sky-400 text-slate-900 flex items-center justify-center transition-transform hover:scale-105 active:scale-95 shadow-lg shadow-neon-accent/20"
            >
              {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" className="ml-0.5" />}
            </button>

            {/* Next Track Button */}
            {onNext && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onNext();
                }}
                className="w-9 h-9 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-neon-accent flex items-center justify-center transition-all hover:scale-105 active:scale-95 relative group/next"
                title="下一首"
              >
                <SkipForward size={18} />
                <span className="absolute -top-10 left-1/2 -translate-x-1/2 px-2 py-1 bg-slate-800 text-xs text-white rounded opacity-0 group-hover/next:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                  下一首
                </span>
              </button>
            )}
          </div>
        </div>

        {/* Progress Bar Section */}
        {duration > 0 ? (
          <div
            className="px-4 pb-3 pt-1"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              {/* Current Time */}
              <span className="text-xs text-slate-400 font-mono w-10 text-right">
                {formatTime(displayTime)}
              </span>

              {/* Progress Bar */}
              <div
                ref={progressBarRef}
                className="flex-1 h-1.5 bg-slate-700/50 rounded-full cursor-pointer group/progress relative"
                onClick={handleProgressBarClick}
                onMouseMove={handleProgressBarMouseMove}
                onMouseDown={handleProgressBarMouseDown}
              >
                {/* Filled Progress */}
                <div
                  className="h-full bg-gradient-to-r from-neon-accent to-sky-400 rounded-full transition-all relative"
                  style={{ width: `${isSeeking ? (seekTime / duration) * 100 : progress}%` }}
                >
                  {/* Seek Handle */}
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-lg opacity-0 group-hover/progress:opacity-100 transition-opacity" />
                </div>

                {/* Hover Preview Line */}
                <div
                  className="absolute top-0 h-full w-0.5 bg-white/30 opacity-0 group-hover/progress:opacity-100 transition-opacity pointer-events-none"
                  style={{
                    left: isSeeking
                      ? `${(seekTime / duration) * 100}%`
                      : undefined
                  }}
                />
              </div>

              {/* Duration */}
              <span className="text-xs text-slate-400 font-mono w-10">
                {formatTime(duration)}
              </span>
            </div>
          </div>
        ) : (
          /* Loading State - Show when audio is still loading */
          <div className="px-4 pb-3 pt-1">
            <div className="flex items-center justify-center gap-2">
              <Loader2 size={14} className="animate-spin text-neon-accent" />
              <span className="text-xs text-slate-400">请求播放中，请稍后...</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};