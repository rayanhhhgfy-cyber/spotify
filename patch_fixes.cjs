const fs = require('fs');

let sidebarCode = fs.readFileSync('src/components/Sidebar.tsx', 'utf8');
sidebarCode = sidebarCode.replace(
  "import { Home, Search, Library, Plus } from 'lucide-react';",
  "import { Home, Search, Library, Plus, Compass } from 'lucide-react';"
);
fs.writeFileSync('src/components/Sidebar.tsx', sidebarCode);

let libraryCode = fs.readFileSync('src/views/LibraryView.tsx', 'utf8');
libraryCode = libraryCode.replace(
  "Array.from(files).forEach((file, index) => {",
  "Array.from(files).forEach((file: any, index) => {"
);
fs.writeFileSync('src/views/LibraryView.tsx', libraryCode);

