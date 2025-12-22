import React from 'react';
import { Users, Eye } from 'lucide-react';

interface VisitorStatsProps {
    totalVisits: number;
    activeUsers: number;
}

export const VisitorStats: React.FC<VisitorStatsProps> = ({ totalVisits, activeUsers }) => {
    return (
        <div className="fixed top-6 left-6 z-50 flex items-center gap-4 text-slate-400 text-sm font-mono">
            <div className="flex items-center gap-1.5 opacity-50 hover:opacity-100 transition-opacity">
                <Eye size={14} className="opacity-60" />
                <span>{totalVisits.toLocaleString()}</span>
            </div>
            <div className="flex items-center gap-1.5 opacity-50 hover:opacity-100 transition-opacity">
                <Users size={14} className="opacity-60" />
                <span>{activeUsers}</span>
            </div>
        </div>
    );
};
