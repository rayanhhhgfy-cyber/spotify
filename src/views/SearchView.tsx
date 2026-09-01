import React, { useState, useEffect } from 'react';
import { Search as SearchIcon, X } from 'lucide-react';
import { searchSongs } from '../api';
import { Song } from '../types';
import { TrackList } from '../components/TrackList';

export const SearchView: React.FC = () => {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(false);

  // Debounce logic
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, 500);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    if (debouncedQuery.trim().length === 0) {
      setSongs([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    searchSongs(debouncedQuery).then((results) => {
      setSongs(results);
      setLoading(false);
    });
  }, [debouncedQuery]);

  return (
    <div className="px-6 py-8 pb-32 min-h-full">
      <div className="sticky top-0 z-20 bg-zinc-900/95 backdrop-blur-xl pt-2 pb-6 -mx-6 px-6 border-b border-transparent">
        <div className="relative max-w-md w-full">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <SearchIcon size={20} className="text-zinc-400" />
          </div>
          <input
            type="text"
            className="block w-full pl-10 pr-10 py-3 bg-zinc-800 border-transparent rounded-full text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-white focus:bg-zinc-800 transition-all text-sm font-medium"
            placeholder="What do you want to listen to?"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-zinc-400 hover:text-white"
            >
              <X size={20} />
            </button>
          )}
        </div>
      </div>

      <div className="mt-8">
        {loading ? (
          <div className="flex justify-center items-center h-40">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
          </div>
        ) : songs.length > 0 ? (
          <>
             <h2 className="text-xl font-bold text-white mb-6">Top Results</h2>
             <TrackList songs={songs} />
          </>
        ) : query.length > 0 ? (
          <div className="text-center text-zinc-400 mt-20">
             <p className="text-lg font-bold text-white mb-2">No results found for "{query}"</p>
             <p className="text-sm">Please make sure your words are spelled correctly, or use fewer or different keywords.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
             {/* Browse Categories */}
             {['Pop', 'Hip-Hop', 'Rock', 'Latin', 'Workout', 'Chill', 'Mood', 'Indie'].map((genre, i) => (
                <div 
                   key={i} 
                   onClick={() => setQuery(genre)}
                   className="aspect-square rounded-xl bg-zinc-800 p-4 relative overflow-hidden group cursor-pointer hover:scale-[1.02] transition-transform"
                >
                   <h3 className="text-white font-bold text-xl">{genre}</h3>
                   <div className="absolute -bottom-4 -right-4 w-24 h-24 bg-zinc-700 rounded-lg rotate-[25deg] shadow-2xl group-hover:bg-zinc-600 transition-colors"></div>
                </div>
             ))}
          </div>
        )}
      </div>
    </div>
  );
};
