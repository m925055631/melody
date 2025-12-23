
import { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';

// Using a royalty-free generic placeholder sound for demonstration
const DEFAULT_AUDIO_URL = "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3";

interface AudioPlayerProps {
  isPlaying: boolean;
  volume: number;
  src?: string;
  onEnded?: () => void;
  onTimeUpdate?: (currentTime: number, duration: number) => void;
}

export interface AudioPlayerHandle {
  seek: (time: number) => void;
  getCurrentTime: () => number;
  getDuration: () => number;
}

export const AudioPlayer = forwardRef<AudioPlayerHandle, AudioPlayerProps>(
  ({ isPlaying, volume, src, onEnded, onTimeUpdate }, ref) => {
    const audioRef = useRef<HTMLAudioElement>(null);
    const audioSrc = src || DEFAULT_AUDIO_URL;

    // Expose methods to parent component
    useImperativeHandle(ref, () => ({
      seek: (time: number) => {
        if (audioRef.current) {
          audioRef.current.currentTime = time;
        }
      },
      getCurrentTime: () => audioRef.current?.currentTime || 0,
      getDuration: () => audioRef.current?.duration || 0,
    }));

    useEffect(() => {
      if (audioRef.current) {
        if (isPlaying) {
          // Reset play logic when source changes if needed, but HTML audio handles src change well usually
          const playPromise = audioRef.current.play();
          if (playPromise !== undefined) {
            playPromise.catch(error => {
              console.log("Autoplay prevented or interrupted:", error);
            });
          }
        } else {
          audioRef.current.pause();
        }
      }
    }, [isPlaying, audioSrc]);

    useEffect(() => {
      if (audioRef.current) {
        audioRef.current.volume = volume;
      }
    }, [volume]);

    const handleTimeUpdate = () => {
      if (audioRef.current && onTimeUpdate) {
        onTimeUpdate(audioRef.current.currentTime, audioRef.current.duration || 0);
      }
    };

    return (
      <audio
        ref={audioRef}
        src={audioSrc}
        loop={false}
        onEnded={onEnded}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleTimeUpdate}
      />
    );
  }
);
