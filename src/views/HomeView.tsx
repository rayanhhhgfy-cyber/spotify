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
    <div className="px-6 py-8 pb-32 animate-in fade-in duration-500">
      <h1 className="text-3xl font-bold text-white mb-6 tracking-tight">{getGreeting()}</h1>
      
      {/* Featured Header Card */}
      {songs.length > 0 && (
        <div className="mb-10 group relative rounded-2xl overflow-hidden bg-gradient-to-br from-purple-900 via-indigo-900 to-zinc-900 p-8 flex flex-col md:flex-row items-end md:items-center gap-8 shadow-2xl transition-all hover:bg-zinc-800">
           <img 
               src={songs[0]?.coverUrl || 'https://upload.wikimedia.org/wikipedia/commons/1/19/Spotify_logo_without_text.svg'} 
               alt="Featured" 
               className="w-32 h-32 md:w-56 md:h-56 rounded-xl shadow-2xl object-cover ring-1 ring-white/10"
               onError={(e) => { e.currentTarget.src = 'https://upload.wikimedia.org/wikipedia/commons/1/19/Spotify_logo_without_text.svg' }}
           />
           <div className="flex-1 min-w-0">
              <p className="text-xs uppercase font-bold tracking-[0.2em] text-indigo-300 mb-3 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                Trending Now
              </p>
              <h2 className="text-4xl md:text-6xl font-black text-white mb-3 tracking-tighter truncate">{songs[0].title}</h2>
              <p className="text-xl text-zinc-300 font-medium">{songs[0].artist}</p>
           </div>
           
           <button 
              onClick={() => playSong(songs[0], songs)}
              className="md:absolute md:bottom-8 md:right-8 w-16 h-16 bg-green-500 rounded-full flex items-center justify-center text-black hover:scale-105 hover:bg-green-400 transition-all shadow-xl z-10"
           >
              <Play size={32} className="fill-current ml-1" />
           </button>
        </div>
      )}

      <h2 className="text-2xl font-bold text-white mb-6">Popular Right Now</h2>
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
