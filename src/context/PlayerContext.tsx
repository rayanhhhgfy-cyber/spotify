import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { Song } from '../types';
import { recordPlay } from '../api';

interface PlayerContextType {
  currentSong: Song | null;
  queue: Song[];
  isPlaying: boolean;
  progress: number;
  duration: number;
  volume: number;
  isShuffle: boolean;
  repeatMode: 'off' | 'all' | 'one';
  playSong: (song: Song, newQueue?: Song[]) => void;
  shufflePlay: (songs: Song[]) => void;
  togglePlay: () => void;
  nextSong: () => void;
  prevSong: () => void;
  seek: (time: number) => void;
  setVolume: (vol: number) => void;
  toggleShuffle: () => void;
  toggleRepeat: () => void;
  reorderQueue: (startIndex: number, endIndex: number) => void;
}

const PlayerContext = createContext<PlayerContextType | null>(null);

export const PlayerProvider = ({ children }: { children: React.ReactNode }) => {
  const [currentSong, setCurrentSong] = useState<Song | null>(null);
  const [queue, setQueue] = useState<Song[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(1);
  const [isShuffle, setIsShuffle] = useState(false);
  const [repeatMode, setRepeatMode] = useState<'off' | 'all' | 'one'>('off');

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return;
      switch(e.code) {
        case 'Space':
          e.preventDefault();
          handlersRef.current.togglePlay();
          break;
        case 'ArrowRight':
          if (e.shiftKey) handlersRef.current.nextSong();
          else if (audioRef.current) handlersRef.current.seek(audioRef.current.currentTime + 10);
          break;
        case 'ArrowLeft':
          if (e.shiftKey) handlersRef.current.prevSong();
          else if (audioRef.current) handlersRef.current.seek(Math.max(0, audioRef.current.currentTime - 10));
          break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const reorderQueue = (startIndex: number, endIndex: number) => {
    setQueue(prev => {
      const result = Array.from(prev);
      const [removed] = result.splice(startIndex, 1);
      result.splice(endIndex, 0, removed);
      return result;
    });
  };
  const [audioReadyForId, setAudioReadyForId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const playPromiseRef = useRef<Promise<void> | void>();
  const currentSongRef = useRef<Song | null>(null);
  const currentMirrorIndexRef = useRef<number>(0);
  
  // Keep track of latest functions for MediaSession and handlers
  const handlersRef = useRef({ togglePlay: () => {}, nextSong: () => {}, prevSong: () => {}, seek: (t: number) => {} });

  useEffect(() => {
    currentSongRef.current = currentSong;
  }, [currentSong]);

  const handleAudioError = () => {
    if (!currentSongRef.current || !audioRef.current) return;
    const song = currentSongRef.current;
    const candidates = song.streamMirrors && song.streamMirrors.length > 0 ? song.streamMirrors : [song.audioUrl];
    
    if (currentMirrorIndexRef.current + 1 < candidates.length) {
      currentMirrorIndexRef.current += 1;
      const nextUrl = candidates[currentMirrorIndexRef.current];
      if (nextUrl) {
        audioRef.current.src = nextUrl;
        audioRef.current.load();
        safePlay();
        return;
      }
    }
    
    // If all mirrors fail, advance to next track in queue smoothly
    console.warn(`All stream sources for "${song.title}" were unavailable. Skipping to next song.`);
    handlersRef.current.nextSong();
  };

  const safePlay = () => {
    if (!audioRef.current) return;
    try {
      const promise = audioRef.current.play();
      if (promise !== undefined) {
        playPromiseRef.current = promise;
        promise.catch((e: any) => {
          if (e.name === 'NotAllowedError') {
            setIsPlaying(false);
            return;
          }
          if (e.name === 'AbortError') {
            return;
          }
          if (e.name === 'NotSupportedError') {
            handleAudioError();
            return;
          }
          console.warn("Playback warning:", e.message || e);
        });
      }
    } catch (e) {
      console.warn("Sync play error:", e);
    }
  };

  const playSong = (song: Song, newQueue: Song[] = []) => {
    recordPlay(song);
    if (newQueue.length > 0) {
      setQueue(newQueue);
    } else if (queue.length === 0) {
      setQueue([song]);
    }
    
    setCurrentSong(song);
    currentSongRef.current = song;
    currentMirrorIndexRef.current = 0;
    setIsPlaying(true);
    
    if (audioRef.current) {
      const candidates = song.streamMirrors && song.streamMirrors.length > 0 ? song.streamMirrors : [song.audioUrl];
      audioRef.current.src = candidates[0];
      audioRef.current.load();
      safePlay();
    }
  };

  const shufflePlay = (songs: Song[]) => {
    if (!songs || songs.length === 0) return;
    const shuffled = [...songs].sort(() => Math.random() - 0.5);
    setIsShuffle(true);
    setQueue(shuffled);

    const firstSong = shuffled[0];
    recordPlay(firstSong);
    setCurrentSong(firstSong);
    currentSongRef.current = firstSong;
    currentMirrorIndexRef.current = 0;
    setIsPlaying(true);

    if (audioRef.current) {
      const candidates = firstSong.streamMirrors && firstSong.streamMirrors.length > 0 ? firstSong.streamMirrors : [firstSong.audioUrl];
      audioRef.current.src = candidates[0];
      audioRef.current.load();
      safePlay();
    }
  };

  const _playDirectly = (song: Song) => {
    recordPlay(song);
    setCurrentSong(song);
    currentSongRef.current = song;
    currentMirrorIndexRef.current = 0;
    setIsPlaying(true);
    if (audioRef.current) {
      const candidates = song.streamMirrors && song.streamMirrors.length > 0 ? song.streamMirrors : [song.audioUrl];
      audioRef.current.src = candidates[0];
      audioRef.current.load();
      safePlay();
    }
  };

  const togglePlay = () => {
    if (!currentSong || !audioRef.current) return;
    
    if (isPlaying) {
      setIsPlaying(false);
      if (playPromiseRef.current !== undefined) {
        playPromiseRef.current.then(() => {
          audioRef.current?.pause();
        }).catch(() => {
          audioRef.current?.pause();
        });
      } else {
        audioRef.current.pause();
      }
    } else {
      setIsPlaying(true);
      safePlay();
    }
  };

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  const toggleShuffle = () => setIsShuffle(!isShuffle);
  
  const toggleRepeat = () => {
    setRepeatMode(prev => {
      if (prev === 'off') return 'all';
      if (prev === 'all') return 'one';
      return 'off';
    });
  };

  useEffect(() => {
    handlersRef.current = { togglePlay, nextSong, prevSong, seek };
  });

  useEffect(() => {
    if ('mediaSession' in navigator && currentSong) {
      try {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: currentSong.title,
          artist: currentSong.artist,
          album: currentSong.album,
          artwork: [
            { src: currentSong.coverUrl || 'https://upload.wikimedia.org/wikipedia/commons/1/19/Spotify_logo_without_text.svg', sizes: '300x300', type: 'image/jpeg' },
            { src: (currentSong.coverUrl || 'https://upload.wikimedia.org/wikipedia/commons/1/19/Spotify_logo_without_text.svg').replace('300x300', '600x600'), sizes: '600x600', type: 'image/jpeg' }
          ]
        });
        
        navigator.mediaSession.setActionHandler('play', () => handlersRef.current.togglePlay());
        navigator.mediaSession.setActionHandler('pause', () => handlersRef.current.togglePlay());
        navigator.mediaSession.setActionHandler('previoustrack', () => handlersRef.current.prevSong());
        navigator.mediaSession.setActionHandler('nexttrack', () => handlersRef.current.nextSong());
        navigator.mediaSession.setActionHandler('seekto', (details) => {
          if (details.seekTime !== undefined) handlersRef.current.seek(details.seekTime);
        });
      } catch (e) {
        console.warn("Media session actions not supported", e);
      }
    }
  }, [currentSong]);

  const nextSong = () => {
     if (!currentSong || queue.length === 0) return;
     
     if (repeatMode === 'one') {
       if (audioRef.current) {
         audioRef.current.currentTime = 0;
         audioRef.current.play().catch(e => console.error(e));
       }
       return;
     }

     let idx = queue.findIndex(s => s.id === currentSong.id);
     
     if (isShuffle) {
        const nextIdx = Math.floor(Math.random() * queue.length);
        _playDirectly(queue[nextIdx]);
        return;
     }

     if (idx !== -1 && idx < queue.length - 1) {
        _playDirectly(queue[idx + 1]);
     } else if (repeatMode === 'all') {
        _playDirectly(queue[0]);
     } else {
        // End of queue
        setIsPlaying(false);
        setProgress(0);
     }
  };

  const prevSong = () => {
     if (!currentSong || queue.length === 0) return;
     const idx = queue.findIndex(s => s.id === currentSong.id);
     if (progress > 3) {
        // Seek to start if played for more than 3 seconds
        if (audioRef.current) audioRef.current.currentTime = 0;
     } else if (idx > 0) {
        _playDirectly(queue[idx - 1]);
     }
  };

  const seek = (time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setProgress(time);
    }
  };

  const setVolume = (vol: number) => {
    setVolumeState(Math.max(0, Math.min(1, vol)));
  };

  return (
    <PlayerContext.Provider
      value={{
        currentSong,
        queue,
        isPlaying,
        progress,
        duration,
        volume,
        isShuffle,
        repeatMode,
        playSong,
        shufflePlay,
        togglePlay,
        nextSong,
        prevSong,
        seek,
        setVolume,
        toggleShuffle,
        toggleRepeat,
        reorderQueue
      }}
    >
      {children}
      <audio
        ref={audioRef}
        onTimeUpdate={(e) => setProgress(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        onEnded={nextSong}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onError={handleAudioError}
      />
    </PlayerContext.Provider>
  );
};

export const usePlayer = () => {
  const context = useContext(PlayerContext);
  if (!context) throw new Error('usePlayer must be used within PlayerProvider');
  return context;
};
