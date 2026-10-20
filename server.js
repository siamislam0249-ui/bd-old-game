const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static frontend assets from public directory
app.use(express.static(path.join(__dirname, 'public')));

// Health check endpoint for Render.com
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', game: 'Ekkadokka 3D', timestamp: new Date().toISOString() });
});

// Catch-all route to serve index.html (compatible with all Express versions)
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`===============================================`);
  console.log(`🇧🇩 এক্কাদোক্কা (কুতকুত) 3D গেম সার্ভার চালু হয়েছে!`);
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🌐 Local URL: http://localhost:${PORT}`);
  console.log(`===============================================`);
});
