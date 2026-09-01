import React, { useEffect, useState, useRef } from 'react';
import { getTrendingSongs } from '../api';
import { Song } from '../types';
import { usePlayer } from '../context/PlayerContext';
import { Heart, MessageCircle, Share2, Music } from 'lucide-react';
import { isSongSaved, toggleSaveSong } from '../api';

export const DiscoverView: React.FC = () => {
  const [songs, setSongs] = useState<Song[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const { playSong } = usePlayer();

  useEffect(() => {
    getTrendingSongs().then(res => setSongs(res.sort(() => Math.random() - 0.5))); // Shuffle for discover
  }, []);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const container = e.currentTarget;
    const index = Math.round(container.scrollTop / container.clientHeight);
    if (index !== activeIndex && index >= 0 && index < songs.length) {
      setActiveIndex(index);
    }
  };

  if (songs.length === 0) {
    return (
      <div className="flex justify-center items-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
      </div>
    );
  }

  return (
    <div 
      className="h-[calc(100vh-90px)] w-full overflow-y-scroll snap-y snap-mandatory bg-black relative hide-scrollbar"
      onScroll={handleScroll}
      ref={containerRef}
    >
      {songs.map((song, index) => (
        <DiscoverVideo 
           key={song.id} 
           song={song} 
           isActive={index === activeIndex} 
           onPlay={() => playSong(song, songs)} 
        />
      ))}
    </div>
  );
};

const DiscoverVideo: React.FC<{song: Song, isActive: boolean, onPlay: () => void}> = ({ song, isActive, onPlay }) => {
  const [saved, setSaved] = useState(false);
  
  useEffect(() => {
    setSaved(isSongSaved(song.id));
  }, [song.id]);

  const handleLike = () => {
    toggleSaveSong(song).then(setSaved);
  };

  return (
    <div className="h-full w-full snap-start relative flex items-center justify-center overflow-hidden bg-zinc-900 group">
      {/* Blurred background */}
      <div 
        className="absolute inset-0 bg-cover bg-center opacity-30 blur-2xl scale-110" 
        style={{ backgroundImage: `url(${song.coverUrl})` }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/20 to-black/80" />
      
      {/* Main Content */}
      <div className="relative z-10 flex flex-col items-center w-full max-w-sm px-6">
        <img 
          src={song.coverUrl.replace('300x300', '600x600')} 
          className={`w-64 h-64 rounded-xl shadow-2xl object-cover mb-8 transition-transform duration-700 ${isActive ? 'scale-100' : 'scale-90 opacity-50'}`} 
          onError={(e) => { e.currentTarget.src = 'https://upload.wikimedia.org/wikipedia/commons/1/19/Spotify_logo_without_text.svg' }}
        />
        
        <div className="text-center w-full">
          <h2 className="text-3xl font-black text-white mb-2 truncate">{song.title}</h2>
          <p className="text-xl text-zinc-300 font-medium mb-8 truncate">{song.artist}</p>
          
          <button 
            onClick={onPlay}
            className="w-full py-4 bg-white text-black font-bold rounded-full text-lg hover:scale-105 transition-transform"
          >
            Play Track
          </button>
        </div>
      </div>

      {/* Floating Action Buttons */}
      <div className="absolute right-4 bottom-32 flex flex-col gap-6 items-center z-20">
        <button className="flex flex-col items-center gap-1 group" onClick={handleLike}>
          <div className="w-12 h-12 bg-black/40 backdrop-blur-md rounded-full flex items-center justify-center group-hover:bg-black/60 transition-colors">
            <Heart size={24} className={saved ? 'fill-green-500 text-green-500' : 'text-white'} />
          </div>
        </button>
        <button className="flex flex-col items-center gap-1 group">
          <div className="w-12 h-12 bg-black/40 backdrop-blur-md rounded-full flex items-center justify-center group-hover:bg-black/60 transition-colors">
            <MessageCircle size={24} className="text-white" />
          </div>
        </button>
        <button className="flex flex-col items-center gap-1 group">
          <div className="w-12 h-12 bg-black/40 backdrop-blur-md rounded-full flex items-center justify-center group-hover:bg-black/60 transition-colors">
            <Share2 size={24} className="text-white" />
          </div>
        </button>
        <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-white mt-4 animate-spin-slow relative">
           <img src={song.coverUrl} className="w-full h-full object-cover" />
           <div className="absolute inset-0 flex items-center justify-center">
             <div className="w-3 h-3 bg-black rounded-full border border-zinc-700"></div>
           </div>
        </div>
      </div>
    </div>
  );
};
