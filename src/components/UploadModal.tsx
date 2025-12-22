
import React, { useState, useRef } from 'react';
import { X, Upload, Music, Image as ImageIcon, Loader2 } from 'lucide-react';
import type { Song } from '../types';
import { fileToBase64 } from '../services/storage';

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpload: (song: Song) => void;
}

export const UploadModal: React.FC<UploadModalProps> = ({ isOpen, onClose, onUpload }) => {
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(1);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const coverInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleCoverChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setCoverFile(file);
      // For preview, object URL is fine (faster), we convert to base64 on submit
      setCoverPreview(URL.createObjectURL(file));
    }
  };

  const handleAudioChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAudioFile(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);

    try {
      // Convert Files to Base64 for persistence
      let coverUrl = `https://picsum.photos/seed/${title}/300/300`;
      if (coverFile) {
        coverUrl = await fileToBase64(coverFile);
      }

      let audioUrl = undefined;
      if (audioFile) {
        audioUrl = await fileToBase64(audioFile);
      }
      
      // Format Date
      const releaseDate = `${year}-${String(month).padStart(2, '0')}-01`;

      const newSong: Song = {
        id: `user-${Date.now()}`,
        title: title || '未知歌曲',
        artist: artist || '未知歌手',
        releaseDate,
        popularity: 80, // Default popularity for uploaded songs
        coverUrl,
        audioUrl,
        description: '用户上传的自定义歌曲。'
      };

      onUpload(newSong);
      onClose();
      
      // Reset form
      setTitle('');
      setArtist('');
      setYear(new Date().getFullYear());
      setCoverFile(null);
      setAudioFile(null);
      setCoverPreview(null);
    } catch (error) {
      console.error("Error processing files:", error);
      alert("处理文件时出错，可能是文件过大。");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      
      {/* Modal Content */}
      <div className="relative bg-slate-900/90 border border-slate-700 w-full max-w-md rounded-2xl p-6 shadow-2xl overflow-hidden animate-[pulse-slow_0.5s_ease-out]">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-purple-500"></div>
        
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors"
        >
          <X size={24} />
        </button>

        <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
          <Upload size={24} className="text-neon-accent" />
          上传歌曲
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1">歌名</label>
              <input 
                type="text" 
                required
                value={title}
                onChange={e => setTitle(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:border-neon-accent focus:outline-none"
                placeholder="Song Title"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">歌手</label>
              <input 
                type="text" 
                required
                value={artist}
                onChange={e => setArtist(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:border-neon-accent focus:outline-none"
                placeholder="Artist"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
             <div>
              <label className="block text-xs text-slate-400 mb-1">年份</label>
              <input 
                type="number" 
                min="2000"
                max={new Date().getFullYear()}
                value={year}
                onChange={e => setYear(parseInt(e.target.value))}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:border-neon-accent focus:outline-none"
              />
            </div>
             <div>
              <label className="block text-xs text-slate-400 mb-1">月份</label>
              <input 
                type="number" 
                min="1"
                max="12"
                value={month}
                onChange={e => setMonth(parseInt(e.target.value))}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:border-neon-accent focus:outline-none"
              />
            </div>
          </div>

          <div className="space-y-3 pt-2">
            {/* Cover Upload */}
            <div 
              className="border-2 border-dashed border-slate-700 rounded-lg p-4 flex flex-col items-center justify-center cursor-pointer hover:border-neon-accent hover:bg-slate-800/50 transition-all group"
              onClick={() => coverInputRef.current?.click()}
            >
              <input type="file" ref={coverInputRef} className="hidden" accept="image/*" onChange={handleCoverChange} />
              {coverPreview ? (
                <div className="relative w-full h-32">
                   <img src={coverPreview} alt="Preview" className="w-full h-full object-contain rounded" />
                   <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity">
                     <span className="text-white text-xs">更改封面</span>
                   </div>
                </div>
              ) : (
                <>
                  <ImageIcon className="text-slate-500 mb-2 group-hover:text-neon-accent" />
                  <span className="text-xs text-slate-400">点击上传封面图片</span>
                </>
              )}
            </div>

            {/* Audio Upload */}
            <div 
              className={`border border-slate-700 rounded-lg p-3 flex items-center justify-between cursor-pointer hover:bg-slate-800 transition-colors ${audioFile ? 'border-green-500/50 bg-green-900/10' : ''}`}
              onClick={() => audioInputRef.current?.click()}
            >
              <input type="file" ref={audioInputRef} className="hidden" accept="audio/*" onChange={handleAudioChange} />
              <div className="flex items-center gap-2">
                 <Music className={audioFile ? "text-green-400" : "text-slate-500"} size={18} />
                 <span className={`text-sm ${audioFile ? "text-green-400" : "text-slate-400"}`}>
                   {audioFile ? audioFile.name : "选择音频文件 (MP3/WAV)..."}
                 </span>
              </div>
              <div className="bg-slate-700 text-xs px-2 py-1 rounded text-slate-300">浏览</div>
            </div>
          </div>

          <button 
            type="submit"
            disabled={isProcessing}
            className="w-full bg-neon-accent hover:bg-sky-400 text-slate-900 font-bold py-3 rounded-lg mt-4 transition-transform active:scale-95 shadow-lg shadow-neon-accent/20 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isProcessing ? <Loader2 className="animate-spin" size={20} /> : null}
            {isProcessing ? "处理中..." : "添加到时间轴"}
          </button>
        </form>
      </div>
    </div>
  );
};
