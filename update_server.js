const fs = require('fs');

const code = fs.readFileSync('server.ts', 'utf-8');

// We want to update the /api/search endpoint to search iTunes instead of YouTube.
// Wait, if it searches iTunes on the backend, we don't have CORS issues and we can format it nicely.
