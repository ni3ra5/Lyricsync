const { exec } = require('child_process');
const { getRoom } = require('./rooms');

function fetchAudioUrl(videoIdOrQuery, source) {
  return new Promise((resolve, reject) => {
    const ytDlp = process.env.YT_DLP_PATH || '/Users/nibraskhan/Library/Python/3.9/bin/yt-dlp';
    // For YouTube results, use direct video URL; for iTunes, search by title+artist
    const target = source === 'itunes'
      ? `"ytsearch1:${videoIdOrQuery.replace(/"/g, '\\"')}"`
      : `"https://www.youtube.com/watch?v=${videoIdOrQuery}"`;
    const cmd = `"${ytDlp}" -f "bestaudio/best" --extractor-args "youtube:player_client=android" --get-url ${target}`;

    console.log('Running yt-dlp cmd:', cmd);
    exec(cmd, { timeout: 30000 }, (error, stdout, stderr) => {
      if (error) {
        console.error('yt-dlp error:', error.message);
        console.error('yt-dlp stderr:', stderr);
        reject(error);
        return;
      }
      console.log('yt-dlp stdout:', stdout.substring(0, 200));
      const url = stdout.trim().split('\n').filter(l => l.startsWith('http')).pop() || stdout.trim();
      if (url) {
        console.log('Resolved audio URL:', url.substring(0, 80));
        resolve(url);
      } else {
        reject(new Error('No audio URL returned'));
      }
    });
  });
}

function setupAudioRoute(app) {
  app.get('/audio/:roomId', async (req, res) => {
    const room = getRoom(req.params.roomId);
    if (!room || !room.audioUrl) {
      return res.status(404).json({ error: 'No audio available' });
    }

    try {
      const proxyHeaders = {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://www.youtube.com/',
        'Origin': 'https://www.youtube.com',
      };
      if (req.headers.range) proxyHeaders['Range'] = req.headers.range;

      const audioRes = await fetch(room.audioUrl, { headers: proxyHeaders });

      res.status(audioRes.status);
      audioRes.headers.forEach((value, key) => {
        if (['content-type', 'content-length', 'content-range', 'accept-ranges'].includes(key.toLowerCase())) {
          res.setHeader(key, value);
        }
      });

      const reader = audioRes.body.getReader();
      const pump = async () => {
        while (true) {
          const { done, value } = await reader.read();
          if (done) { res.end(); break; }
          if (!res.write(value)) {
            await new Promise(r => res.once('drain', r));
          }
        }
      };
      pump().catch(() => res.end());

      req.on('close', () => reader.cancel());
    } catch (err) {
      console.error('Audio proxy error:', err.message);
      res.status(500).json({ error: 'Audio stream failed' });
    }
  });
}

module.exports = { fetchAudioUrl, setupAudioRoute };
