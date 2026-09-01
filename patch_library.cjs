const fs = require('fs');
let code = fs.readFileSync('src/views/LibraryView.tsx', 'utf8');

code = code.replace(
  "alert(`Successfully imported ${imported.length} tracks to a new playlist!`);",
  ""
);
code = code.replace(
  "alert(\"Failed to import playlist.\");",
  ""
);
code = code.replace(
  "alert(`Added ${files.length} local files to 'Local Files' playlist.`);",
  ""
);

fs.writeFileSync('src/views/LibraryView.tsx', code);
