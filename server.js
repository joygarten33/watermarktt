const express = require('express');
const cors = require('cors');
const axios = require('axios');
const NodeCache = require('node-cache');
const rateLimit = require('express-rate-limit');

const app = express();
const cache = new NodeCache({ stdTTL: 3600 });

app.use(cors());
app.use(express.json());

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
});
app.use('/api/', limiter);

async function fetchFromTikWM(url) {
  try {
    const response = await axios.get('https://www.tikwm.com/api/', {
      params: { url, hd: 1 },
      timeout: 10000
    });
    
    if (response.data.code === 0 && response.data.data) {
      const data = response.data.data;
      return {
        success: true,
        video_url: data.hdplay || data.play,
        video_url_watermark: data.wmplay,
        audio_url: data.music,
        cover_url: data.cover,
        title: data.title,
        author: data.author?.nickname || data.author?.unique_id,
        stats: {
          plays: data.play_count,
          likes: data.digg_count,
          comments: data.comment_count,
          shares: data.share_count
        }
      };
    }
    return null;
  } catch (error) {
    console.error('TikWM error:', error.message);
    return null;
  }
}

app.post('/api/download', async (req, res) => {
  try {
    const { url } = req.body;
    
    if (!url || !url.includes('tiktok.com')) {
      return res.status(400).json({
        success: false,
        error: 'Invalid TikTok URL'
      });
    }
    
    const cacheKey = `video_${url}`;
    const cachedData = cache.get(cacheKey);
    if (cachedData) {
      return res.json({ ...cachedData, cached: true });
    }
    
    const result = await fetchFromTikWM(url);
    
    if (!result) {
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch video'
      });
    }
    
    cache.set(cacheKey, result);
    res.json(result);
    
  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    cache_stats: cache.getStats(),
    timestamp: new Date().toISOString()
  });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`WatermarkTT API running on port ${PORT}`);
});
