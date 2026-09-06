import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, Play, Pause, SkipBack, SkipForward, Shuffle, Repeat, Repeat1, Heart, ListPlus, Clock, SlidersHorizontal, RotateCcw, Plus, Minus } from 'lucide-react';
import { usePlayer } from '../context/PlayerContext';
import { isSongSaved, toggleSaveSong } from '../api';
import { motion, AnimatePresence } from 'motion/react';

interface ExpandedPlayerProps {
  onClose: () => void;
  onOpenPlaylistModal: (e: React.MouseEvent) => void;
}

interface LyricLine {
  time: number;
  text: string;
}

export const ExpandedPlayer: React.FC<ExpandedPlayerProps> = ({ onClose, onOpenPlaylistModal }) => {
  const { currentSong, isPlaying, progress, duration, isShuffle, repeatMode, togglePlay, nextSong, prevSong, seek, toggleShuffle, toggleRepeat } = usePlayer();
  
  const [isSaved, setIsSaved] = useState(false);
  const [lyrics, setLyrics] = useState<LyricLine[] | string | null>(null);
  const [loadingLyrics, setLoadingLyrics] = useState(false);
  const [showSleepTimer, setShowSleepTimer] = useState(false);
  const [showSyncControls, setShowSyncControls] = useState(false);
  const [lyricsOffset, setLyricsOffset] = useState<number>(0);
  const lyricsContainerRef = useRef<HTMLDivElement>(null);

  // Load song saved status and song-specific lyrics timing offset
  useEffect(() => {
    if (currentSong) {
      setIsSaved(isSongSaved(currentSong.id));
      
      // Load saved sync offset for this song or global default
      const savedSongOffset = localStorage.getItem(`spotify_lyrics_offset_${currentSong.id}`);
      if (savedSongOffset !== null) {
        setLyricsOffset(parseFloat(savedSongOffset) || 0);
      } else {
        const globalOffset = localStorage.getItem('spotify_lyrics_global_offset');
        setLyricsOffset(globalOffset !== null ? parseFloat(globalOffset) || 0 : 0);
      }

      fetchLyrics(currentSong.artist, currentSong.title);
    }
  }, [currentSong]);

  const updateOffset = (newOffset: number) => {
    const rounded = Math.round(newOffset * 10) / 10;
    setLyricsOffset(rounded);
    if (currentSong) {
      localStorage.setItem(`spotify_lyrics_offset_${currentSong.id}`, rounded.toString());
      localStorage.setItem('spotify_lyrics_global_offset', rounded.toString());
    }
  };

  const fetchLyrics = async (artist: string, title: string) => {
    setLoadingLyrics(true);
    setLyrics(null);

    const cleanTitle = (title || '').replace(/\([^)]+\)/g, '').replace(/\[[^\]]+\]/g, '').trim();
    const cleanArtist = (artist || '').replace(/^@/, '').trim();

    const parseLrc = (lrc: string): LyricLine[] => {
      const lines = lrc.split('\n');
      const parsedLyrics: LyricLine[] = [];
      lines.forEach((line: string) => {
        const match = line.match(/\[(\d+):(\d+\.\d+)\](.*)/);
        if (match) {
          const minutes = parseInt(match[1]);
          const seconds = parseFloat(match[2]);
          const time = minutes * 60 + seconds;
          const text = match[3].trim();
          if (text) {
            parsedLyrics.push({ time, text });
          }
        }
      });
      return parsedLyrics;
    };

    try {
      // Strategy 1: Exact search via lrclib /api/get
      let response = await fetch(`https://lrclib.net/api/get?artist_name=${encodeURIComponent(cleanArtist)}&track_name=${encodeURIComponent(cleanTitle)}`);
      if (response.ok) {
        const data = await response.json();
        if (data.syncedLyrics) {
          const parsed = parseLrc(data.syncedLyrics);
          if (parsed.length > 0) {
            setLyrics(parsed);
            setLoadingLyrics(false);
            return;
          }
        }
        if (data.plainLyrics) {
          setLyrics(data.plainLyrics);
          setLoadingLyrics(false);
          return;
        }
      }

      // Strategy 2: Search via lrclib /api/search?q=...
      response = await fetch(`https://lrclib.net/api/search?q=${encodeURIComponent(cleanTitle + ' ' + cleanArtist)}`);
      if (response.ok) {
        const searchResults = await response.json();
        if (Array.isArray(searchResults) && searchResults.length > 0) {
          const match = searchResults[0];
          if (match.syncedLyrics) {
            const parsed = parseLrc(match.syncedLyrics);
            if (parsed.length > 0) {
              setLyrics(parsed);
              setLoadingLyrics(false);
              return;
            }
          }
          if (match.plainLyrics) {
            setLyrics(match.plainLyrics);
            setLoadingLyrics(false);
            return;
          }
        }
      }

      // Fallback: Generate timed visual rhythm cues if official lyrics aren't in external API
      const totalDur = duration || 180;
      const fallbackCueLines: LyricLine[] = [
        { time: 0, text: `🎵 Listening to "${cleanTitle}" by ${cleanArtist}` },
        { time: 5, text: "🎶 Enjoy the beat and turn up the volume!" },
        { time: Math.floor(totalDur * 0.25), text: "✨ Feel the rhythm..." },
        { time: Math.floor(totalDur * 0.5), text: "🔥 Mid-track breakdown" },
        { time: Math.floor(totalDur * 0.75), text: "🌟 Outro & fading vibes" }
      ];
      setLyrics(fallbackCueLines);
    } catch (error) {
      setLyrics(`🎵 Playing "${cleanTitle}" by ${cleanArtist}`);
    } finally {
      setLoadingLyrics(false);
    }
  };

  const handleSave = async () => {
    if (currentSong) {
      const saved = await toggleSaveSong(currentSong);
      setIsSaved(saved);
    }
  };

  const formatTime = (time: number) => {
    if (isNaN(time)) return '0:00';
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };
  
  // Calculate effective progress for synchronized lyrics
  const effectiveProgress = progress - lyricsOffset;

  // Auto-scroll synced lyrics cleanly without smooth scroll collisions
  useEffect(() => {
    if (Array.isArray(lyrics) && lyricsContainerRef.current) {
      const activeLineIndex = lyrics.findIndex((line, i) => {
        const nextLine = lyrics[i + 1];
        return effectiveProgress >= line.time && (!nextLine || effectiveProgress < nextLine.time);
      });
      
      if (activeLineIndex !== -1) {
        const activeElement = lyricsContainerRef.current.children[activeLineIndex] as HTMLElement;
        if (activeElement && lyricsContainerRef.current) {
          const container = lyricsContainerRef.current;
          const top = activeElement.offsetTop - container.offsetTop - container.clientHeight / 2 + activeElement.clientHeight / 2;
          container.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
        }
      }
    }
  }, [effectiveProgress, lyrics]);

  if (!currentSong) return null;

  return (
    <motion.div
      initial={{ y: "100%" }}
      animate={{ y: 0 }}
      exit={{ y: "100%" }}
      transition={{ type: "spring", damping: 28, stiffness: 220 }}
      className="fixed inset-0 z-[100] bg-gradient-to-b from-zinc-800 via-zinc-900 to-black overflow-y-auto pt-[max(0.75rem,env(safe-area-inset-top,0px))] pb-[max(2rem,env(safe-area-inset-bottom,0px))] flex flex-col select-none touch-manipulation overscroll-none"
    >
      {/* Visual Swipe-down indicator pill */}
      <div 
        className="w-10 h-1.5 bg-zinc-600/70 hover:bg-zinc-500 rounded-full mx-auto my-1 cursor-pointer transition-colors"
        onClick={onClose}
        title="Tap or drag to dismiss"
      />

      {/* Top Header */}
      <div className="flex items-center justify-between px-5 sm:px-6 mb-4 sm:mb-6">
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.85 }}
          onClick={onClose}
          className="p-2 -ml-2 text-white hover:bg-white/10 rounded-full transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
          title="Close player"
        >
          <ChevronDown size={28} />
        </motion.button>
        <div className="text-center min-w-0 px-2">
          <p className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-zinc-400">Now Playing</p>
          <p className="text-xs sm:text-sm font-bold text-white truncate max-w-[180px] sm:max-w-[240px]">{currentSong.album || 'Single'}</p>
        </div>
        <button 
           onClick={() => setShowSleepTimer(!showSleepTimer)} 
           className={`p-2 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center ${showSleepTimer ? 'text-green-500' : 'text-zinc-400 hover:text-white'}`}
           title="Sleep Timer"
        >
           <Clock size={22} />
        </button>
      </div>
      
      {showSleepTimer && (
         <div className="px-6 mb-4 flex gap-2 justify-center animate-in fade-in">
            {[15, 30, 45, 60].map(mins => (
               <button 
                  key={mins} 
                  onClick={() => { setShowSleepTimer(false); }}
                  className="px-3.5 py-1.5 bg-zinc-800 rounded-full text-xs font-bold text-white hover:bg-zinc-700 active:scale-95 transition-transform"
               >
                  {mins}m
               </button>
            ))}
         </div>
      )}

      {/* Main Content */}
      <div className="px-5 sm:px-6 flex flex-col flex-1 max-w-md mx-auto w-full">
        {/* Responsive Cover Art */}
        <motion.div
          animate={{ scale: isPlaying ? 1 : 0.95 }}
          transition={{ duration: 0.3 }}
          className="w-full max-w-[240px] sm:max-w-[320px] aspect-square mb-4 sm:mb-6 shadow-2xl rounded-2xl overflow-hidden mx-auto"
        >
          <img 
            src={currentSong.coverUrl || 'https://upload.wikimedia.org/wikipedia/commons/1/19/Spotify_logo_without_text.svg'} 
            alt={currentSong.title} 
            className="w-full h-full object-cover shadow-inner" 
            onError={(e) => { e.currentTarget.src = 'https://upload.wikimedia.org/wikipedia/commons/1/19/Spotify_logo_without_text.svg' }}
          />
        </motion.div>

        {/* Title and Actions */}
        <div className="flex items-center justify-between mb-4 sm:mb-6">
          <div className="overflow-hidden pr-3 flex-1 min-w-0">
            <h2 className="text-xl sm:text-2xl font-bold text-white truncate">{currentSong.title}</h2>
            <p className="text-base sm:text-lg text-zinc-400 truncate mt-0.5">{currentSong.artist}</p>
          </div>
          <div className="flex items-center space-x-1 sm:space-x-2 flex-shrink-0">
            <button 
              onClick={onOpenPlaylistModal} 
              className="p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center text-zinc-400 hover:text-white active:scale-90 transition-transform"
              title="Add to Playlist"
            >
              <ListPlus size={22} />
            </button>
            <button 
              onClick={handleSave} 
              className="p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center text-zinc-400 hover:text-white active:scale-90 transition-transform"
              title={isSaved ? "Liked" : "Like Song"}
            >
              <Heart size={22} className={isSaved ? "fill-green-500 text-green-500" : ""} />
            </button>
          </div>
        </div>

        {/* Progress Bar (Touch-friendly scrubber) */}
        <div className="mb-4 sm:mb-6">
          <div className="group h-6 flex items-center relative cursor-pointer touch-none" onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
            seek(percent * duration);
          }}>
            <div className="w-full h-1.5 bg-zinc-700/80 rounded-full absolute overflow-hidden">
              <div 
                className="h-full bg-white group-hover:bg-green-500 rounded-full transition-colors"
                style={{ width: `${(progress / (duration || 1)) * 100}%` }} 
              />
            </div>
            <div 
              className="absolute h-4 w-4 bg-white rounded-full shadow-md transform -translate-x-1/2"
              style={{ left: `${(progress / (duration || 1)) * 100}%` }} 
            />
          </div>
          <div className="flex justify-between text-xs text-zinc-400 mt-1 font-mono">
            <span>{formatTime(progress)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* Playback Controls */}
        <div className="flex items-center justify-between mb-6 sm:mb-8">
          <motion.button 
            whileHover={{ scale: 1.15 }} 
            whileTap={{ scale: 0.85 }} 
            onClick={toggleShuffle} 
            className={`p-2 min-w-[44px] min-h-[44px] flex items-center justify-center transition-colors ${isShuffle ? 'text-green-500' : 'text-zinc-400 hover:text-white'}`}
          >
            <Shuffle size={22} />
          </motion.button>
          <motion.button 
            whileHover={{ scale: 1.15 }} 
            whileTap={{ scale: 0.85 }} 
            onClick={prevSong} 
            className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center text-white hover:text-zinc-300 transition-colors"
          >
            <SkipBack size={30} className="fill-current" />
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.9 }}
            onClick={togglePlay} 
            className="w-16 h-16 sm:w-18 sm:h-18 flex items-center justify-center bg-white text-black rounded-full shadow-2xl transition-transform"
          >
            {isPlaying ? <Pause size={30} className="fill-current" /> : <Play size={30} className="fill-current ml-1" />}
          </motion.button>
          <motion.button 
            whileHover={{ scale: 1.15 }} 
            whileTap={{ scale: 0.85 }} 
            onClick={nextSong} 
            className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center text-white hover:text-zinc-300 transition-colors"
          >
            <SkipForward size={30} className="fill-current" />
          </motion.button>
          <motion.button 
            whileHover={{ scale: 1.15 }} 
            whileTap={{ scale: 0.85 }} 
            onClick={toggleRepeat} 
            className={`p-2 min-w-[44px] min-h-[44px] flex items-center justify-center transition-colors ${repeatMode !== 'off' ? 'text-green-500' : 'text-zinc-400 hover:text-white'}`}
          >
            {repeatMode === 'one' ? <Repeat1 size={22} /> : <Repeat size={22} />}
          </motion.button>
        </div>

        {/* Lyrics Section with Sync Timing Calibration */}
        <div className="mt-4 bg-zinc-800/80 rounded-2xl p-5 relative min-h-[200px] max-h-[350px] overflow-hidden flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              Lyrics
              {Array.isArray(lyrics) && (
                <span className="text-[11px] font-medium text-green-400 bg-green-500/10 px-2 py-0.5 rounded-full">
                  Synced
                </span>
              )}
            </h3>

            {Array.isArray(lyrics) && (
              <button
                onClick={() => setShowSyncControls(!showSyncControls)}
                className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full transition-colors ${
                  showSyncControls || lyricsOffset !== 0
                    ? 'bg-green-500 text-black'
                    : 'bg-zinc-700/80 text-zinc-300 hover:text-white hover:bg-zinc-700'
                }`}
                title="Adjust lyric timing"
              >
                <SlidersHorizontal size={13} />
                <span>
                  {lyricsOffset === 0 ? 'Sync timing' : `${lyricsOffset > 0 ? `+${lyricsOffset.toFixed(1)}s` : `${lyricsOffset.toFixed(1)}s`}`}
                </span>
              </button>
            )}
          </div>

          {/* Sync Calibration Panel */}
          <AnimatePresence>
            {showSyncControls && Array.isArray(lyrics) && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-4 bg-zinc-900/90 rounded-xl p-3 border border-zinc-700/60 overflow-hidden"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-zinc-300 font-medium">
                    Lyrics delay: <b className="text-white">{lyricsOffset > 0 ? `+${lyricsOffset.toFixed(1)}s` : `${lyricsOffset.toFixed(1)}s`}</b>
                  </span>
                  <button
                    onClick={() => updateOffset(0)}
                    className="flex items-center gap-1 text-[11px] text-zinc-400 hover:text-white px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700"
                  >
                    <RotateCcw size={11} /> Reset
                  </button>
                </div>

                {/* Quick Presets */}
                <div className="grid grid-cols-5 gap-1.5 mb-2.5">
                  {[-0.5, 0, 0.5, 1.0, 1.5].map((val) => (
                    <button
                      key={val}
                      onClick={() => updateOffset(val)}
                      className={`py-1 text-xs font-bold rounded transition-colors ${
                        Math.abs(lyricsOffset - val) < 0.05
                          ? 'bg-green-500 text-black'
                          : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-white'
                      }`}
                    >
                      {val === 0 ? '0.0s' : val > 0 ? `+${val}s` : `${val}s`}
                    </button>
                  ))}
                </div>

                {/* Fine-Tuning Step Controls */}
                <div className="flex items-center justify-between text-xs text-zinc-400 pt-1 border-t border-zinc-800">
                  <span>Fine tune (0.1s):</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => updateOffset(lyricsOffset - 0.1)}
                      className="p-1 bg-zinc-800 hover:bg-zinc-700 text-white rounded flex items-center justify-center"
                      title="Step Earlier (-0.1s)"
                    >
                      <Minus size={13} />
                    </button>
                    <button
                      onClick={() => updateOffset(lyricsOffset + 0.1)}
                      className="p-1 bg-zinc-800 hover:bg-zinc-700 text-white rounded flex items-center justify-center"
                      title="Step Later (+0.1s)"
                    >
                      <Plus size={13} />
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {loadingLyrics ? (
            <div className="flex justify-center items-center h-32 flex-1">
              <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : Array.isArray(lyrics) ? (
            <div ref={lyricsContainerRef} className="flex-1 overflow-y-auto space-y-4 pb-20 mask-image-fade scroll-smooth">
               {lyrics.map((line, i) => {
                  const nextLine = lyrics[i + 1];
                  const isActive = effectiveProgress >= line.time && (!nextLine || effectiveProgress < nextLine.time);
                  const isPassed = effectiveProgress > line.time && !isActive;
                  return (
                     <p 
                        key={i} 
                        onClick={() => seek(Math.max(0, line.time + lyricsOffset))}
                        className={`text-2xl font-bold transition-all duration-300 cursor-pointer hover:text-white select-none ${isActive ? 'text-white scale-105 origin-left' : isPassed ? 'text-zinc-500' : 'text-zinc-600'}`}
                     >
                        {line.text}
                     </p>
                  );
               })}
            </div>
          ) : (
            <div className="text-zinc-200 text-lg font-medium leading-relaxed whitespace-pre-wrap overflow-y-auto flex-1">
              {lyrics}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};
