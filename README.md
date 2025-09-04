# VidHarvest Pro - ChatGPT-Style Video Downloader PWA

A production-ready Progressive Web App that provides a ChatGPT-style interface for downloading videos from 50+ platforms including YouTube, TikTok, Instagram, Facebook, and more.

## Features

### 🎯 Core Functionality
- **ChatGPT-Style Interface** - Familiar conversational UI for easy interaction
- **50+ Platform Support** - YouTube, TikTok, Instagram, Facebook, Twitter, LinkedIn, Reddit, Vimeo, and more
- **Multiple Quality Options** - 4K, 1080p, 720p, 480p, and audio-only downloads
- **AI Enhancement** - Upscaling, noise reduction, and color correction
- **Real-time Progress** - Live download progress with speed and ETA tracking
- **Batch Downloads** - Support for playlists and multiple URLs

### 🚀 PWA Features
- **Offline Support** - Works without internet connection
- **App Installation** - Install as native app on any device
- **Push Notifications** - Get notified when downloads complete
- **Background Sync** - Resume downloads when connection restored
- **Share Target** - Share videos directly to the app

### 🎨 User Experience
- **Dark/Light Theme** - Automatic theme switching
- **Responsive Design** - Works on desktop, tablet, and mobile
- **Keyboard Shortcuts** - Quick navigation and actions
- **Chat History** - Save and search previous conversations
- **Export Options** - Export chat history in multiple formats

## Installation

### Prerequisites
- Node.js 16+ 
- npm or yarn
- FFmpeg (for video enhancement)
- yt-dlp (for video downloading)

### Setup
1. Clone the repository:
```bash
git clone https://github.com/your-username/vidharvest-pro.git
cd vidharvest-pro
```

2. Install dependencies:
```bash
npm install
```

3. Install system dependencies:
```bash
# Windows (using chocolatey)
choco install ffmpeg yt-dlp

# macOS (using homebrew)
brew install ffmpeg yt-dlp

# Ubuntu/Debian
sudo apt update
sudo apt install ffmpeg
pip install yt-dlp
```

4. Start the development server:
```bash
npm run dev
```

5. Open http://localhost:3000 in your browser

## Production Deployment

### Build for Production
```bash
npm run build
npm start
```

### Environment Variables
Create a `.env` file in the root directory:
```env
PORT=3000
NODE_ENV=production
DOWNLOAD_PATH=/path/to/downloads
MAX_CONCURRENT_DOWNLOADS=3
VAPID_PUBLIC_KEY=your_vapid_public_key
VAPID_PRIVATE_KEY=your_vapid_private_key
```

### Docker Deployment
```bash
# Build Docker image
docker build -t vidharvest-pro .

# Run container
docker run -p 3000:3000 -v /downloads:/app/downloads vidharvest-pro
```

## Usage

### Basic Video Download
1. Open VidHarvest Pro
2. Paste any video URL in the chat input
3. Choose your preferred quality and enhancement options
4. Click download and wait for completion

### Supported Platforms
- **YouTube** - Videos, shorts, playlists, live streams
- **TikTok** - Videos with watermark removal
- **Instagram** - Posts, reels, stories, IGTV
- **Facebook** - Videos, reels, stories
- **Twitter/X** - Videos and GIFs
- **LinkedIn** - Native videos
- **Reddit** - v.redd.it videos
- **Vimeo** - All video types
- **And 40+ more platforms**

### Quality Options
- **4K (2160p)** - Ultra HD quality
- **1080p HD** - Full HD quality
- **720p HD** - Standard HD quality
- **480p** - Mobile-friendly quality
- **Audio Only** - MP3 audio extraction

### Enhancement Features
- **AI Upscaling** - Improve video resolution using AI
- **Noise Reduction** - Remove background noise from audio
- **Color Correction** - Auto-balance colors and contrast

## API Documentation

### Analyze Video
```http
POST /api/analyze
Content-Type: application/json

{
  "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  "userId": "unique_user_id"
}
```

### Start Download
```http
POST /api/download
Content-Type: application/json

{
  "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  "quality": "1080p",
  "format": "mp4",
  "enhancements": {
    "aiUpscaling": true,
    "noiseReduction": false,
    "colorCorrection": true
  },
  "userId": "unique_user_id"
}
```

### WebSocket Events
- `download_progress` - Real-time download progress
- `download_complete` - Download finished successfully
- `download_error` - Download failed with error

## Architecture

### Frontend
- **Vanilla JavaScript** - No framework dependencies
- **CSS Grid/Flexbox** - Modern responsive layout
- **Service Worker** - PWA functionality and offline support
- **WebSocket** - Real-time communication

### Backend
- **Node.js/Express** - Server framework
- **Socket.io** - Real-time communication
- **yt-dlp** - Video extraction
- **FFmpeg** - Video processing and enhancement
- **File System** - Local file management

### PWA Features
- **Service Worker** - Caching and offline functionality
- **Web App Manifest** - App installation and metadata
- **Push API** - Background notifications
- **Background Sync** - Offline action queuing
- **Share Target API** - Receive shared content

## Development

### Project Structure
```
vidharvest-pro/
├── public/
│   ├── css/
│   │   └── styles.css
│   ├── js/
│   │   ├── app.js
│   │   ├── chat.js
│   │   ├── download.js
│   │   └── pwa.js
│   ├── images/
│   ├── manifest.json
│   ├── sw.js
│   └── index.html
├── downloads/
├── server.js
├── package.json
└── README.md
```

### Adding New Platforms
1. Update the `SUPPORTED_PLATFORMS` object in `server.js`
2. Test video extraction with yt-dlp
3. Add platform-specific handling if needed
4. Update documentation

### Customizing UI
- Modify CSS variables in `styles.css` for theming
- Update `app.js` for new functionality
- Customize chat responses in message handlers

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make your changes and test thoroughly
4. Commit your changes: `git commit -am 'Add feature'`
5. Push to the branch: `git push origin feature-name`
6. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

- **Documentation**: https://vidharvest.pro/docs
- **Issues**: https://github.com/your-username/vidharvest-pro/issues
- **Discussions**: https://github.com/your-username/vidharvest-pro/discussions

## Acknowledgments

- **yt-dlp** - Video extraction library
- **FFmpeg** - Video processing
- **OpenAI** - ChatGPT UI inspiration
- **Contributors** - All project contributors

---

**VidHarvest Pro** - Your AI Video Assistant 🎥✨