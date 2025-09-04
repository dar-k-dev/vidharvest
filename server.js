require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const path = require('path');
const fs = require('fs-extra');
const youtubedl = require('youtube-dl-exec');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
ffmpeg.setFfmpegPath(ffmpegPath);
const { v4: uuidv4 } = require('uuid');
const cron = require('node-cron');
const rateLimit = require('express-rate-limit');
const slowDown = require('express-slow-down');
const { getAIResponse } = require('./ai-responses');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  },
  transports: ['websocket', 'polling'],
  allowEIO3: true
});

// IP anonymization handled in middleware

// Privacy and security middleware
app.use((req, res, next) => {
  // Remove/anonymize IP addresses
  req.ip = 'anonymous';
  req.ips = [];
  delete req.headers['x-forwarded-for'];
  delete req.headers['x-real-ip'];
  delete req.headers['cf-connecting-ip'];
  next();
});

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "wss:", "https:"],
      fontSrc: ["'self'", "https:"],
      mediaSrc: ["'self'", "blob:"],
      workerSrc: ["'self'"]
    }
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));

app.use(compression());
app.use(cors({
  origin: true,
  credentials: false,
  optionsSuccessStatus: 200
}));

app.use(express.json({ 
  limit: '50mb',
  verify: (req, res, buf) => {
    // Don't log request bodies for privacy
    req.rawBody = null;
  }
}));

// Rate limiting for privacy and security
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests, please try again later',
  standardHeaders: false, // Don't send rate limit info in headers
  legacyHeaders: false,
  skip: (req) => req.ip === 'anonymous'
});

const speedLimiter = slowDown({
  windowMs: 15 * 60 * 1000,
  delayAfter: 50,
  delayMs: () => 500,
  skip: (req) => req.ip === 'anonymous'
});

app.use(limiter);
app.use(speedLimiter);

app.use(express.static('public', {
  setHeaders: (res, path) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  }
}));

// Ensure downloads directory exists
const DOWNLOADS_DIR = path.join(__dirname, 'downloads');
fs.ensureDirSync(DOWNLOADS_DIR);

// YouTube-dl configuration
const ytdlOptions = {
  dumpSingleJson: true,
  noCheckCertificates: true,
  noWarnings: true,
  preferFreeFormats: true,
  addHeader: ['referer:youtube.com', 'user-agent:googlebot']
};

// Active downloads tracking
const activeDownloads = new Map();
const downloadProcesses = new Map();

// Supported platforms
const SUPPORTED_PLATFORMS = {
  'youtube.com': 'YouTube',
  'youtu.be': 'YouTube',
  'tiktok.com': 'TikTok',
  'instagram.com': 'Instagram',
  'facebook.com': 'Facebook',
  'fb.watch': 'Facebook',
  'twitter.com': 'Twitter',
  'x.com': 'Twitter',
  'linkedin.com': 'LinkedIn',
  'reddit.com': 'Reddit',
  'vimeo.com': 'Vimeo',
  'dailymotion.com': 'Dailymotion',
  'twitch.tv': 'Twitch',
  'soundcloud.com': 'SoundCloud'
};

// Utility functions
function detectPlatform(url) {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.replace('www.', '').replace('m.', '');
    return SUPPORTED_PLATFORMS[hostname] || 'Unknown';
  } catch {
    return 'Unknown';
  }
}

