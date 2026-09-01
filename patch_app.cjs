const fs = require('fs');

let appCode = fs.readFileSync('src/App.tsx', 'utf8');
appCode = appCode.replace(
  "import { QueueView } from './views/QueueView';",
  "import { QueueView } from './views/QueueView';\nimport { DiscoverView } from './views/DiscoverView';"
);
appCode = appCode.replace(
  "{currentView === 'library' && <LibraryView />}",
  "{currentView === 'library' && <LibraryView />}\n          {currentView === 'discover' && <DiscoverView />}"
);
fs.writeFileSync('src/App.tsx', appCode);

let sidebarCode = fs.readFileSync('src/components/Sidebar.tsx', 'utf8');
sidebarCode = sidebarCode.replace(
  "import { Home, Search, Library, Plus, Heart } from 'lucide-react';",
  "import { Home, Search, Library, Plus, Heart, Compass } from 'lucide-react';"
);
sidebarCode = sidebarCode.replace(
  "icon: Search },",
  "icon: Search },\n    { id: 'discover', label: 'Discover', icon: Compass },"
);
fs.writeFileSync('src/components/Sidebar.tsx', sidebarCode);
