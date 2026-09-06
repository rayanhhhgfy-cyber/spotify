import React, { useState, useEffect } from 'react';
import { Play, Pause, SkipBack, SkipForward, Volume2, Heart, Shuffle, Repeat, Repeat1, ListMusic } from 'lucide-react';
import { usePlayer } from '../context/PlayerContext';
import { isSongSaved, toggleSaveSong } from '../api';
import { ExpandedPlayer } from './ExpandedPlayer';
import { PlaylistModal } from './PlaylistModal';
import { motion, AnimatePresence } from 'motion/react';

interface PlayerBarProps {
  currentView?: string;
  onViewChange?: (view: string) => void;
}

export const PlayerBar: React.FC<PlayerBarProps> = ({ currentView, onViewChange }) => {
  const {
    currentSong,
    isPlaying,
    progress,
    duration,
    volume,
    isShuffle,
    repeatMode,
    togglePlay,
    nextSong,
    prevSong,
    seek,
    setVolume,
    toggleShuffle,
    toggleRepeat,
    isExpanded,
    setIsExpanded
  } = usePlayer();
  const [isSaved, setIsSaved] = useState(false);
  const [showPlaylistModal, setShowPlaylistModal] = useState(false);

  useEffect(() => {
    if (currentSong) {
      setIsSaved(isSongSaved(currentSong.id));
    }
  }, [currentSong]);

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

  if (!currentSong) return null;

  return (
    <motion.div
      initial={{ y: 50, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="fixed bottom-[calc(3.85rem+env(safe-area-inset-bottom,0px))] md:bottom-0 left-2 right-2 md:left-0 md:right-0 h-14 md:h-24 bg-zinc-900/95 md:bg-[#181818] border border-zinc-800/80 md:border-t md:border-zinc-800 md:border-none rounded-xl md:rounded-none flex items-center justify-between px-3 md:px-4 z-[60] shadow-2xl backdrop-blur-xl select-none"
    >
      {/* Left: Song Info (Tap to expand full player) */}
      <div 
        className="flex items-center flex-1 md:flex-initial md:w-[30%] min-w-0 cursor-pointer p-1 -ml-1 rounded-lg transition-colors hover:bg-zinc-800/40"
        onClick={() => setIsExpanded(true)}
      >
        <motion.img
          key={currentSong.id}
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.2 }}
          src={currentSong.coverUrl}
          alt={currentSong.title}
          className="h-10 w-10 md:h-14 md:w-14 rounded-md shadow-md object-cover flex-shrink-0"
          onError={(e) => { e.currentTarget.src = 'https://upload.wikimedia.org/wikipedia/commons/1/19/Spotify_logo_without_text.svg' }}
        />
        <div className="ml-2.5 md:ml-4 overflow-hidden min-w-0 pr-2">
          <p className="text-white text-xs md:text-sm font-semibold truncate leading-tight">{currentSong.title}</p>
          <p className="text-zinc-400 text-[11px] md:text-xs truncate leading-normal mt-0.5">{currentSong.artist}</p>
        </div>
        <motion.button
          whileHover={{ scale: 1.15 }}
          whileTap={{ scale: 0.9 }}
          onClick={(e) => { e.stopPropagation(); handleSave(); }}
          className="ml-4 hidden md:block text-zinc-400 hover:text-white transition-colors"
        >
          <Heart size={20} className={isSaved ? "fill-green-500 text-green-500" : ""} />
        </motion.button>
      </div>

      {/* Mobile-Only Action Controls */}
      <div className="flex md:hidden items-center space-x-1 flex-shrink-0">
        <motion.button
          whileTap={{ scale: 0.85 }}
          onClick={(e) => { e.stopPropagation(); handleSave(); }}
          className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-zinc-400 hover:text-white transition-colors touch-manipulation"
          title={isSaved ? "Remove from Liked" : "Add to Liked"}
        >
          <Heart size={20} className={isSaved ? "fill-green-500 text-green-500" : ""} />
        </motion.button>

        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={togglePlay} 
          className="w-9 h-9 flex items-center justify-center bg-white text-black rounded-full shadow-lg transition-transform touch-manipulation flex-shrink-0"
        >
          {isPlaying ? <Pause size={18} className="fill-current" /> : <Play size={18} className="fill-current ml-0.5" />}
        </motion.button>

        <motion.button
          whileTap={{ scale: 0.85 }}
          onClick={nextSong}
          className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-zinc-400 hover:text-white transition-colors touch-manipulation"
          title="Next Track"
        >
          <SkipForward size={20} className="fill-current" />
        </motion.button>
      </div>

      {/* Center: Desktop Controls & Scrubber */}
      <div className="hidden md:flex flex-col items-center max-w-[40%] flex-1">
        <div className="flex items-center space-x-6">
          <motion.button
            whileHover={{ scale: 1.15 }}
            whileTap={{ scale: 0.9 }}
            onClick={toggleShuffle}
            className={`transition-colors ${isShuffle ? 'text-green-500 hover:text-green-400' : 'text-zinc-400 hover:text-white'}`}
          >
            <Shuffle size={18} />
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.15 }}
            whileTap={{ scale: 0.9 }}
            onClick={prevSong}
            className="text-zinc-400 hover:text-white transition-colors"
          >
            <SkipBack size={20} className="fill-current" />
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            onClick={togglePlay} 
            className="w-10 h-10 flex items-center justify-center bg-white text-black rounded-full shadow-lg transition-transform"
          >
            {isPlaying ? <Pause size={20} className="fill-current" /> : <Play size={20} className="fill-current ml-0.5" />}
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.15 }}
            whileTap={{ scale: 0.9 }}
            onClick={nextSong}
            className="text-zinc-400 hover:text-white transition-colors"
          >
            <SkipForward size={20} className="fill-current" />
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.15 }}
            whileTap={{ scale: 0.9 }}
            onClick={toggleRepeat}
            className={`transition-colors ${repeatMode !== 'off' ? 'text-green-500 hover:text-green-400' : 'text-zinc-400 hover:text-white'}`}
          >
            {repeatMode === 'one' ? <Repeat1 size={18} /> : <Repeat size={18} />}
          </motion.button>
        </div>
        
        {/* Progress Bar (Desktop only) */}
        <div className="flex w-full items-center space-x-2 mt-2">
          <span className="text-xs text-zinc-400 w-8 text-right">{formatTime(progress)}</span>
          <div className="flex-1 group h-3 flex items-center relative cursor-pointer" onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const percent = (e.clientX - rect.left) / rect.width;
            seek(percent * duration);
          }}>
            <div className="w-full h-1 bg-zinc-600 rounded-full absolute">
              <div 
                className="h-full bg-white group-hover:bg-green-500 rounded-full transition-colors" 
                style={{ width: `${(progress / (duration || 1)) * 100}%` }} 
              />
            </div>
            <div 
              className="absolute h-3 w-3 bg-white rounded-full opacity-0 group-hover:opacity-100 shadow transition-opacity" 
              style={{ left: `calc(${(progress / (duration || 1)) * 100}% - 6px)` }} 
            />
          </div>
          <span className="text-xs text-zinc-400 w-8">{formatTime(duration)}</span>
        </div>
      </div>

      {/* Right: Volume & Queue */}
      <div className="hidden md:flex items-center justify-end w-[30%] space-x-4">
        {onViewChange && (
          <button 
            onClick={() => onViewChange('queue')} 
            className={`transition-colors ${currentView === 'queue' ? 'text-green-500' : 'text-zinc-400 hover:text-white'}`}
          >
            <ListMusic size={18} />
          </button>
        )}
        <div className="flex items-center space-x-2">
          <Volume2 size={20} className="text-zinc-400" />
          <div className="w-24 group h-3 flex items-center relative cursor-pointer" onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
            setVolume(percent);
          }}>
            <div className="w-full h-1 bg-zinc-600 rounded-full absolute">
              <div 
                className="h-full bg-white group-hover:bg-green-500 rounded-full transition-colors" 
                style={{ width: `${volume * 100}%` }} 
              />
            </div>
            <div 
              className="absolute h-3 w-3 bg-white rounded-full opacity-0 group-hover:opacity-100 shadow transition-opacity" 
              style={{ left: `calc(${volume * 100}% - 6px)` }} 
            />
          </div>
        </div>
      </div>
      
      {/* Mobile progress bar minimal */}
      <div className="md:hidden absolute bottom-0 left-0 right-0 h-[2.5px] bg-zinc-800 rounded-b-xl overflow-hidden pointer-events-none">
         <div 
           className="h-full bg-white transition-all duration-300" 
           style={{ width: `${(progress / (duration || 1)) * 100}%` }}
         />
      </div>

      <AnimatePresence>
        {isExpanded && (
          <ExpandedPlayer
            onClose={() => setIsExpanded(false)}
            onOpenPlaylistModal={(e) => { e.stopPropagation(); setShowPlaylistModal(true); }}
          />
        )}
      </AnimatePresence>
      
      {showPlaylistModal && currentSong && (
        <PlaylistModal song={currentSong} onClose={() => setShowPlaylistModal(false)} />
      )}
    </motion.div>
  );
};