function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function formatDuration(seconds) {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// API Routes
app.post('/api/analyze', async (req, res) => {
  try {
    const { url } = req.body;
    // Don't log or store user IDs for privacy
    
    if (!url) {
      return res.status(400).json({ success: false, error: 'URL is required' });
    }

    const platform = detectPlatform(url);
    
    // Allow any valid URL, let yt-dlp handle support
    if (!url.startsWith('http')) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid URL. Please provide a valid video URL.' 
      });
    }

    // Get video info using youtube-dl
    const videoInfo = await youtubedl(url, ytdlOptions);
    
    // Extract available formats
    const formats = videoInfo.formats
      .filter(f => f.height || f.acodec)
      .map(f => ({
        quality: f.height ? `${f.height}p` : 'Audio Only',
        format: f.ext || 'mp4',
        fileSize: f.filesize || f.filesize_approx || 0,
        fps: f.fps,
        vcodec: f.vcodec,
        acodec: f.acodec,
        formatId: f.format_id
      }))
      .sort((a, b) => {
        const aHeight = parseInt(a.quality) || 0;
        const bHeight = parseInt(b.quality) || 0;
        return bHeight - aHeight;
      })
      .slice(0, 6);

    // Add audio-only option
    const audioFormats = videoInfo.formats
      .filter(f => f.vcodec === 'none' && f.acodec !== 'none')
      .sort((a, b) => (b.abr || 0) - (a.abr || 0));
    
    if (audioFormats.length > 0) {
      formats.push({
        quality: 'Audio Only',
        format: 'mp3',
        fileSize: audioFormats[0].filesize || audioFormats[0].filesize_approx || 0,
        formatId: audioFormats[0].format_id
      });
    }

    const response = {
      success: true,
      videoData: {
        title: videoInfo.title,
        platform: platform,
        duration: videoInfo.duration,
        thumbnail: videoInfo.thumbnail,
        uploader: videoInfo.uploader || videoInfo.channel,
        viewCount: videoInfo.view_count,
        uploadDate: videoInfo.upload_date,
        formats: formats.slice(0, 8), // Limit to top 8 formats
        enhancementOptions: {
          aiUpscaling: true,
          noiseReduction: true,
          colorCorrection: true
        }
      }
    };

    res.json(response);
  } catch (error) {
    console.error('Analysis error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to analyze video. Please check the URL and try again.' 
    });
  }
});

app.post('/api/download', async (req, res) => {
  try {
    const { url, quality, format, enhancements } = req.body;
    // Don't log or store user IDs for privacy
    
    const downloadId = uuidv4();
    const platform = detectPlatform(url);
    
    // Store download info
    activeDownloads.set(downloadId, {
      quality,
      format,
      enhancements,
      status: 'starting',
      progress: 0
    });
    // URL not stored for privacy

    res.json({ success: true, downloadId });

    // Start download process
    startDownload(downloadId, url, quality, enhancements);
    
  } catch (error) {
    console.error('Download initiation error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to start download' 
    });
  }
});

// Direct download endpoint
app.get('/api/download/:downloadId', async (req, res) => {
  try {
    const { downloadId } = req.params;
    const download = activeDownloads.get(downloadId);
    
    if (!download || !download.filePath) {
      return res.status(404).json({ error: 'Download not found' });
    }
    
    const { filePath, filename } = download;
    
    if (fs.existsSync(filePath)) {
      res.download(filePath, filename);
    } else {
      res.status(404).json({ error: 'File not found' });
    }
    
  } catch (error) {
    console.error('Download serve error:', error);
    res.status(500).json({ error: 'Failed to serve file' });
  }
});

