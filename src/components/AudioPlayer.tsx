
import React, { useEffect, useRef } from 'react';

// Using a royalty-free generic placeholder sound for demonstration
const DEFAULT_AUDIO_URL = "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3";

interface AudioPlayerProps {
  isPlaying: boolean;
  volume: number;
  src?: string;
  loop?: boolean;
  onEnded?: () => void;
  onTimeUpdate?: (currentTime: number, duration: number) => void;
}

export const AudioPlayer: React.FC<AudioPlayerProps> = ({
  isPlaying,
  volume,
  src,
  loop = false,
  onEnded,
  onTimeUpdate
}) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const audioSrc = src || DEFAULT_AUDIO_URL;

  useEffect(() => {
    if (audioRef.current) {
      if (isPlaying) {
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

  // Handle time updates
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => {
      if (onTimeUpdate) {
        onTimeUpdate(audio.currentTime, audio.duration || 0);
      }
    };

    const handleLoadedMetadata = () => {
      if (onTimeUpdate) {
        onTimeUpdate(audio.currentTime, audio.duration || 0);
      }
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
    };
  }, [onTimeUpdate]);

  return (
    <audio
      ref={audioRef}
      src={audioSrc}
      loop={loop}
      onEnded={onEnded}
    />
  );
};

// Export seek helper for parent components
export const seekAudio = (audioElement: HTMLAudioElement | null, time: number) => {
  if (audioElement) {
    audioElement.currentTime = time;
  }
};
