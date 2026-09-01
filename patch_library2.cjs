const fs = require('fs');

// Patch App.tsx to pass onViewChange
let appCode = fs.readFileSync('src/App.tsx', 'utf8');
appCode = appCode.replace(
  "{currentView === 'library' && <LibraryView />}",
  "{currentView === 'library' && <LibraryView onViewChange={setCurrentView} />}"
);
fs.writeFileSync('src/App.tsx', appCode);

// Patch LibraryView.tsx
let libraryCode = fs.readFileSync('src/views/LibraryView.tsx', 'utf8');

libraryCode = libraryCode.replace(
  "export const LibraryView: React.FC = () => {",
  `interface LibraryViewProps {
  onViewChange: (view: string) => void;
}

export const LibraryView: React.FC<LibraryViewProps> = ({ onViewChange }) => {`
);

libraryCode = libraryCode.replace(
  "import { getSavedSongs, getListeningStats, getDownloadedSongs, importSpotifyPlaylist, addSongToPlaylist, createPlaylist } from '../api';",
  "import { getSavedSongs, getListeningStats, getDownloadedSongs, importSpotifyPlaylist, addSongToPlaylist, createPlaylist, getPlaylists } from '../api';"
);

libraryCode = libraryCode.replace(
  "import { Song } from '../types';",
  "import { Song, Playlist } from '../types';"
);

libraryCode = libraryCode.replace(
  "type Tab = 'liked' | 'stats' | 'downloads' | 'local';",
  "type Tab = 'playlists' | 'liked' | 'stats' | 'downloads' | 'local';"
);

libraryCode = libraryCode.replace(
  "const [downloads, setDownloads] = useState<Song[]>([]);",
  "const [downloads, setDownloads] = useState<Song[]>([]);\n  const [playlists, setPlaylists] = useState<Playlist[]>([]);"
);

libraryCode = libraryCode.replace(
  "const [activeTab, setActiveTab] = useState<Tab>('liked');",
  "const [activeTab, setActiveTab] = useState<Tab>('playlists');"
);

libraryCode = libraryCode.replace(
  "getDownloadedSongs().then(setDownloads);",
  "getDownloadedSongs().then(setDownloads);\n      setPlaylists(getPlaylists());"
);

libraryCode = libraryCode.replace(
  "import { Heart, Download, BarChart2, Folder, Plus, Link as LinkIcon, Music } from 'lucide-react';",
  "import { Heart, Download, BarChart2, Folder, Plus, Link as LinkIcon, Music, ListMusic } from 'lucide-react';"
);

libraryCode = libraryCode.replace(
  "          { id: 'liked', label: 'Liked Songs', icon: Heart },",
  "          { id: 'playlists', label: 'Playlists', icon: ListMusic },\n          { id: 'liked', label: 'Liked Songs', icon: Heart },"
);

const playlistsTabUI = `
      {activeTab === 'playlists' && (
        <div className="space-y-8 animate-in fade-in">
          <div className="flex items-center justify-between bg-gradient-to-br from-green-600 to-emerald-900 rounded-2xl p-8 text-white shadow-xl">
            <div>
              <h2 className="text-4xl font-black tracking-tighter mb-2">Your Playlists</h2>
              <p className="text-white/80 font-medium text-lg">Your personal collections.</p>
            </div>
            <button 
              onClick={() => {
                const p = createPlaylist(\`My Playlist #\${playlists.length + 1}\`);
                setPlaylists(getPlaylists());
                onViewChange(\`playlist:\${p.id}\`);
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
                  onClick={() => onViewChange(\`playlist:\${p.id}\`)}
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
`;

libraryCode = libraryCode.replace(
  "{activeTab === 'liked' && (",
  playlistsTabUI + "\n      {activeTab === 'liked' && ("
);

fs.writeFileSync('src/views/LibraryView.tsx', libraryCode);

