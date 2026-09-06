const fs = require('fs');

let code = fs.readFileSync('src/api.ts', 'utf-8');

const searchRegex = /export const searchSongs = async \(query: string\): Promise<Song\[\]> => \{[\s\S]*?^\};\n/m;
const newSearch = `export const searchSongs = async (query: string): Promise<Song[]> => {
  if (!query.trim()) return [];

  try {
    const res = await fetch(\`/api/search?q=\${encodeURIComponent(query)}\`);
    if (res.ok) {
      const data = await res.json();
      if (data && Array.isArray(data.songs)) {
        return data.songs;
      }
    }
  } catch (e) {
    console.warn('Backend search failed', e);
  }
  return [];
};
`;

code = code.replace(searchRegex, newSearch);
fs.writeFileSync('src/api.ts', code);
