import React, { useEffect, useState, useRef } from 'react';
import { getSavedSongs, getListeningStats, getDownloadedSongs, importSpotifyPlaylist, importSharedPlaylist, importAnyPlaylist, addSongsToPlaylist, addSongToPlaylist, createPlaylist, getPlaylists, deletePlaylist } from '../api';
import { Song, Playlist } from '../types';
import { TrackList } from '../components/TrackList';
import { Heart, Download, BarChart2, Folder, Plus, Link as LinkIcon, Music, ListMusic, Trash2, Share2, Sparkles, ArrowRight } from 'lucide-react';
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
  const [quickImportInput, setQuickImportInput] = useState('');
  const [isQuickImporting, setIsQuickImporting] = useState(false);
  const [quickImportStatus, setQuickImportStatus] = useState<string | null>(null);
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

  const handleSpotifyImport = async (overrideUrl?: string) => {
    const raw = (overrideUrl || spotifyUrl).trim();
    if (!raw) return;

    // If user pasted a Spotify Clone share link or code here, automatically route to share importer
    if (raw.includes('share=') || raw.startsWith('pl_') || raw.includes('#d=') || raw.includes('?data=')) {
      handleSharedPlaylistImport(raw);
      return;
    }

    setIsImporting(true);
    setImportStatus('Extracting track metadata & resolving songs...');
    try {
      const result = await importSpotifyPlaylist(raw);
      if (result && result.songs && result.songs.length > 0) {
        const p = createPlaylist(result.name || "Imported Playlist", result.coverUrl);
        addSongsToPlaylist(p.id, result.songs);
        setPlaylists(getPlaylists());
        setSpotifyUrl('');
        setImportStatus(`Successfully imported "${result.name}" with ${result.songs.length} tracks!`);
        setTimeout(() => {
          setImportStatus(null);
          onViewChange(`playlist:${p.id}`);
        }, 1000);
      } else {
        setImportStatus('No matching songs found from this link. Try another playlist URL.');
      }
    } catch (e: any) {
      console.error('Spotify import error:', e);
      setImportStatus('Failed to import playlist. Please verify the URL.');
    }
    setIsImporting(false);
  };

  const handleQuickImport = async () => {
    const raw = quickImportInput.trim();
    if (!raw) return;

    setIsQuickImporting(true);
    setQuickImportStatus('Importing playlist...');
    try {
      const imported = await importAnyPlaylist(raw);
      if (imported && imported.songs && imported.songs.length >= 0) {
        setPlaylists(getPlaylists());
        setQuickImportInput('');
        setQuickImportStatus(`Imported "${imported.name}" with ${imported.songs.length} tracks!`);
        setTimeout(() => {
          setQuickImportStatus(null);
          onViewChange(`playlist:${imported.id}`);
        }, 1000);
      } else {
        setQuickImportStatus('Could not import playlist. Check the link and try again.');
      }
    } catch (e) {
      console.error('Quick import error:', e);
      setQuickImportStatus('Error importing playlist.');
    }
    setIsQuickImporting(false);
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
    <div className="px-3.5 sm:px-6 py-4 sm:py-6 pb-[calc(11.5rem+env(safe-area-inset-bottom,0px))] md:pb-28 animate-in fade-in">
      <div className="flex gap-2 sm:gap-3 border-b border-zinc-800/80 mb-6 pb-2 overflow-x-auto no-scrollbar select-none -mx-3.5 sm:mx-0 px-3.5 sm:px-0">
        {[
          { id: 'playlists', label: 'Playlists', icon: ListMusic },
          { id: 'liked', label: 'Liked Songs', icon: Heart },
          { id: 'stats', label: 'Stats (Wrapped)', icon: BarChart2 },
          { id: 'downloads', label: 'Downloads', icon: Download },
          { id: 'local', label: 'Local / Import', icon: Folder }
        ].map(tab => (
          <button 
            key={tab.id}
            onClick={() => setActiveTab(tab.id as Tab)}
            className={`flex items-center gap-1.5 sm:gap-2 px-3.5 py-2 rounded-full font-bold text-xs sm:text-sm transition-all whitespace-nowrap active:scale-95 touch-manipulation min-h-[40px] ${activeTab === tab.id ? 'bg-white text-black shadow-sm' : 'bg-zinc-900/90 text-zinc-400 hover:text-white border border-zinc-800/60'}`}
          >
            <tab.icon size={16} className={activeTab === tab.id ? 'fill-current' : ''} />
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      
      {activeTab === 'playlists' && (
        <div className="space-y-4 sm:space-y-6 animate-in fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gradient-to-br from-green-600 to-emerald-900 rounded-2xl p-5 sm:p-8 text-white shadow-xl">
            <div>
              <h2 className="text-2xl sm:text-4xl font-black tracking-tight mb-1">Your Playlists</h2>
              <p className="text-white/80 font-medium text-xs sm:text-base">Personal collections & imported music.</p>
            </div>
            <div className="flex items-center gap-3">
              <button 
                onClick={() => {
                  const p = createPlaylist(`My Playlist #${playlists.length + 1}`);
                  setPlaylists(getPlaylists());
                  onViewChange(`playlist:${p.id}`);
                }}
                className="bg-white text-black p-3 sm:p-4 rounded-full hover:scale-105 active:scale-95 transition-transform shadow-lg flex items-center justify-center touch-manipulation"
                title="Create new playlist"
              >
                <Plus size={20} className="fill-current" />
              </button>
            </div>
          </div>

          {/* Quick Playlist Importer directly in Playlists Tab */}
          <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-3.5 sm:p-5 shadow-lg">
            <div className="flex flex-col sm:flex-row gap-2.5 sm:gap-3">
              <div className="flex-1 relative">
                <input 
                  type="text" 
                  placeholder="Paste Spotify, Apple Music, or Share playlist link..."
                  value={quickImportInput}
                  onChange={e => setQuickImportInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleQuickImport()}
                  className="w-full bg-black/80 border border-zinc-700 rounded-xl px-3.5 py-2.5 sm:py-3 text-base sm:text-sm text-white focus:outline-none focus:border-green-500 placeholder:text-zinc-500"
                />
              </div>
              <button 
                onClick={handleQuickImport}
                disabled={isQuickImporting || !quickImportInput.trim()}
                className="bg-green-500 hover:bg-green-400 active:scale-95 disabled:opacity-50 text-black font-bold text-sm px-5 py-2.5 sm:py-3 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md flex-shrink-0 touch-manipulation"
              >
                {isQuickImporting ? (
                  <>
                    <div className="animate-spin h-4 w-4 border-2 border-black border-t-transparent rounded-full" />
                    <span>Importing...</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={16} />
                    <span>Import Playlist</span>
                  </>
                )}
              </button>
            </div>
            {quickImportStatus && (
              <p className={`mt-2 sm:mt-3 text-xs sm:text-sm font-medium ${quickImportStatus.includes('Error') || quickImportStatus.includes('Could not') ? 'text-red-400' : 'text-green-400'}`}>
                {quickImportStatus}
              </p>
            )}
          </div>
          
          {playlists.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-6">
              {playlists.map(p => (
                <div 
                  key={p.id} 
                  onClick={() => onViewChange(`playlist:${p.id}`)}
                  className="relative bg-zinc-900/50 hover:bg-zinc-800 transition-all p-3 sm:p-4 rounded-xl cursor-pointer group border border-zinc-800/40 hover:border-zinc-700 shadow-md"
                >
                  <div className="w-full aspect-square bg-zinc-800 rounded-md mb-3 sm:mb-4 flex items-center justify-center overflow-hidden shadow-md relative">
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
                      className="absolute top-2 right-2 p-1.5 sm:p-2 rounded-full bg-black/70 hover:bg-red-600 text-zinc-300 hover:text-white opacity-80 md:opacity-0 md:group-hover:opacity-100 transition-all backdrop-blur-sm shadow-md"
                      title="Delete Playlist"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <h3 className="text-white font-bold truncate text-sm sm:text-base">{p.name}</h3>
                  <p className="text-xs sm:text-sm text-zinc-400">{p.songs.length} songs</p>
                </div>
              ))}
            </div>
          ) : (
             <div className="text-center py-16 sm:py-20 bg-zinc-900/50 rounded-xl border border-zinc-800">
                <p className="text-zinc-400 font-medium">You haven't created or imported any playlists yet.</p>
                <p className="text-xs text-zinc-500 mt-1">Paste a playlist link above to import one instantly!</p>
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

            {/* 4. Library Backup */}
            <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 bg-orange-500/20 text-orange-400 rounded-2xl flex items-center justify-center mb-4 shadow">
                  <Download size={24} />
                </div>
                <h3 className="text-lg font-bold text-white mb-1">Library Backup</h3>
                <p className="text-xs text-zinc-400 mb-5 leading-relaxed">
                  Export all your playlists and saved songs to a file on your device.
                </p>
              </div>
              
              <div className="mt-auto space-y-2">
                <button 
                  onClick={() => {
                    const data = {
                      playlists: JSON.parse(localStorage.getItem('playlists') || '[]'),
                      savedSongs: JSON.parse(localStorage.getItem('saved_songs') || '[]'),
                      downloads: JSON.parse(localStorage.getItem('downloaded_songs') || '[]')
                    };
                    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `music_library_backup_${new Date().toISOString().split('T')[0]}.json`;
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                  className="w-full bg-zinc-800 text-white font-bold text-xs px-4 py-2.5 rounded-xl hover:bg-zinc-700 transition-colors border border-zinc-700"
                >
                  Download JSON Backup
                </button>
                <button 
                  onClick={() => {
                    const input = document.createElement('input');
                    input.type = 'file';
                    input.accept = 'application/json';
                    input.onchange = (e) => {
                      const file = (e.target as HTMLInputElement).files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = (e) => {
                        try {
                          const data = JSON.parse(e.target?.result as string);
                          if (data.playlists) localStorage.setItem('playlists', JSON.stringify(data.playlists));
                          if (data.savedSongs) localStorage.setItem('saved_songs', JSON.stringify(data.savedSongs));
                          if (data.downloads) localStorage.setItem('downloaded_songs', JSON.stringify(data.downloads));
                          window.location.reload();
                        } catch (err) {
                          alert('Invalid backup file');
                        }
                      };
                      reader.readAsText(file);
                    };
                    input.click();
                  }}
                  className="w-full bg-transparent text-zinc-400 font-bold text-xs px-4 py-2.5 rounded-xl hover:bg-zinc-800 hover:text-white transition-colors"
                >
                  Restore Backup
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
