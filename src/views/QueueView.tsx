import React, { useState } from 'react';
import { usePlayer } from '../context/PlayerContext';
import { TrackList } from '../components/TrackList';
import { GripVertical, Play } from 'lucide-react';
import { Song } from '../types';

export const QueueView: React.FC = () => {
  const { currentSong, queue, reorderQueue, playSong } = usePlayer();
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);

  if (!currentSong) {
    return (
      <div className="p-8 text-center mt-20">
        <h2 className="text-2xl font-bold mb-4">Queue is empty</h2>
        <p className="text-zinc-400">Play some music to see it here.</p>
      </div>
    );
  }

  const currentIndex = queue.findIndex(s => s.id === currentSong.id);
  const nextInQueue = currentIndex !== -1 ? queue.slice(currentIndex + 1) : [];

  const handleDragStart = (e: React.DragEvent, idx: number) => {
    setDraggedIdx(idx);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (draggedIdx === null || draggedIdx === idx) return;
    
    // We are reordering the "Next in Queue", so we offset by currentIndex + 1
    const offset = currentIndex + 1;
    reorderQueue(draggedIdx + offset, idx + offset);
    setDraggedIdx(null);
  };

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto pb-[calc(11.5rem+env(safe-area-inset-bottom,0px))] md:pb-28 animate-in fade-in">
      <h2 className="text-2xl font-bold mb-6 text-white">Queue</h2>
      
      <div className="mb-8">
        <h3 className="text-lg font-semibold text-zinc-400 mb-4">Now Playing</h3>
        <TrackList songs={[currentSong]} showHeader={false} />
      </div>

      {nextInQueue.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-zinc-400 mb-4">Next in Queue</h3>
          <div className="flex flex-col space-y-1">
            {nextInQueue.map((song, idx) => (
              <div 
                key={`${song.id}-${idx}`}
                draggable
                onDragStart={(e) => handleDragStart(e, idx)}
                onDragOver={(e) => handleDragOver(e, idx)}
                onDrop={(e) => handleDrop(e, idx)}
                className={`flex items-center p-3 rounded-md hover:bg-white/10 transition-colors group cursor-grab active:cursor-grabbing ${draggedIdx === idx ? 'opacity-50' : 'opacity-100'}`}
              >
                <div className="w-8 text-zinc-400 flex items-center justify-center mr-2">
                  <GripVertical size={16} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <img src={song.coverUrl} alt={song.title} className="w-10 h-10 rounded mr-4 object-cover" onError={(e) => { e.currentTarget.src = 'https://upload.wikimedia.org/wikipedia/commons/1/19/Spotify_logo_without_text.svg' }} />
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium truncate">{song.title}</p>
                  <p className="text-sm text-zinc-400 truncate">{song.artist}</p>
                </div>
                <button 
                  onClick={() => playSong(song, queue)}
                  className="p-2 opacity-0 group-hover:opacity-100 hover:text-green-500 transition-all text-zinc-400"
                >
                  <Play size={20} className="fill-current" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
