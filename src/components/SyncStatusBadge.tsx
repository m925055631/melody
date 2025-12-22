import React from 'react';
import { Cloud, CloudOff, Loader2 } from 'lucide-react';

interface SyncStatusBadgeProps {
    isSyncing: boolean;
    lastSyncTime: Date | null;
    matchedCount?: number;
    totalCount?: number;
}

export const SyncStatusBadge: React.FC<SyncStatusBadgeProps> = ({
    isSyncing,
    lastSyncTime,
    matchedCount = 0,
    totalCount = 0
}) => {
    const formatTime = (date: Date) => {
        const now = new Date();
        const diff = Math.floor((now.getTime() - date.getTime()) / 1000 / 60); // minutes

        if (diff < 1) return '刚刚';
        if (diff < 60) return `${diff}分钟前`;
        if (diff < 1440) return `${Math.floor(diff / 60)}小时前`;
        return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    };

    if (!lastSyncTime && !isSyncing) {
        return null; // No CTFile config
    }

    return (
        <div className="fixed top-20 right-6 z-40">
            <div className={`
        flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium
        backdrop-blur-md border transition-all
        ${isSyncing
                    ? 'bg-blue-500/20 border-blue-400/50 text-blue-300'
                    : 'bg-green-500/20 border-green-400/50 text-green-300'
                }
      `}>
                {isSyncing ? (
                    <>
                        <Loader2 className="w-3 h-3 animate-spin" />
                        <span>同步中...</span>
                    </>
                ) : lastSyncTime ? (
                    <>
                        <Cloud className="w-3 h-3" />
                        <span>{matchedCount}/{totalCount} 首</span>
                        <span className="text-slate-400">·</span>
                        <span className="text-slate-400">{formatTime(lastSyncTime)}</span>
                    </>
                ) : (
                    <>
                        <CloudOff className="w-3 h-3" />
                        <span>未同步</span>
                    </>
                )}
            </div>
        </div>
    );
};