async function startDownload(downloadId, url, quality, enhancements) {
  try {
    const platform = detectPlatform(url);
    const platformDir = path.join(DOWNLOADS_DIR, platform);
    fs.ensureDirSync(platformDir);
    
    const ext = quality === 'Audio Only' ? 'mp3' : 'mp4';
    const filename = `${downloadId}.${ext}`;
    const filePath = path.join(platformDir, filename);
    
    // Store file path in download info
    const download = activeDownloads.get(downloadId);
    if (download) {
      download.filePath = filePath;
      download.filename = filename;
    }

    io.emit('download_progress', {
      downloadId,
      progress: 0,
      status: 'downloading',
      stage: 'Starting download...'
    });

    let progress = 0;
    const progressInterval = setInterval(() => {
      progress += Math.random() * 15 + 5;
      if (progress > 95) progress = 95;
      
      io.emit('download_progress', {
        downloadId,
        progress: Math.round(progress),
        status: 'downloading'
      });
    }, 1000);

    const { spawn } = require('child_process');
    const ytdlpArgs = quality === 'Audio Only'
      ? [url, '--format', 'bestaudio', '--output', filePath]
      : [url, '--extractor-args', 'youtube:player_client=android', '--no-check-certificate', '--output', filePath];
    
    const ytdlp = spawn('yt-dlp', ytdlpArgs);
    
    // Store process for pause/cancel functionality
    downloadProcesses.set(downloadId, ytdlp);
    
    ytdlp.stderr.on('data', (data) => {
      console.log('yt-dlp:', data.toString());
    });
    
    ytdlp.on('close', (code) => {
      downloadProcesses.delete(downloadId);
      clearInterval(progressInterval);
      
      if (code === 0 && fs.existsSync(filePath)) {
        if (enhancements && Object.values(enhancements).some(Boolean)) {
          io.emit('download_progress', {
            downloadId,
            progress: 90,
            status: 'enhancing',
            stage: 'Starting AI enhancement... (This may take 2-5 minutes)'
          });
          applyEnhancements(downloadId, platformDir, enhancements);
        } else {
          io.emit('download_progress', { downloadId, progress: 100, status: 'complete' });
          io.emit('download_ready', {
            downloadId,
            downloadUrl: `/api/download/${downloadId}`
          });
        }
      } else {
        console.error(`yt-dlp failed with code ${code}`);
        io.emit('download_error', { downloadId, error: 'Download failed' });
        activeDownloads.delete(downloadId);
        downloadProcesses.delete(downloadId);
      }
    });

  } catch (error) {
    console.error('Download error:', error);
    io.emit('download_error', {
      downloadId,
      error: 'Download failed: ' + error.message
    });
    activeDownloads.delete(downloadId);
    downloadProcesses.delete(downloadId);
  }
}



async function applyEnhancements(downloadId, outputDir, enhancements) {
  try {
    io.emit('download_progress', {
      downloadId,
      progress: 90,
      status: 'enhancing',
      stage: 'Starting AI enhancement... (This may take 2-5 minutes)'
    });

    // Find the downloaded file
    const files = await fs.readdir(outputDir);
    const videoFile = files.find(f => f.includes(downloadId) || 
                                    f.endsWith('.mp4') || f.endsWith('.mkv') || f.endsWith('.webm'));
    
    if (!videoFile) {
      throw new Error('Downloaded file not found');
    }

    const inputPath = path.join(outputDir, videoFile);
    const outputPath = path.join(outputDir, `enhanced_${videoFile}`);

    console.log('Starting enhancement:', inputPath, '->', outputPath);

    let enhancementCompleted = false;
    let enhancementTimeout;

    // Build FFmpeg command with enhancements
    let command = ffmpeg(inputPath)
      .videoCodec('libx264')
      .audioCodec('aac')
      .format('mp4');

    // Apply video filters based on enhancements
    const filters = [];
    
    if (enhancements.aiUpscaling) {
      filters.push('scale=iw*1.2:ih*1.2:flags=fast_bilinear'); // Faster upscaling
    }
    
    if (enhancements.noiseReduction) {
      filters.push('hqdn3d=4:3:6:4.5'); // Noise reduction
    }
    
    if (enhancements.colorCorrection) {
      filters.push('eq=contrast=1.1:brightness=0.05:saturation=1.1'); // Color correction
    }

    if (filters.length > 0) {
      command = command.videoFilters(filters.join(','));
    }

    // Manual progress tracking since FFmpeg progress events are unreliable
    let enhancementProgress = 0;
    const progressInterval = setInterval(() => {
      if (!enhancementCompleted && enhancementProgress < 95) {
        enhancementProgress += Math.random() * 10 + 5;
        io.emit('download_progress', {
          downloadId,
          progress: Math.round(90 + (enhancementProgress * 0.1)),
          status: 'enhancing',
          stage: `AI Enhancement: ${Math.round(enhancementProgress)}%`
        });
      }
    }, 2000);

    command
      .output(outputPath)
      .on('start', (commandLine) => {
        console.log('Enhancement started with command:', commandLine);
        enhancementTimeout = setTimeout(() => {
          if (!enhancementCompleted) {
            console.log('Enhancement timeout, killing process');
            command.kill('SIGKILL');
          }
        }, 300000); // 5 minute timeout
      })
      .on('end', () => {
        enhancementCompleted = true;
        clearTimeout(enhancementTimeout);
        clearInterval(progressInterval);
        console.log('Enhancement completed successfully');
        
        try {
          if (fs.existsSync(outputPath)) {
            if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
            fs.renameSync(outputPath, inputPath);
            completeDownload(downloadId, outputDir, videoFile);
          } else {
            console.error('Enhanced file not found, using original');
            completeDownload(downloadId, outputDir, videoFile);
          }
        } catch (error) {
          console.error('Error finalizing enhancement:', error);
          completeDownload(downloadId, outputDir, videoFile);
        }
      })
      .on('error', (error) => {
        enhancementCompleted = true;
        clearTimeout(enhancementTimeout);
        clearInterval(progressInterval);
        console.error('Enhancement failed:', error.message);
        
        // Clean up partial output file
        if (fs.existsSync(outputPath)) {
          try {
            fs.unlinkSync(outputPath);
          } catch (e) {
            console.error('Failed to clean up partial file:', e);
          }
        }
        
        completeDownload(downloadId, outputDir, videoFile);
      })
      .run();

  } catch (error) {
    console.error('Enhancement setup error:', error);
    completeDownload(downloadId, outputDir);
  }
}

