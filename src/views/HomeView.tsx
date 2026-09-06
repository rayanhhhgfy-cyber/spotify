import React, { useEffect, useState } from 'react';
import { getTrendingSongs } from '../api';
import { Song } from '../types';
import { TrackList } from '../components/TrackList';
import { Play } from 'lucide-react';
import { usePlayer } from '../context/PlayerContext';

export const HomeView: React.FC = () => {
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);
  const { playSong } = usePlayer();

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 18) return 'Good Afternoon';
    return 'Good Evening';
  };

  useEffect(() => {
    getTrendingSongs().then((results) => {
      setSongs(results.slice(0, 20));
      setLoading(false);
    });
  }, []);

  return (
    <div className="px-3.5 sm:px-6 py-4 sm:py-8 animate-in fade-in duration-500">
      <h1 className="text-2xl sm:text-3xl font-black text-white mb-4 sm:mb-6 tracking-tight">{getGreeting()}</h1>
      
      {/* Featured Header Card */}
      {songs.length > 0 && (
        <div className="mb-6 sm:mb-10 group relative rounded-2xl overflow-hidden bg-gradient-to-br from-purple-950 via-indigo-950 to-zinc-950 p-4 sm:p-8 flex flex-col md:flex-row items-start md:items-center gap-4 sm:gap-8 shadow-2xl border border-white/5 transition-all">
           <img 
               src={songs[0]?.coverUrl || 'https://upload.wikimedia.org/wikipedia/commons/1/19/Spotify_logo_without_text.svg'} 
               alt="Featured" 
               className="w-24 h-24 sm:w-36 sm:h-36 md:w-52 md:h-52 rounded-xl shadow-xl object-cover ring-1 ring-white/10 flex-shrink-0"
               onError={(e) => { e.currentTarget.src = 'https://upload.wikimedia.org/wikipedia/commons/1/19/Spotify_logo_without_text.svg' }}
           />
           <div className="flex-1 min-w-0 w-full">
              <p className="text-[10px] sm:text-xs uppercase font-bold tracking-[0.2em] text-indigo-300 mb-1.5 sm:mb-3 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                Trending Now
              </p>
              <h2 className="text-2xl sm:text-4xl md:text-5xl font-black text-white mb-1 sm:mb-2 tracking-tight truncate">{songs[0].title}</h2>
              <p className="text-sm sm:text-lg text-zinc-300 font-medium truncate">{songs[0].artist}</p>
           </div>
           
           <button 
              onClick={() => playSong(songs[0], songs)}
              className="self-end md:self-auto md:absolute md:bottom-8 md:right-8 w-12 h-12 sm:w-16 sm:h-16 bg-green-500 rounded-full flex items-center justify-center text-black hover:scale-105 active:scale-95 hover:bg-green-400 transition-all shadow-xl flex-shrink-0 touch-manipulation cursor-pointer"
              title="Play trending track"
           >
              <Play size={24} className="fill-current ml-0.5 sm:hidden" />
              <Play size={30} className="fill-current ml-1 hidden sm:block" />
           </button>
        </div>
      )}

      <h2 className="text-xl sm:text-2xl font-bold text-white mb-4 sm:mb-6">Popular Right Now</h2>
      {loading ? (
        <div className="flex justify-center items-center h-40">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
        </div>
      ) : (
        <TrackList songs={songs.slice(1)} />
      )}
    </div>
  );
};
