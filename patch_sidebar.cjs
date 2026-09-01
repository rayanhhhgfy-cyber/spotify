const fs = require('fs');
let code = fs.readFileSync('src/components/Sidebar.tsx', 'utf8');

code = code.replace(
  /const handleCreatePlaylist = \(\) => \{[\s\S]*?\};/,
  `const handleCreatePlaylist = () => {
    const newPlaylist = createPlaylist(\`My Playlist #\${playlists.length + 1}\`);
    setPlaylists(getPlaylists());
    onViewChange(\`playlist:\${newPlaylist.id}\`);
  };`
);

fs.writeFileSync('src/components/Sidebar.tsx', code);
