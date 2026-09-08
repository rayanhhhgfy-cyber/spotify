import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { Song } from '../types';
import { recordPlay, resolveFullLengthStream } from '../api';

interface PlayerContextType {
  currentSong: Song | null;
  queue: Song[];
  isPlaying: boolean;
  progress: number;
  duration: number;
  volume: number;
  isShuffle: boolean;
  repeatMode: 'off' | 'all' | 'one';
  isExpanded: boolean;
  setIsExpanded: (expanded: boolean) => void;
  playSong: (song: Song, newQueue?: Song[], autoExpand?: boolean) => void;
  shufflePlay: (songs: Song[]) => void;
  togglePlay: () => void;
  nextSong: () => void;
  prevSong: () => void;
  seek: (time: number) => void;
  setVolume: (vol: number) => void;
  toggleShuffle: () => void;
  toggleRepeat: () => void;
  reorderQueue: (startIndex: number, endIndex: number) => void;
  removeFromQueue: (songId: string) => void;
  clearQueue: () => void;
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
  const [repeatMode, setRepeatMode] = useState<'off' | 'all' | 'one'>('all');
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeEngine, setActiveEngine] = useState<'youtube' | 'audio'>('audio');

  const audioRef = useRef<HTMLAudioElement>(null);
  const ytPlayerRef = useRef<any>(null);
  const ytReadyRef = useRef<boolean>(false);
  const playPromiseRef = useRef<Promise<void> | void>();
  const currentSongRef = useRef<Song | null>(null);
  const currentMirrorIndexRef = useRef<number>(0);
  const repeatModeRef = useRef<'off' | 'all' | 'one'>('all');
  const isPlayingRef = useRef<boolean>(false);
  const userInitiatedPauseRef = useRef<boolean>(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const prewarmedTrackIdRef = useRef<string | null>(null);
  const activeEngineRef = useRef<'youtube' | 'audio'>('audio');

  useEffect(() => {
    activeEngineRef.current = activeEngine;
  }, [activeEngine]);

  useEffect(() => {
    repeatModeRef.current = repeatMode;
  }, [repeatMode]);

  useEffect(() => {
    currentSongRef.current = currentSong;
  }, [currentSong]);

  // Keep iOS / Android / Desktop audio session actively authorized in background
  const applyAudioSessionPlayback = () => {
    if (typeof navigator !== 'undefined' && 'audioSession' in navigator) {
      try {
        (navigator as any).audioSession.type = 'playback';
      } catch (e) {}
    }
  };

  useEffect(() => {
    applyAudioSessionPlayback();
  }, []);

  const ensureAudioSessionActive = () => {
    applyAudioSessionPlayback();
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
          audioContextRef.current = new AudioCtx();
        }
        if (audioContextRef.current.state === 'suspended') {
          audioContextRef.current.resume().catch(() => {});
        }
      }
    } catch (e) {}

    // CRITICAL FIX: If using YouTube engine, play a silent loop on the native audio element to keep iOS background media session alive
    if (activeEngineRef.current === 'youtube' && audioRef.current) {
      if (!audioRef.current.src || !audioRef.current.src.includes('data:audio/mpeg')) {
        audioRef.current.src = 'data:audio/mpeg;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU5LjI3LjEwMAAAAAAAAAAAAAAA//OEAAAAAAAAAAAAAAAAAAAAAAAASW5mbwAAAA8AAAAEAAABIwBRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFR//NVAAAAA0AAAAgAAAADhABAAABAAACdSAwAAAAAAAAAAAAAAH//NRAAAAAwAAAAgAAH////0QAAAAEAAAAcAAAAAwAAAAMAAAD//NUAAAAAwAAAAgAAH////0QAAAAEAAAAcAAAAAwAAAAMAAAD//NUAAAAAwAAAAgAAH////0QAAAAEAAAAcAAAAAwAAAAMAAAD//NUAAAAAwAAAAgAAH////0QAAAAEAAAAcAAAAAwAAAAMAAAD';
        audioRef.current.loop = true;
      }
      if (audioRef.current.paused && isPlayingRef.current && !userInitiatedPauseRef.current) {
        audioRef.current.play().catch(() => {});
      }
    }
  };

  const pauseAudioSession = () => {
    // Audio element pause is handled directly
  };

  // Sync isPlaying state to ref and media session
  useEffect(() => {
    isPlayingRef.current = isPlaying;
    if ('mediaSession' in navigator) {
      try {
        navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
      } catch (e) {}
    }
    if (isPlaying) {
      ensureAudioSessionActive();
    } else {
      pauseAudioSession();
    }
  }, [isPlaying]);

  // WakeLock: prevent device sleep while app is open and playing
  useEffect(() => {
    let wakeLock: any = null;
    const requestWakeLock = async () => {
      if ('wakeLock' in navigator && isPlaying && document.visibilityState === 'visible') {
        try {
          wakeLock = await (navigator as any).wakeLock.request('screen');
        } catch (e) {}
      }
    };
    if (isPlaying) {
      requestWakeLock();
    } else if (wakeLock) {
      wakeLock.release().catch(() => {});
    }
    return () => {
      if (wakeLock) wakeLock.release().catch(() => {});
    };
  }, [isPlaying]);

  // Pre-warm the next track's stream 15 seconds before the current track finishes
  const prewarmNextTrack = () => {
    if (!currentSongRef.current || queue.length === 0) return;
    const idx = queue.findIndex(s => s.id === currentSongRef.current?.id);
    const nextTrack = isShuffle
      ? queue[Math.floor(Math.random() * queue.length)]
      : (idx !== -1 && idx < queue.length - 1 ? queue[idx + 1] : queue[0]);

    if (nextTrack && nextTrack.youtubeId && prewarmedTrackIdRef.current !== nextTrack.youtubeId) {
      prewarmedTrackIdRef.current = nextTrack.youtubeId;
      fetch(`/api/stream/youtube/${nextTrack.youtubeId}`, {
        headers: { Range: 'bytes=0-100' }
      }).catch(() => {});
    }
  };

  // Keep track of latest functions for MediaSession, events, and shortcuts
  const handlersRef = useRef({
    togglePlay: () => {},
    nextSong: () => {},
    prevSong: () => {},
    seek: (_t: number) => {}
  });

  // Handle visibility changes (phone locked / closed / tab backgrounded on iPhone, Android, Windows, Mac)
  useEffect(() => {
    const handleVisibilityChange = () => {
      applyAudioSessionPlayback();
      if (document.visibilityState === 'hidden') {
        // App backgrounded or phone locked: Ensure background audio session stays active
        if (isPlayingRef.current) {
          ensureAudioSessionActive();
          if (audioRef.current && audioRef.current.paused && !userInitiatedPauseRef.current) {
            audioRef.current.play().catch(() => {});
          }
        }
      } else if (document.visibilityState === 'visible') {
        // Returned to app / unlocked: sync UI with current audio state
        if (isPlayingRef.current) {
          if (activeEngineRef.current === 'youtube' && ytPlayerRef.current) {
            try { ytPlayerRef.current.playVideo(); } catch (e) {}
          }
          if (audioRef.current && audioRef.current.paused && !userInitiatedPauseRef.current) {
            audioRef.current.play().catch(() => {});
          }
          if (audioRef.current && typeof audioRef.current.currentTime === 'number' && !isNaN(audioRef.current.currentTime)) {
            setProgress(audioRef.current.currentTime);
          }
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', applyAudioSessionPlayback);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', applyAudioSessionPlayback);
    };
  }, []);

  // Initialize YouTube IFrame API
  useEffect(() => {
    const initYT = () => {
      if ((window as any).YT && (window as any).YT.Player) {
        if (!ytPlayerRef.current) {
          try {
            ytPlayerRef.current = new (window as any).YT.Player('yt-audio-player', {
              height: '180',
              width: '240',
              playerVars: {
                autoplay: 0,
                controls: 0,
                disablekb: 1,
                fs: 0,
                rel: 0,
                playsinline: 1,
                enablejsapi: 1,
                origin: window.location.origin
              },
              events: {
                onReady: () => {
                  ytReadyRef.current = true;
                  if (ytPlayerRef.current?.setVolume) {
                    ytPlayerRef.current.setVolume(volume * 100);
                  }
                },
                onStateChange: (event: any) => {
                  // event.data: 0 = ENDED, 1 = PLAYING, 2 = PAUSED, 3 = BUFFERING
                  if (event.data === 1) {
                    setIsPlaying(true);
                    userInitiatedPauseRef.current = false;
                  } else if (event.data === 2) {
                    if (userInitiatedPauseRef.current) {
                      setIsPlaying(false);
                    } else if (document.visibilityState === 'hidden' && isPlayingRef.current) {
                      setTimeout(() => {
                        try {
                          if (isPlayingRef.current && ytPlayerRef.current?.getPlayerState?.() === 2) {
                            ytPlayerRef.current?.playVideo();
                          }
                        } catch (e) {}
                      }, 200);
                    } else {
                      setIsPlaying(false);
                    }
                  } else if (event.data === 0) {
                    if (repeatModeRef.current === 'one') {
                      ytPlayerRef.current.seekTo(0, true);
                      ytPlayerRef.current.playVideo();
                    } else {
                      handlersRef.current.nextSong();
                    }
                  }
                },
                onError: (event: any) => {
                  console.warn('YouTube Player Error code:', event.data);
                  handleYouTubePlaybackError(event.data);
                }
              }
            });
          } catch (e) {
            console.warn('Failed to init YT player:', e);
          }
        }
      }
    };

    if ((window as any).YT && (window as any).YT.Player) {
      initYT();
    } else {
      (window as any).onYouTubeIframeAPIReady = initYT;
    }
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return;
      switch (e.code) {
        case 'Space':
          e.preventDefault();
          handlersRef.current.togglePlay();
          break;
        case 'ArrowRight':
          if (e.shiftKey) handlersRef.current.nextSong();
          else handlersRef.current.seek(progress + 10);
          break;
        case 'ArrowLeft':
          if (e.shiftKey) handlersRef.current.prevSong();
          else handlersRef.current.seek(Math.max(0, progress - 10));
          break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [progress]);

  // High-precision playback progress polling for YouTube Engine
  useEffect(() => {
    if (activeEngine !== 'youtube' || !isPlaying) return;

    const interval = setInterval(() => {
      if (ytPlayerRef.current && ytPlayerRef.current.getCurrentTime) {
        try {
          const cur = ytPlayerRef.current.getCurrentTime();
          const dur = ytPlayerRef.current.getDuration();
          if (typeof cur === 'number' && !isNaN(cur)) {
            setProgress(cur);
          }
          if (typeof dur === 'number' && !isNaN(dur) && dur > 0) {
            setDuration(dur);
          }
        } catch (e) {}
      }
    }, 100);

    return () => clearInterval(interval);
  }, [activeEngine, isPlaying]);

  const reorderQueue = (startIndex: number, endIndex: number) => {
    setQueue(prev => {
      const result = Array.from(prev);
      const [removed] = result.splice(startIndex, 1);
      result.splice(endIndex, 0, removed);
      return result;
    });
  };

  const removeFromQueue = (songId: string) => {
    setQueue(prev => prev.filter(s => s.id !== songId));
  };

  const clearQueue = () => {
    if (currentSongRef.current) {
      setQueue([currentSongRef.current]);
    } else {
      setQueue([]);
    }
  };

  const handleAudioError = () => {
    if (!currentSongRef.current) return;
    const song = currentSongRef.current;
    const candidates = song.streamMirrors && song.streamMirrors.length > 0 ? song.streamMirrors : (song.audioUrl ? [song.audioUrl] : []);

    if (currentMirrorIndexRef.current + 1 < candidates.length) {
      currentMirrorIndexRef.current += 1;
      const nextUrl = candidates[currentMirrorIndexRef.current];
      if (nextUrl && audioRef.current && nextUrl !== audioRef.current.src) {
        audioRef.current.src = nextUrl;
        safePlay();
        return;
      }
    }

    // If backend streaming fails but we have a youtubeId, fallback directly to the official YouTube iFrame
    if (song.youtubeId) {
      setActiveEngine('youtube');
      if (ytPlayerRef.current) {
        try {
          ytPlayerRef.current.loadVideoById(song.youtubeId);
          ytPlayerRef.current.playVideo();
          setIsPlaying(true);
          isPlayingRef.current = true;
          return;
        } catch (e) {
          console.warn('YouTube fallback failed', e);
        }
      }
    }

    // Only fallback to Audius/iTunes if it's NOT a YouTube-based song (e.g. from local search)
    if (!song.audioUrl || song.audioUrl.startsWith('/api/stream/youtube')) {
      resolveFullLengthStream(song.title, song.artist, true).then(resolved => {
        if (resolved && resolved.audioUrl && audioRef.current && currentSongRef.current?.id === song.id) {
          song.audioUrl = resolved.audioUrl;
          song.streamMirrors = resolved.mirrors && resolved.mirrors.length > 0 ? resolved.mirrors : [resolved.audioUrl];
          audioRef.current.src = resolved.audioUrl;
          safePlay();
        } else {
          handlersRef.current.nextSong();
        }
      }).catch(() => {
        handlersRef.current.nextSong();
      });
      return;
    }

    console.warn(`All stream sources for "${song.title}" were unavailable. Skipping to next song.`);
    handlersRef.current.nextSong();
  };

  const handleYouTubePlaybackError = (_errorCode?: any) => {
    // If YouTube iframe was used, keep player advancing
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
          if (e.name === 'AbortError') return;
          if (e.name === 'NotSupportedError') {
            handleAudioError();
            return;
          }
          console.warn('Playback warning:', e.message || e);
        });
      }
    } catch (e) {
      console.warn('Sync play error:', e);
    }
  };

  const startPlayback = async (song: Song) => {
    recordPlay(song);
    setCurrentSong(song);
    currentSongRef.current = song;
    currentMirrorIndexRef.current = 0;
    setProgress(0);
    setDuration(song.duration ? song.duration / 1000 : 200);

    let targetSong = { ...song };

    const needsResolution = !targetSong.audioUrl || targetSong.audioUrl.startsWith('/api/stream/youtube') || targetSong.duration <= 30000;

    if (needsResolution) {
      const resolved = await resolveFullLengthStream(targetSong.title, targetSong.artist);
      if (resolved && resolved.audioUrl) {
        targetSong.audioUrl = resolved.audioUrl;
        targetSong.streamMirrors = resolved.mirrors && resolved.mirrors.length > 0 ? resolved.mirrors : [resolved.audioUrl];
        if (resolved.youtubeId) {
          targetSong.youtubeId = resolved.youtubeId;
          targetSong.backupYoutubeIds = resolved.backupYoutubeIds || [];
          
          // Switch to youtube engine if resolution returned a youtube ID (SoundCloud failed)
          setCurrentSong(targetSong);
          currentSongRef.current = targetSong;
          setActiveEngine('youtube');
          activeEngineRef.current = 'youtube';
          if (ytPlayerRef.current) {
            try {
              ytPlayerRef.current.loadVideoById(resolved.youtubeId);
              ytPlayerRef.current.playVideo();
            } catch(e) {}
          }
          ensureAudioSessionActive();
          return;
        }
        if (resolved.duration) {
          targetSong.duration = resolved.duration;
          setDuration(resolved.duration / 1000);
        }
        targetSong.isFullLength = true;
        setCurrentSong(targetSong);
        currentSongRef.current = targetSong;
      }
    }

    setActiveEngine('audio');
    if (ytPlayerRef.current && ytPlayerRef.current.pauseVideo) {
      try { ytPlayerRef.current.pauseVideo(); } catch (e) {}
    }
    userInitiatedPauseRef.current = false;
    setIsPlaying(true);
    isPlayingRef.current = true;

    if (audioRef.current && targetSong.audioUrl) {
      const candidates = targetSong.streamMirrors && targetSong.streamMirrors.length > 0 ? targetSong.streamMirrors : [targetSong.audioUrl];
      const validStream = candidates[0] || targetSong.audioUrl;
      const currentSrc = audioRef.current.src || '';
      const isAlreadyPlayingThis = currentSrc === validStream || currentSrc.endsWith(validStream);

      if (!isAlreadyPlayingThis) {
        // If app is currently hidden/locked and already playing audio, avoid swapping src mid-background to avoid session drop
        if (document.visibilityState === 'hidden' && !audioRef.current.paused) {
          // Keep current stream playing without interrupting
        } else {
          audioRef.current.src = validStream;
          safePlay();
        }
      } else if (audioRef.current.paused && !userInitiatedPauseRef.current) {
        safePlay();
      }
    }
  };

  const playSong = (song: Song, newQueue: Song[] = [], autoExpand: boolean = false) => {
    applyAudioSessionPlayback();
    ensureAudioSessionActive();
    userInitiatedPauseRef.current = false;
    setIsPlaying(true);
    isPlayingRef.current = true;

    let streamUrl = song.audioUrl;
    const songWithUrl = {
      ...song,
      audioUrl: streamUrl,
      streamMirrors: streamUrl ? [streamUrl, ...(song.streamMirrors || [])] : (song.streamMirrors || [])
    };

    // Synchronously bind and start player within the user gesture
    if (audioRef.current && streamUrl && !streamUrl.startsWith('/api/stream/youtube')) {
      setActiveEngine('audio');
      activeEngineRef.current = 'audio';
      if (ytPlayerRef.current) { try { ytPlayerRef.current.pauseVideo(); } catch(e){} }
      const currentSrc = audioRef.current.src || '';
      if (currentSrc !== streamUrl && !currentSrc.endsWith(streamUrl)) {
        audioRef.current.src = streamUrl;
      }
      const playPromise = audioRef.current.play();
      if (playPromise !== undefined) {
        playPromiseRef.current = playPromise;
        playPromise.catch(() => {});
      }
    } else {
       ensureAudioSessionActive();
    }

    if (newQueue.length > 0) {
      setQueue(newQueue);
    } else if (queue.length === 0) {
      setQueue([songWithUrl]);
    }
    startPlayback(songWithUrl);
    if (autoExpand) {
      setIsExpanded(true);
    }
  };

  const shufflePlay = (songs: Song[]) => {
    if (!songs || songs.length === 0) return;
    applyAudioSessionPlayback();
    ensureAudioSessionActive();
    userInitiatedPauseRef.current = false;
    setIsPlaying(true);
    isPlayingRef.current = true;

    const shuffled = [...songs].sort(() => Math.random() - 0.5);
    setIsShuffle(true);
    setQueue(shuffled);

    const first = shuffled[0];
    let streamUrl = first.audioUrl;
    const firstWithUrl = {
      ...first,
      audioUrl: streamUrl,
      streamMirrors: streamUrl ? [streamUrl, ...(first.streamMirrors || [])] : (first.streamMirrors || [])
    };

    if (audioRef.current && streamUrl && !streamUrl.startsWith('/api/stream/youtube')) {
      setActiveEngine('audio');
      activeEngineRef.current = 'audio';
      if (ytPlayerRef.current) { try { ytPlayerRef.current.pauseVideo(); } catch(e){} }
      audioRef.current.src = streamUrl;
      const playPromise = audioRef.current.play();
      if (playPromise !== undefined) {
        playPromiseRef.current = playPromise;
        playPromise.catch(() => {});
      }
    } else {
       ensureAudioSessionActive();
    }

    startPlayback(firstWithUrl);
    setIsExpanded(true);
  };

  const _playDirectly = (song: Song) => {
    applyAudioSessionPlayback();
    ensureAudioSessionActive();
    userInitiatedPauseRef.current = false;
    setIsPlaying(true);
    isPlayingRef.current = true;

    let streamUrl = song.audioUrl;
    const songWithUrl = {
      ...song,
      audioUrl: streamUrl,
      streamMirrors: streamUrl ? [streamUrl, ...(song.streamMirrors || [])] : (song.streamMirrors || [])
    };

    if (audioRef.current && streamUrl && !streamUrl.startsWith('/api/stream/youtube')) {
      setActiveEngine('audio');
      activeEngineRef.current = 'audio';
      if (ytPlayerRef.current) { try { ytPlayerRef.current.pauseVideo(); } catch(e){} }
      audioRef.current.src = streamUrl;
      const playPromise = audioRef.current.play();
      if (playPromise !== undefined) {
        playPromiseRef.current = playPromise;
        playPromise.catch(() => {});
      }
    } else {
       ensureAudioSessionActive();
    }

    startPlayback(songWithUrl);
  };

  const togglePlay = () => {
    if (!currentSong) return;

    if (isPlaying) {
      userInitiatedPauseRef.current = true;
      setIsPlaying(false);
      isPlayingRef.current = false;
      pauseAudioSession();

      if (activeEngine === 'youtube' && ytPlayerRef.current) {
        try { ytPlayerRef.current.pauseVideo(); } catch (e) {}
        if (audioRef.current) {
          audioRef.current.pause();
        }
      } else {
        if (playPromiseRef.current !== undefined) {
          (playPromiseRef.current as Promise<void>).then(() => {
            audioRef.current?.pause();
          }).catch(() => {
            audioRef.current?.pause();
          });
        } else {
          audioRef.current?.pause();
        }
      }
    } else {
      userInitiatedPauseRef.current = false;
      setIsPlaying(true);
      isPlayingRef.current = true;
      applyAudioSessionPlayback();
      ensureAudioSessionActive();

      if (activeEngine === 'youtube' && ytPlayerRef.current) {
        try { ytPlayerRef.current.playVideo(); } catch (e) {}
      } else {
        safePlay();
      }
    }
  };

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
    if (ytPlayerRef.current && ytPlayerRef.current.setVolume) {
      try {
        ytPlayerRef.current.setVolume(volume * 100);
      } catch (e) {}
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

  const nextSong = () => {
    if (!currentSongRef.current || queue.length === 0) return;

    if (repeatModeRef.current === 'one') {
      if (activeEngine === 'youtube' && ytPlayerRef.current) {
        ytPlayerRef.current.seekTo(0, true);
        ytPlayerRef.current.playVideo();
      } else if (audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch(e => console.error(e));
      }
      return;
    }

    const idx = queue.findIndex(s => s.id === currentSongRef.current?.id);

    if (isShuffle) {
      const nextIdx = Math.floor(Math.random() * queue.length);
      const nextS = queue[nextIdx];
      _playDirectly(nextS);
      return;
    }

    if (idx !== -1 && idx < queue.length - 1) {
      const nextS = queue[idx + 1];
      _playDirectly(nextS);
    } else {
      // 24/7 continuous uninterrupted queue loop
      const nextS = queue[0];
      _playDirectly(nextS);
    }
  };

  const prevSong = () => {
    if (!currentSongRef.current || queue.length === 0) return;
    const idx = queue.findIndex(s => s.id === currentSongRef.current?.id);
    if (progress > 3) {
      seek(0);
    } else if (idx > 0) {
      const prevS = queue[idx - 1];
      _playDirectly(prevS);
    }
  };

  const seek = (time: number) => {
    const clampedTime = Math.max(0, Math.min(time, duration || 9999));
    setProgress(clampedTime);
    if (activeEngine === 'youtube') {
      if (ytPlayerRef.current && ytPlayerRef.current.seekTo) {
        try {
          ytPlayerRef.current.seekTo(clampedTime, true);
        } catch (e) {}
      }
    } else {
      if (audioRef.current) {
        audioRef.current.currentTime = clampedTime;
      }
    }
  };

  const setVolume = (vol: number) => {
    const clamped = Math.max(0, Math.min(1, vol));
    setVolumeState(clamped);
  };

  useEffect(() => {
    handlersRef.current = { togglePlay, nextSong, prevSong, seek };
  });

  // MediaSession lockscreen / notification center support
  useEffect(() => {
    if ('mediaSession' in navigator && currentSong) {
      try {
        const cover = currentSong.coverUrl || 'https://upload.wikimedia.org/wikipedia/commons/1/19/Spotify_logo_without_text.svg';
        navigator.mediaSession.metadata = new MediaMetadata({
          title: currentSong.title,
          artist: currentSong.artist,
          album: currentSong.album || 'Spotify',
          artwork: [
            { src: cover, sizes: '96x96', type: 'image/jpeg' },
            { src: cover, sizes: '128x128', type: 'image/jpeg' },
            { src: cover, sizes: '192x192', type: 'image/png' },
            { src: cover, sizes: '256x256', type: 'image/jpeg' },
            { src: cover, sizes: '384x384', type: 'image/jpeg' },
            { src: cover, sizes: '512x512', type: 'image/png' }
          ]
        });

        navigator.mediaSession.setActionHandler('play', () => {
          applyAudioSessionPlayback();
          ensureAudioSessionActive();
          userInitiatedPauseRef.current = false;
          setIsPlaying(true);
          isPlayingRef.current = true;
          if (activeEngineRef.current === 'youtube' && ytPlayerRef.current) {
            try { ytPlayerRef.current.playVideo(); } catch (e) {}
          }
          if (audioRef.current) {
            audioRef.current.play().catch(() => {});
          }
        });
        navigator.mediaSession.setActionHandler('pause', () => {
          userInitiatedPauseRef.current = true;
          setIsPlaying(false);
          isPlayingRef.current = false;
          if (activeEngineRef.current === 'youtube' && ytPlayerRef.current) {
            try { ytPlayerRef.current.pauseVideo(); } catch (e) {}
          }
          if (audioRef.current) {
            audioRef.current.pause();
          }
        });
        navigator.mediaSession.setActionHandler('previoustrack', () => handlersRef.current.prevSong());
        navigator.mediaSession.setActionHandler('nexttrack', () => handlersRef.current.nextSong());
        navigator.mediaSession.setActionHandler('seekto', details => {
          if (details.seekTime !== undefined) handlersRef.current.seek(details.seekTime);
        });
        navigator.mediaSession.setActionHandler('seekbackward', details => {
          const skip = details.seekOffset || 10;
          handlersRef.current.seek(Math.max(0, progress - skip));
        });
        navigator.mediaSession.setActionHandler('seekforward', details => {
          const skip = details.seekOffset || 10;
          handlersRef.current.seek(Math.min(duration, progress + skip));
        });
        navigator.mediaSession.setActionHandler('stop', () => {
          handlersRef.current.togglePlay();
        });
      } catch (e) {
        console.warn('Media session actions not supported', e);
      }
    }
  }, [currentSong]);

  // Sync position state to iOS Lock Screen scrubber
  useEffect(() => {
    if ('mediaSession' in navigator && 'setPositionState' in navigator.mediaSession) {
      if (duration > 0 && typeof progress === 'number' && !isNaN(progress)) {
        try {
          navigator.mediaSession.setPositionState({
            duration: Math.max(duration, 1),
            playbackRate: 1,
            position: Math.max(0, Math.min(progress, duration))
          });
        } catch (e) {}
      }
    }
  }, [progress, duration]);

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
        reorderQueue,
        removeFromQueue,
        clearQueue,
        isExpanded,
        setIsExpanded
      }}
    >
      {children}

      {/* YouTube IFrame Player Container for full track audio playback */}
      <div
        id="yt-audio-player-container"
        style={{
          position: 'fixed',
          bottom: 100,
          right: 16,
          width: activeEngine === 'youtube' ? 240 : 1,
          height: activeEngine === 'youtube' ? 135 : 1,
          opacity: activeEngine === 'youtube' ? 0.01 : 0,
          zIndex: activeEngine === 'youtube' ? 1 : -1,
          pointerEvents: 'none',
          overflow: 'hidden',
          borderRadius: 8
        }}
      >
        <div id="yt-audio-player" style={{ width: '100%', height: '100%' }}></div>
      </div>

      {/* HTML5 Audio Element for native background 24/7 audio playback */}
      <audio
        ref={audioRef}
        playsInline
        preload="auto"
        onTimeUpdate={e => {
          if (activeEngine === 'audio') {
            const cur = e.currentTarget.currentTime;
            const dur = e.currentTarget.duration;
            if (typeof cur === 'number' && !isNaN(cur)) {
              setProgress(cur);
            }
            if (dur > 20 && cur >= dur - 15) {
              prewarmNextTrack();
            }
          }
        }}
        onLoadedMetadata={e => {
          if (activeEngine === 'audio') {
            const dur = e.currentTarget.duration;
            if (typeof dur === 'number' && !isNaN(dur) && dur > 0) {
              setDuration(dur);
            }
          }
        }}
        onEnded={() => {
          if (activeEngine === 'audio') {
            nextSong();
          }
        }}
        onPlay={() => {
          if (activeEngine === 'audio') {
            setIsPlaying(true);
            userInitiatedPauseRef.current = false;
          }
        }}
        onPause={() => {
          if (userInitiatedPauseRef.current) {
            setIsPlaying(false);
          } else if (isPlayingRef.current) {
            // Immediate synchronous attempt if not user initiated (e.g. system interruption / phone locked)
            applyAudioSessionPlayback();
            ensureAudioSessionActive();
            try {
              audioRef.current?.play().catch(() => {});
            } catch (e) {}
          }
        }}
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
