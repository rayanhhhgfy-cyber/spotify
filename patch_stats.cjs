const fs = require('fs');
let code = fs.readFileSync('src/context/PlayerContext.tsx', 'utf8');

code = code.replace(
  "import { Song } from '../types';",
  "import { Song } from '../types';\nimport { recordPlay } from '../api';"
);

code = code.replace(
  "const playSong = (song: Song, newQueue: Song[] = []) => {",
  "const playSong = (song: Song, newQueue: Song[] = []) => {\n    recordPlay(song);"
);

code = code.replace(
  "const _playDirectly = (song: Song) => {",
  "const _playDirectly = (song: Song) => {\n    recordPlay(song);"
);

fs.writeFileSync('src/context/PlayerContext.tsx', code);