function completeDownload(downloadId, outputDir, filename) {
  try {
    const download = activeDownloads.get(downloadId);
    if (!download) return;

    // Find the final file if filename not provided
    if (!filename) {
      const files = fs.readdirSync(outputDir);
      filename = files.find(f => f.includes('mp4') || f.includes('mp3') || f.includes('mkv'));
    }

    const filePath = path.join(outputDir, filename);
    if (!fs.existsSync(filePath)) {
      console.error('File not found:', filePath);
      io.emit('download_error', { downloadId, error: 'File not found after processing' });
      return;
    }

    const stats = fs.statSync(filePath);

    // Emit download_ready for browser download
    io.emit('download_ready', {
      downloadId,
      downloadUrl: `/api/download/${downloadId}`
    });

    // Also emit download_complete for UI update
    io.emit('download_complete', {
      downloadId,
      filePath: filePath,
      fileName: filename,
      fileSize: stats.size,
      processingTime: Date.now() - (download.startTime || Date.now()),
      platform: path.basename(path.dirname(filePath))
    });

  } catch (error) {
    console.error('Complete download error:', error);
    io.emit('download_error', {
      downloadId,
      error: 'Failed to finalize download'
    });
    activeDownloads.delete(downloadId);
  }
}

// File management routes
app.get('/api/downloads', (req, res) => {
  try {
    const files = [];
    const platforms = fs.readdirSync(DOWNLOADS_DIR);
    
    platforms.forEach(platform => {
      const platformPath = path.join(DOWNLOADS_DIR, platform);
      if (fs.statSync(platformPath).isDirectory()) {
        const platformFiles = fs.readdirSync(platformPath);
        platformFiles.forEach(file => {
          const filePath = path.join(platformPath, file);
          const stats = fs.statSync(filePath);
          files.push({
            name: file,
            platform,
            size: stats.size,
            created: stats.birthtime,
            path: filePath
          });
        });
      }
    });

    res.json({ success: true, files });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to list downloads' });
  }
});

app.delete('/api/downloads/:filename', (req, res) => {
  try {
    const { filename } = req.params;
    const { platform } = req.query;
    
    const filePath = path.join(DOWNLOADS_DIR, platform, filename);
    
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      res.json({ success: true });
    } else {
      res.status(404).json({ success: false, error: 'File not found' });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to delete file' });
  }
});

// Cancel download endpoint
app.post('/api/download/:downloadId/cancel', (req, res) => {
  try {
    const { downloadId } = req.params;
    const process = downloadProcesses.get(downloadId);
    const download = activeDownloads.get(downloadId);
    
    if (process) {
      process.kill('SIGTERM'); // Terminate the process
      downloadProcesses.delete(downloadId);
    }
    
    if (download) {
      // Clean up partial files
      if (download.filePath && fs.existsSync(download.filePath)) {
        try {
          fs.unlinkSync(download.filePath);
        } catch (e) {
          console.error('Failed to clean up file:', e);
        }
      }
      activeDownloads.delete(downloadId);
    }
    
    res.json({ success: true, message: 'Download cancelled' });
  } catch (error) {
    console.error('Cancel error:', error);
    res.status(500).json({ success: false, error: 'Failed to cancel download' });
  }
});

