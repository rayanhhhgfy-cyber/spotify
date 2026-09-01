const fs = require('fs');
let code = fs.readFileSync('src/components/MobileNav.tsx', 'utf8');
code = code.replace(
  "import { Home, Search, Library } from 'lucide-react';",
  "import { Home, Search, Library, Compass } from 'lucide-react';"
);
code = code.replace(
  "icon: Search },",
  "icon: Search },\n    { id: 'discover', label: 'Discover', icon: Compass },"
);
fs.writeFileSync('src/components/MobileNav.tsx', code);
