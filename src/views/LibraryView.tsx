import React, { useEffect, useState, useRef } from 'react';
import { getSavedSongs, getListeningStats, getDownloadedSongs, importSpotifyPlaylist, addSongToPlaylist, createPlaylist, getPlaylists } from '../api';
import { Song, Playlist } from '../types';
import { TrackList } from '../components/TrackList';
import { Heart, Download, BarChart2, Folder, Plus, Link as LinkIcon, Music, ListMusic } from 'lucide-react';
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
    const interval = setInterval(loadSongs, 2000);
    return () => clearInterval(interval);
  }, []);

  const handleSpotifyImport = async () => {
    if (!spotifyUrl) return;
    setIsImporting(true);
    try {
      const imported = await importSpotifyPlaylist(spotifyUrl);
      if (imported.length > 0) {
        const p = createPlaylist("Imported Playlist");
        imported.forEach(s => addSongToPlaylist(p.id, s));
        setSpotifyUrl('');
        
      }
    } catch (e) {
      
    }
    setIsImporting(false);
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
    
    
    if (fileInputRef.current) fileInputRef.current.value = '';
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
              className="bg-white text-black p-4 rounded-full hover:scale-105 transition-transform"
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
                  className="bg-zinc-900/50 hover:bg-zinc-800 transition-colors p-4 rounded-xl cursor-pointer group"
                >
                  <div className="w-full aspect-square bg-zinc-800 rounded-md mb-4 flex items-center justify-center overflow-hidden shadow-md">
                    {p.songs.length > 0 ? (
                      <img src={p.songs[0].coverUrl} alt="Cover" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                    ) : (
                      <Music size={32} className="text-zinc-600" />
                    )}
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
          <h2 className="text-3xl font-black text-white tracking-tighter">Import Music</h2>
          
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-2xl">
              <div className="w-16 h-16 bg-blue-500/20 text-blue-400 rounded-full flex items-center justify-center mb-6">
                <LinkIcon size={32} />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Spotify/Apple Music</h3>
              <p className="text-zinc-400 mb-6 font-medium">Paste a playlist link to recreate it here.</p>
              
              <div className="flex gap-2">
                <input 
                  type="text"
                  placeholder="https://open.spotify.com/playlist/..." 
                  className="flex-1 bg-black border border-zinc-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-green-500"
                  value={spotifyUrl}
                  onChange={e => setSpotifyUrl(e.target.value)}
                />
                <button 
                  onClick={handleSpotifyImport}
                  disabled={isImporting}
                  className="bg-white text-black font-bold px-6 py-3 rounded-lg hover:bg-zinc-200 transition-colors disabled:opacity-50"
                >
                  {isImporting ? '...' : 'Import'}
                </button>
              </div>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-2xl relative overflow-hidden group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
              <div className="w-16 h-16 bg-green-500/20 text-green-500 rounded-full flex items-center justify-center mb-6">
                <Folder size={32} />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Local Files</h3>
              <p className="text-zinc-400 font-medium relative z-10">Select MP3/WAV files from your device.</p>
              
              <div className="absolute inset-0 border-2 border-dashed border-zinc-700 rounded-2xl group-hover:border-green-500 group-hover:bg-green-500/5 transition-colors z-0 pointer-events-none"></div>
              
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
