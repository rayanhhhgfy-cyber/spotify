import React, { useEffect, useState, useRef } from 'react';
import { getSavedSongs, getListeningStats, getDownloadedSongs, importSpotifyPlaylist, importSharedPlaylist, addSongToPlaylist, createPlaylist, getPlaylists, deletePlaylist } from '../api';
import { Song, Playlist } from '../types';
import { TrackList } from '../components/TrackList';
import { Heart, Download, BarChart2, Folder, Plus, Link as LinkIcon, Music, ListMusic, Trash2, Share2, Sparkles } from 'lucide-react';
import { usePlayer } from '../context/PlayerContext';

type Tab = 'playlists' | 'liked' | 'stats' | 'downloads' | 'local';

interface LibraryViewProps {
  onViewChange: (view: string) => void;
}

export const LibraryView: React.FC<LibraryViewProps> = ({ onViewChange }) => {
  const [songs, setSongs] = useState<Song[]>([]);
  const [stats, setStats] = useState<any[]>([]);
  const [downloads, setDownloads] = useState<Song[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>('playlists');
  const [spotifyUrl, setSpotifyUrl] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const { playSong } = usePlayer();

  useEffect(() => {
    const loadSongs = () => {
      setSongs(getSavedSongs());
      setStats(getListeningStats());
      getDownloadedSongs().then(setDownloads);
      setPlaylists(getPlaylists());
    };
    loadSongs();
    const handleUpdate = () => loadSongs();
    window.addEventListener('playlists-updated', handleUpdate);
    window.addEventListener('storage', handleUpdate);
    const interval = setInterval(loadSongs, 2000);
    return () => {
      window.removeEventListener('playlists-updated', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
      clearInterval(interval);
    };
  }, []);

  const [shareInputUrl, setShareInputUrl] = useState('');
  const [isImportingShare, setIsImportingShare] = useState(false);
  const [shareStatus, setShareStatus] = useState<string | null>(null);

  const handleSpotifyImport = async () => {
    const raw = spotifyUrl.trim();
    if (!raw) return;

    // If user pasted a Spotify Clone share link or code here, automatically route to share importer
    if (raw.includes('share=') || raw.startsWith('pl_')) {
      handleSharedPlaylistImport(raw);
      return;
    }

    setIsImporting(true);
    setImportStatus('Extracting track metadata & resolving songs...');
    try {
      const result = await importSpotifyPlaylist(raw);
      if (result && result.songs && result.songs.length > 0) {
        const p = createPlaylist(result.name || "Imported Playlist");
        result.songs.forEach(s => addSongToPlaylist(p.id, s));
        setPlaylists(getPlaylists());
        setSpotifyUrl('');
        setImportStatus(`Successfully imported "${result.name}" with ${result.songs.length} tracks!`);
        setTimeout(() => {
          setImportStatus(null);
          onViewChange(`playlist:${p.id}`);
        }, 1200);
      } else {
        setImportStatus('No matching songs found from this link. Try another playlist URL.');
      }
    } catch (e: any) {
      console.error('Spotify import error:', e);
      setImportStatus('Failed to import playlist. Please verify the URL.');
    }
    setIsImporting(false);
  };

  const handleSharedPlaylistImport = async (overrideInput?: string) => {
    const input = (overrideInput || shareInputUrl).trim();
    if (!input) return;

    setIsImportingShare(true);
    setShareStatus('Fetching shared playlist & songs from server...');
    try {
      const imported = await importSharedPlaylist(input);
      if (imported && imported.songs && imported.songs.length >= 0) {
        setPlaylists(getPlaylists());
        setShareInputUrl('');
        setSpotifyUrl('');
        setShareStatus(`Imported "${imported.name}" with ${imported.songs.length} songs!`);
        setTimeout(() => {
          setShareStatus(null);
          onViewChange(`playlist:${imported.id}`);
        }, 1000);
      } else {
        setShareStatus('Shared playlist not found. Please check the link or code.');
      }
    } catch (e) {
      console.error('Shared playlist import error:', e);
      setShareStatus('Failed to load shared playlist.');
    }
    setIsImportingShare(false);
  };

  const handleLocalFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    const p = createPlaylist("Local Files");
    
    Array.from(files).forEach((file: any, index) => {
      const url = URL.createObjectURL(file);
      const song: Song = {
        id: `local-${Date.now()}-${index}`,
        title: file.name.replace(/\.[^/.]+$/, ""), // remove extension
        artist: 'Local Artist',
        album: 'Local Files',
        coverUrl: 'https://upload.wikimedia.org/wikipedia/commons/1/19/Spotify_logo_without_text.svg',
        audioUrl: url,
        duration: 0
      };
      addSongToPlaylist(p.id, song);
    });
    
    setPlaylists(getPlaylists());
    if (fileInputRef.current) fileInputRef.current.value = '';
    onViewChange(`playlist:${p.id}`);
  };

  return (
    <div className="px-6 py-8 pb-32 animate-in fade-in">
      <div className="flex gap-4 border-b border-zinc-800 mb-8 pb-2 overflow-x-auto hide-scrollbar">
        {[
          { id: 'playlists', label: 'Playlists', icon: ListMusic },
          { id: 'liked', label: 'Liked Songs', icon: Heart },
          { id: 'stats', label: 'Stats (Wrapped)', icon: BarChart2 },
          { id: 'downloads', label: 'Downloads', icon: Download },
          { id: 'local', label: 'Local Files / Import', icon: Folder }
        ].map(tab => (
          <button 
            key={tab.id}
            onClick={() => setActiveTab(tab.id as Tab)}
            className={`flex items-center gap-2 px-4 py-2 rounded-full font-bold transition-all whitespace-nowrap ${activeTab === tab.id ? 'bg-white text-black' : 'bg-zinc-900 text-zinc-400 hover:text-white'}`}
          >
            <tab.icon size={18} className={activeTab === tab.id ? 'fill-current' : ''} />
            {tab.label}
          </button>
        ))}
      </div>

      
      {activeTab === 'playlists' && (
        <div className="space-y-8 animate-in fade-in">
          <div className="flex items-center justify-between bg-gradient-to-br from-green-600 to-emerald-900 rounded-2xl p-8 text-white shadow-xl">
            <div>
              <h2 className="text-4xl font-black tracking-tighter mb-2">Your Playlists</h2>
              <p className="text-white/80 font-medium text-lg">Your personal collections.</p>
            </div>
            <button 
              onClick={() => {
                const p = createPlaylist(`My Playlist #${playlists.length + 1}`);
                setPlaylists(getPlaylists());
                onViewChange(`playlist:${p.id}`);
              }}
              className="bg-white text-black p-4 rounded-full hover:scale-105 transition-transform shadow-lg"
              title="Create new playlist"
            >
              <Plus size={24} className="fill-current" />
            </button>
          </div>
          
          {playlists.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {playlists.map(p => (
                <div 
                  key={p.id} 
                  onClick={() => onViewChange(`playlist:${p.id}`)}
                  className="relative bg-zinc-900/50 hover:bg-zinc-800 transition-all p-4 rounded-xl cursor-pointer group border border-zinc-800/40 hover:border-zinc-700 shadow-md"
                >
                  <div className="w-full aspect-square bg-zinc-800 rounded-md mb-4 flex items-center justify-center overflow-hidden shadow-md relative">
                    {p.songs.length > 0 ? (
                      <img src={p.songs[0].coverUrl} alt="Cover" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                    ) : (
                      <Music size={32} className="text-zinc-600" />
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (window.confirm(`Delete playlist "${p.name}"?`)) {
                          deletePlaylist(p.id);
                        }
                      }}
                      className="absolute top-2 right-2 p-2 rounded-full bg-black/70 hover:bg-red-600 text-zinc-300 hover:text-white opacity-0 group-hover:opacity-100 transition-all backdrop-blur-sm shadow-md"
                      title="Delete Playlist"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <h3 className="text-white font-bold truncate">{p.name}</h3>
                  <p className="text-sm text-zinc-400">{p.songs.length} songs</p>
                </div>
              ))}
            </div>
          ) : (
             <div className="text-center py-20 bg-zinc-900/50 rounded-xl border border-zinc-800">
                <p className="text-zinc-400 font-medium">You haven't created any playlists yet.</p>
             </div>
          )}
        </div>
      )}

      {activeTab === 'liked' && (
        <>
          <div className="flex items-end space-x-6 mb-8">
            <div className="w-32 h-32 md:w-48 md:h-48 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-800 flex items-center justify-center shadow-xl">
              <Heart size={64} className="text-white fill-white shadow-sm" />
            </div>
            <div className="pb-2">
              <p className="text-xs font-bold uppercase tracking-wider text-white mb-2">Playlist</p>
              <h1 className="text-4xl md:text-6xl font-black text-white mb-4 tracking-tighter">Liked Songs</h1>
              <p className="text-zinc-300 font-medium flex items-center space-x-2">
                <span className="text-white font-bold">You</span>
                <span>•</span>
                <span>{songs.length} songs</span>
              </p>
            </div>
          </div>
          <div className="mb-8">
             {songs.length > 0 ? (
                <TrackList songs={songs} />
             ) : (
                <div className="text-center py-20 bg-zinc-900/50 rounded-xl border border-zinc-800">
                   <h2 className="text-2xl font-bold text-white mb-4">Songs you like will appear here</h2>
                   <p className="text-zinc-400 font-medium">Save songs by tapping the heart icon.</p>
                </div>
             )}
          </div>
        </>
      )}

      {activeTab === 'stats' && (
        <div className="space-y-8 animate-in fade-in">
          <div className="bg-gradient-to-br from-pink-600 to-orange-500 rounded-2xl p-8 text-white shadow-xl">
            <h2 className="text-4xl font-black tracking-tighter mb-2">Your Listening Stats</h2>
            <p className="text-white/80 font-medium text-lg">Your top tracks this month.</p>
          </div>
          
          {stats.length > 0 ? (
            <div className="grid gap-4">
              {stats.slice(0, 50).map((stat, i) => (
                <div key={stat.song.id} className="flex items-center gap-4 bg-zinc-900/50 p-4 rounded-xl border border-zinc-800">
                  <div className="text-2xl font-black text-zinc-600 w-8 text-center">{i + 1}</div>
                  <img src={stat.song.coverUrl} className="w-12 h-12 rounded object-cover shadow-md" />
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-white truncate">{stat.song.title}</p>
                    <p className="text-sm text-zinc-400 truncate">{stat.song.artist}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-white">{stat.count} plays</p>
                    <p className="text-xs text-zinc-500">{Math.round(stat.totalMs / 60000)} mins</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
             <div className="text-center py-20 bg-zinc-900/50 rounded-xl border border-zinc-800">
                <p className="text-zinc-400 font-medium">No listening history yet. Start playing music!</p>
             </div>
          )}
        </div>
      )}

      {activeTab === 'downloads' && (
        <div className="space-y-8 animate-in fade-in">
          <div className="bg-gradient-to-br from-green-600 to-emerald-900 rounded-2xl p-8 text-white shadow-xl flex items-center justify-between">
            <div>
              <h2 className="text-4xl font-black tracking-tighter mb-2">Offline Downloads</h2>
              <p className="text-white/80 font-medium text-lg">Music available without internet.</p>
            </div>
            <Download size={48} className="opacity-50" />
          </div>
          
          {downloads.length > 0 ? (
            <TrackList songs={downloads} />
          ) : (
            <div className="text-center py-20 bg-zinc-900/50 rounded-xl border border-zinc-800">
               <p className="text-zinc-400 font-medium">You haven't downloaded any music yet.</p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'local' && (
        <div className="space-y-8 animate-in fade-in">
          <div>
            <h2 className="text-3xl font-black text-white tracking-tighter mb-1">Import Music & Playlists</h2>
            <p className="text-zinc-400 text-sm">Sync shared playlists across devices or import from Spotify and local files.</p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-6">
            {/* 1. Shared Playlist Link / Code */}
            <div className="bg-zinc-900 border border-green-500/30 p-6 rounded-2xl flex flex-col justify-between relative overflow-hidden shadow-lg">
              <div className="absolute top-0 right-0 w-28 h-28 bg-green-500/10 rounded-full blur-2xl pointer-events-none" />
              <div>
                <div className="w-12 h-12 bg-green-500/20 text-green-400 rounded-2xl flex items-center justify-center mb-4 shadow">
                  <Share2 size={24} />
                </div>
                <h3 className="text-lg font-bold text-white mb-1 flex items-center gap-1.5">
                  <span>Shared Playlist</span>
                  <Sparkles size={14} className="text-green-400" />
                </h3>
                <p className="text-xs text-zinc-400 mb-5 leading-relaxed">
                  Enter a share link or code (e.g. <span className="text-zinc-300 font-mono">pl_xyz123</span>) to import it to this device.
                </p>
              </div>
              
              <div>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    placeholder="Paste link or share code..." 
                    className="flex-1 bg-black border border-zinc-700 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-green-500 font-mono"
                    value={shareInputUrl}
                    onChange={e => setShareInputUrl(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSharedPlaylistImport()}
                  />
                  <button 
                    onClick={() => handleSharedPlaylistImport()}
                    disabled={isImportingShare || !shareInputUrl.trim()}
                    className="bg-green-500 text-black font-bold text-xs px-4 py-2.5 rounded-xl hover:bg-green-400 transition-colors disabled:opacity-50 flex items-center gap-1 cursor-pointer"
                  >
                    {isImportingShare ? 'Syncing...' : 'Get'}
                  </button>
                </div>

                {shareStatus && (
                  <div className="mt-3 p-2.5 rounded-lg bg-zinc-800 border border-zinc-700 text-xs text-zinc-300 font-medium">
                    {shareStatus}
                  </div>
                )}
              </div>
            </div>

            {/* 2. Spotify / Apple Music Importer */}
            <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 bg-blue-500/20 text-blue-400 rounded-2xl flex items-center justify-center mb-4 shadow">
                  <LinkIcon size={24} />
                </div>
                <h3 className="text-lg font-bold text-white mb-1">Spotify Playlist</h3>
                <p className="text-xs text-zinc-400 mb-5 leading-relaxed">
                  Paste any Spotify playlist link to resolve full-length songs.
                </p>
              </div>
              
              <div>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    placeholder="https://open.spotify.com/..." 
                    className="flex-1 bg-black border border-zinc-700 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-green-500"
                    value={spotifyUrl}
                    onChange={e => setSpotifyUrl(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSpotifyImport()}
                  />
                  <button 
                    onClick={handleSpotifyImport}
                    disabled={isImporting || !spotifyUrl.trim()}
                    className="bg-blue-500 text-white font-bold text-xs px-4 py-2.5 rounded-xl hover:bg-blue-400 transition-colors disabled:opacity-50 flex items-center gap-1 cursor-pointer"
                  >
                    {isImporting ? 'Loading...' : 'Import'}
                  </button>
                </div>

                {importStatus && (
                  <div className="mt-3 p-2.5 rounded-lg bg-zinc-800 border border-zinc-700 text-xs text-zinc-300 font-medium">
                    {importStatus}
                  </div>
                )}
              </div>
            </div>

            {/* 3. Local Audio Files */}
            <div 
              className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl flex flex-col justify-between relative overflow-hidden group cursor-pointer hover:border-zinc-700 transition-colors" 
              onClick={() => fileInputRef.current?.click()}
            >
              <div>
                <div className="w-12 h-12 bg-purple-500/20 text-purple-400 rounded-2xl flex items-center justify-center mb-4 shadow">
                  <Folder size={24} />
                </div>
                <h3 className="text-lg font-bold text-white mb-1">Local Files</h3>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Select audio files from your computer or phone to play instantly.
                </p>
              </div>

              <div className="mt-6 pt-4 border-t border-zinc-800 flex items-center justify-between text-xs text-zinc-400 group-hover:text-white">
                <span className="font-semibold">Browse audio files</span>
                <span className="text-purple-400 font-bold">&rarr;</span>
              </div>
              
              <input 
                type="file" 
                multiple 
                accept="audio/*"
                className="hidden" 
                ref={fileInputRef}
                onChange={handleLocalFiles}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
