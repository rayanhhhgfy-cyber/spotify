import React, { useState, useEffect } from 'react';
import { Search as SearchIcon, X, Sparkles, Link as LinkIcon } from 'lucide-react';
import { searchSongs, importAnyPlaylist } from '../api';
import { Song } from '../types';
import { TrackList } from '../components/TrackList';

interface SearchViewProps {
  onViewChange?: (view: string) => void;
}

export const SearchView: React.FC<SearchViewProps> = ({ onViewChange }) => {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(false);
  const [isImportingUrl, setIsImportingUrl] = useState(false);
  const [importMessage, setImportMessage] = useState<string | null>(null);

  const isPlaylistLink = /^(https?:\/\/|pl_)/.test(query.trim());

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

    if (isPlaylistLink) {
      setLoading(false);
      return;
    }

    setLoading(true);
    searchSongs(debouncedQuery).then((results) => {
      setSongs(results);
      setLoading(false);
    });
  }, [debouncedQuery, isPlaylistLink]);

  const handleImportLink = async () => {
    const raw = query.trim();
    if (!raw) return;

    setIsImportingUrl(true);
    setImportMessage('Resolving playlist & importing tracks...');
    try {
      const imported = await importAnyPlaylist(raw);
      if (imported && imported.songs && imported.songs.length >= 0) {
        setImportMessage(`Imported "${imported.name}" with ${imported.songs.length} tracks!`);
        setTimeout(() => {
          setImportMessage(null);
          if (onViewChange) {
            onViewChange(`playlist:${imported.id}`);
          }
        }, 1000);
      } else {
        setImportMessage('Could not import playlist. Please check the URL.');
      }
    } catch (e) {
      console.error('Import error in search:', e);
      setImportMessage('Failed to import playlist.');
    }
    setIsImportingUrl(false);
  };

  return (
    <div className="px-4 sm:px-6 py-6 pb-48 md:pb-32 min-h-full">
      <div className="sticky top-0 z-20 bg-zinc-900/95 backdrop-blur-xl pt-2 pb-6 -mx-4 sm:-mx-6 px-4 sm:px-6 border-b border-transparent">
        <div className="relative max-w-md w-full">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <SearchIcon size={20} className="text-zinc-400" />
          </div>
          <input
            type="text"
            className="block w-full pl-10 pr-10 py-3 bg-zinc-800 border-transparent rounded-full text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-white focus:bg-zinc-800 transition-all text-sm font-medium"
            placeholder="Search songs, artists, or paste playlist link..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setImportMessage(null);
            }}
          />
          {query && (
            <button
              onClick={() => {
                setQuery('');
                setImportMessage(null);
              }}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-zinc-400 hover:text-white"
            >
              <X size={20} />
            </button>
          )}
        </div>
      </div>

      <div className="mt-6 sm:mt-8">
        {/* If user pasted a playlist link into search */}
        {isPlaylistLink && (
          <div className="mb-8 p-5 sm:p-6 bg-zinc-900 border border-green-500/40 rounded-2xl shadow-xl space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-green-500/20 text-green-400 flex items-center justify-center">
                <LinkIcon size={20} />
              </div>
              <div>
                <h3 className="text-white font-bold text-base sm:text-lg flex items-center gap-1.5">
                  <span>Playlist Link Detected</span>
                  <Sparkles size={16} className="text-green-400" />
                </h3>
                <p className="text-xs sm:text-sm text-zinc-400">
                  Import this playlist directly to your library to play all tracks.
                </p>
              </div>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <button
                onClick={handleImportLink}
                disabled={isImportingUrl}
                className="bg-green-500 hover:bg-green-400 disabled:opacity-50 text-black font-bold text-sm px-6 py-3 rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-md"
              >
                {isImportingUrl ? (
                  <>
                    <div className="animate-spin h-4 w-4 border-2 border-black border-t-transparent rounded-full" />
                    <span>Importing...</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={16} />
                    <span>Import & Open Playlist</span>
                  </>
                )}
              </button>
            </div>

            {importMessage && (
              <p className={`text-xs sm:text-sm font-medium pt-1 ${importMessage.includes('Could') || importMessage.includes('Failed') ? 'text-red-400' : 'text-green-400'}`}>
                {importMessage}
              </p>
            )}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center items-center h-40">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
          </div>
        ) : songs.length > 0 ? (
          <>
             <h2 className="text-xl font-bold text-white mb-6">Top Results</h2>
             <TrackList songs={songs} />
          </>
        ) : query.length > 0 && !isPlaylistLink ? (
          <div className="text-center text-zinc-400 mt-20">
             <p className="text-lg font-bold text-white mb-2">No results found for "{query}"</p>
             <p className="text-sm">Please make sure your words are spelled correctly, or use fewer or different keywords.</p>
          </div>
        ) : !isPlaylistLink && (
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