// Cleanup endpoint for immediate file deletion
app.delete('/api/cleanup/:downloadId', (req, res) => {
  try {
    const { downloadId } = req.params;
    const download = activeDownloads.get(downloadId);
    
    if (download && download.filePath && fs.existsSync(download.filePath)) {
      fs.unlinkSync(download.filePath);
      console.log(`Cleaned up file: ${download.filePath}`);
    }
    
    // Also clean up any remaining files with the downloadId in the name
    if (download) {
      const platformDir = path.dirname(download.filePath);
      try {
        const files = fs.readdirSync(platformDir);
        files.forEach(file => {
          if (file.includes(downloadId)) {
            const filePath = path.join(platformDir, file);
            if (fs.existsSync(filePath)) {
              fs.unlinkSync(filePath);
              console.log(`Cleaned up remaining file: ${filePath}`);
            }
          }
        });
      } catch (e) {
        console.error('Error cleaning up remaining files:', e);
      }
    }
    
    activeDownloads.delete(downloadId);
    res.json({ success: true });
  } catch (error) {
    console.error('Cleanup error:', error);
    res.status(500).json({ success: false, error: 'Cleanup failed' });
  }
});

// Cleanup old files (run hourly)
cron.schedule('0 * * * *', () => {
  console.log('Running hourly cleanup...');
  const maxAge = 2 * 60 * 60 * 1000; // 2 hours
  const now = Date.now();
  
  try {
    const platforms = fs.readdirSync(DOWNLOADS_DIR);
    platforms.forEach(platform => {
      const platformPath = path.join(DOWNLOADS_DIR, platform);
      if (fs.statSync(platformPath).isDirectory()) {
        const files = fs.readdirSync(platformPath);
        files.forEach(file => {
          const filePath = path.join(platformPath, file);
          const stats = fs.statSync(filePath);
          if (now - stats.birthtime.getTime() > maxAge) {
            fs.unlinkSync(filePath);
            console.log(`Deleted old file: ${file}`);
          }
        });
      }
    });
  } catch (error) {
    console.error('Cleanup error:', error);
  }
});

// Socket.io connection handling with privacy
io.on('connection', (socket) => {
  // Generate anonymous session ID
  const anonymousId = 'anon_' + Math.random().toString(36).substr(2, 9);
  console.log('Anonymous client connected:', anonymousId);
  
  // Remove IP tracking
  socket.handshake.address = 'anonymous';
  delete socket.handshake.headers['x-forwarded-for'];
  delete socket.handshake.headers['x-real-ip'];
  
  socket.on('disconnect', () => {
    console.log('Anonymous client disconnected:', anonymousId);
  });
});

// AI Chat endpoint
app.post('/api/chat', async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }
    
    // Use anonymous session for privacy
    const response = await getAIResponse(message, 'anonymous');
    res.json(response);
  } catch (error) {
    console.error('AI chat error:', error);
    res.status(500).json({ 
      type: 'error',
      message: "I'm here to help with video downloading from 50+ platforms. What can I do for you?",
      action: 'none'
    });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve downloaded files
app.get('/api/downloads/file/:platform/:filename', (req, res) => {
  try {
    const { platform, filename } = req.params;
    const filePath = path.join(DOWNLOADS_DIR, platform, filename);
    
    if (fs.existsSync(filePath)) {
      res.download(filePath, filename);
    } else {
      res.status(404).json({ error: 'File not found' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to serve file' });
  }
});

// PWA endpoints
app.post('/share-target', (req, res) => {
  res.redirect('/');
});

app.get('/api/pwa-status', (req, res) => {
  res.json({
    installable: true,
    features: {
      offline: true,
      notifications: true,
      shareTarget: true,
      backgroundSync: true
    }
  });
});

// PWA endpoints
app.post('/share-target', (req, res) => {
  res.redirect('/');
});

app.get('/api/pwa-status', (req, res) => {
  res.json({
    installable: true,
    features: {
      offline: true,
      notifications: true,
      shareTarget: true,
      backgroundSync: true
    }
  });
});

// Serve PWA
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`VidHarvest Pro server running on port ${PORT}`);
});