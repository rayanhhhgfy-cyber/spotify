import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, Play, Pause, SkipBack, SkipForward, Shuffle, Repeat, Repeat1, Heart, ListPlus, Clock } from 'lucide-react';
import { usePlayer } from '../context/PlayerContext';
import { isSongSaved, toggleSaveSong } from '../api';
import { motion } from 'motion/react';

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
  const lyricsContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (currentSong) {
      setIsSaved(isSongSaved(currentSong.id));
      fetchLyrics(currentSong.artist, currentSong.title);
    }
  }, [currentSong]);

  const fetchLyrics = async (artist: string, title: string) => {
    setLoadingLyrics(true);
    setLyrics(null);
    try {
      const cleanTitle = (title || '').replace(/\([^)]+\)/g, '').trim();
      const response = await fetch(`https://lrclib.net/api/get?artist_name=${encodeURIComponent(artist || '')}&track_name=${encodeURIComponent(cleanTitle)}`);
      
      if (response.ok) {
        const data = await response.json();
        if (data.syncedLyrics) {
          // Parse LRC format
          const lines = data.syncedLyrics.split('\n');
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
          setLyrics(parsedLyrics.length > 0 ? parsedLyrics : data.plainLyrics || "Lyrics not found for this song.");
        } else if (data.plainLyrics) {
          setLyrics(data.plainLyrics);
        } else {
          setLyrics("Lyrics not found for this song.");
        }
      } else {
        setLyrics("Lyrics not found for this song.");
      }
    } catch (error) {
      setLyrics("Could not load lyrics.");
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
  
  // Auto-scroll synced lyrics
  useEffect(() => {
    if (Array.isArray(lyrics) && lyricsContainerRef.current) {
      const activeLineIndex = lyrics.findIndex((line, i) => {
        const nextLine = lyrics[i + 1];
        return progress >= line.time && (!nextLine || progress < nextLine.time);
      });
      
      if (activeLineIndex !== -1) {
        const activeElement = lyricsContainerRef.current.children[activeLineIndex] as HTMLElement;
        if (activeElement) {
          activeElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
    }
  }, [progress, lyrics]);

  if (!currentSong) return null;

  return (
    <motion.div
      initial={{ y: "100%" }}
      animate={{ y: 0 }}
      exit={{ y: "100%" }}
      transition={{ type: "spring", damping: 25, stiffness: 200 }}
      className="fixed inset-0 z-[100] bg-zinc-900 overflow-y-auto pb-8 flex flex-col pt-4"
    >
      {/* Top Header */}
      <div className="flex items-center justify-between px-6 mb-8">
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={onClose}
          className="p-2 -ml-2 text-white hover:bg-white/10 rounded-full transition-colors"
        >
          <ChevronDown size={28} />
        </motion.button>
        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400">Now Playing</p>
          <p className="text-sm font-bold text-white truncate max-w-[200px]">{currentSong.album}</p>
        </div>
        <button 
           onClick={() => setShowSleepTimer(!showSleepTimer)} 
           className={`p-2 transition-colors ${showSleepTimer ? 'text-green-500' : 'text-zinc-400 hover:text-white'}`}
           title="Sleep Timer"
        >
           <Clock size={24} />
        </button>
      </div>
      
      {showSleepTimer && (
         <div className="px-6 mb-4 flex gap-2 justify-center animate-in fade-in">
            {[15, 30, 45, 60].map(mins => (
               <button 
                  key={mins} 
                  onClick={() => { setShowSleepTimer(false); }}
                  className="px-3 py-1 bg-zinc-800 rounded-full text-xs font-bold text-white hover:bg-zinc-700"
               >
                  {mins}m
               </button>
            ))}
         </div>
      )}

      {/* Main Content */}
      <div className="px-6 flex flex-col flex-1 max-w-md mx-auto w-full">
        {/* Cover Art */}
        <motion.div
          animate={{ scale: isPlaying ? 1 : 0.95 }}
          transition={{ duration: 0.3 }}
          className="w-full aspect-square mb-8 shadow-2xl rounded-xl overflow-hidden"
        >
          <img 
            src={currentSong.coverUrl || 'https://upload.wikimedia.org/wikipedia/commons/1/19/Spotify_logo_without_text.svg'} 
            alt={currentSong.title} 
            className="w-full h-full object-cover" onError={(e) => { e.currentTarget.src = 'https://upload.wikimedia.org/wikipedia/commons/1/19/Spotify_logo_without_text.svg' }}
          />
        </motion.div>

        {/* Title and Actions */}
        <div className="flex items-center justify-between mb-6">
          <div className="overflow-hidden pr-4 flex-1">
            <h2 className="text-2xl font-bold text-white truncate">{currentSong.title}</h2>
            <p className="text-lg text-zinc-400 truncate">{currentSong.artist}</p>
          </div>
          <div className="flex items-center space-x-2">
            <button onClick={onOpenPlaylistModal} className="p-2 text-zinc-400 hover:text-white transition-colors">
              <ListPlus size={24} />
            </button>
            <button onClick={handleSave} className="p-2 text-zinc-400 hover:text-white transition-colors">
              <Heart size={24} className={isSaved ? "fill-green-500 text-green-500" : ""} />
            </button>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mb-6">
          <div className="group h-4 flex items-center relative cursor-pointer" onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const percent = (e.clientX - rect.left) / rect.width;
            seek(percent * duration);
          }}>
            <div className="w-full h-1.5 bg-zinc-700 rounded-full absolute">
              <div 
                className="h-full bg-white group-hover:bg-green-500 rounded-full transition-colors"
                style={{ width: `${(progress / (duration || 1)) * 100}%` }} 
              />
            </div>
            <div 
              className="absolute h-3.5 w-3.5 bg-white rounded-full opacity-0 group-hover:opacity-100 shadow transition-opacity"
              style={{ left: `calc(${(progress / (duration || 1)) * 100}% - 7px)` }} 
            />
          </div>
          <div className="flex justify-between text-xs text-zinc-400 mt-2 font-mono">
            <span>{formatTime(progress)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* Playback Controls */}
        <div className="flex items-center justify-between mb-8">
          <motion.button whileHover={{ scale: 1.15 }} whileTap={{ scale: 0.9 }} onClick={toggleShuffle} className={`p-2 transition-colors ${isShuffle ? 'text-green-500' : 'text-zinc-400 hover:text-white'}`}>
            <Shuffle size={24} />
          </motion.button>
          <motion.button whileHover={{ scale: 1.15 }} whileTap={{ scale: 0.9 }} onClick={prevSong} className="p-2 text-white hover:text-zinc-300 transition-colors">
            <SkipBack size={32} className="fill-current" />
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            onClick={togglePlay} 
            className="w-16 h-16 flex items-center justify-center bg-white text-black rounded-full shadow-xl transition-transform"
          >
            {isPlaying ? <Pause size={32} className="fill-current" /> : <Play size={32} className="fill-current ml-1" />}
          </motion.button>
          <motion.button whileHover={{ scale: 1.15 }} whileTap={{ scale: 0.9 }} onClick={nextSong} className="p-2 text-white hover:text-zinc-300 transition-colors">
            <SkipForward size={32} className="fill-current" />
          </motion.button>
          <motion.button whileHover={{ scale: 1.15 }} whileTap={{ scale: 0.9 }} onClick={toggleRepeat} className={`p-2 transition-colors ${repeatMode !== 'off' ? 'text-green-500' : 'text-zinc-400 hover:text-white'}`}>
            {repeatMode === 'one' ? <Repeat1 size={24} /> : <Repeat size={24} />}
          </motion.button>
        </div>

        {/* Lyrics Section */}
        <div className="mt-4 bg-zinc-800/80 rounded-2xl p-6 relative min-h-[400px] overflow-hidden flex flex-col">
          <h3 className="text-lg font-bold text-white mb-4 flex items-center">
            Lyrics
          </h3>
          {loadingLyrics ? (
            <div className="flex justify-center items-center h-32 flex-1">
              <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : Array.isArray(lyrics) ? (
            <div ref={lyricsContainerRef} className="flex-1 overflow-y-auto space-y-4 pb-20 mask-image-fade">
               {lyrics.map((line, i) => {
                  const nextLine = lyrics[i + 1];
                  const isActive = progress >= line.time && (!nextLine || progress < nextLine.time);
                  const isPassed = progress > line.time && !isActive;
                  return (
                     <p 
                        key={i} 
                        className={`text-2xl font-bold transition-all duration-300 ${isActive ? 'text-white scale-105 origin-left' : isPassed ? 'text-zinc-500' : 'text-zinc-600'}`}
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
