// VidHarvest Pro - Main Application JavaScript

class VidHarvestApp {
    constructor() {
        this.socket = io();
        this.currentSession = null;
        this.chatHistory = [];
        this.activeDownloads = new Map();
        this.settings = this.loadSettings();
        
        // Initialize modules
        this.chatManager = null;
        this.downloadManager = null;
        this.pwaManager = null;
        
        this.init();
    }

    init() {
        this.initializeElements();
        this.bindEvents();
        this.initializeSocket();
        this.loadTheme();
        
        // Initialize modules after DOM is ready
        this.initializeModules();
        
        // Make app globally available
        window.app = this;
        
        this.showWelcomeMessage();
        this.loadChatHistory();
    }

    initializeModules() {
        // PWA manager would be initialized here if needed
        // For now, all functionality is in the main app class
        console.log('App modules initialized');
    }

    initializeElements() {
        // Header elements
        this.headerStatus = document.getElementById('headerStatus');
        this.historyBtn = document.getElementById('historyBtn');
        this.settingsBtn = document.getElementById('settingsBtn');
        this.themeToggle = document.getElementById('themeToggle');
        this.newChatBtn = document.getElementById('newChatBtn');
        this.historyBadge = document.getElementById('historyBadge');

        // Chat elements
        this.chatMessages = document.getElementById('chatMessages');
        this.chatInput = document.getElementById('chatInput');
        this.pasteBtn = document.getElementById('pasteBtn');
        this.sendBtn = document.getElementById('sendBtn');

        // Modal elements
        this.historyModal = document.getElementById('historyModal');
        this.settingsModal = document.getElementById('settingsModal');
        this.loadingOverlay = document.getElementById('loadingOverlay');

        // Settings elements
        this.defaultQuality = document.getElementById('defaultQuality');
        this.autoUpscale = document.getElementById('autoUpscale');
        this.autoNoise = document.getElementById('autoNoise');
        this.autoColor = document.getElementById('autoColor');
    }

    bindEvents() {
        // Header events
        this.historyBtn.addEventListener('click', () => this.showHistoryModal());
        this.settingsBtn.addEventListener('click', () => this.showSettingsModal());
        this.themeToggle.addEventListener('click', () => this.toggleTheme());
        this.newChatBtn.addEventListener('click', () => this.startNewChat());

        // Chat input events
        this.chatInput.addEventListener('input', () => this.handleInputChange());
        this.chatInput.addEventListener('keydown', (e) => this.handleKeyDown(e));
        this.pasteBtn.addEventListener('click', () => this.pasteFromClipboard());
        this.sendBtn.addEventListener('click', () => this.sendMessage());

        // Modal events
        document.getElementById('closeHistoryModal').addEventListener('click', () => this.hideHistoryModal());
        document.getElementById('closeSettingsModal').addEventListener('click', () => this.hideSettingsModal());

        // Settings events
        this.defaultQuality.addEventListener('change', () => this.saveSettings());
        this.autoUpscale.addEventListener('change', () => this.saveSettings());
        this.autoNoise.addEventListener('change', () => this.saveSettings());
        this.autoColor.addEventListener('change', () => this.saveSettings());

        // Click outside modal to close
        window.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                e.target.classList.remove('show');
            }
        });
    }

    initializeSocket() {
        this.socket.on('connect', () => {
            console.log('Connected to server');
            this.updateStatus('Ready');
        });

        this.socket.on('disconnect', () => {
            console.log('Disconnected from server');
            this.updateStatus('Disconnected');
        });

        this.socket.on('download_progress', (data) => {
            this.updateDownloadProgress(data);
        });

        this.socket.on('download_complete', (data) => {
            this.handleDownloadComplete(data);
        });

        this.socket.on('download_ready', (data) => {
            this.handleDownloadReady(data);
        });

        this.socket.on('download_error', (data) => {
            this.handleDownloadError(data);
        });
    }

    // UI Methods
    updateStatus(status) {
        this.headerStatus.textContent = status;
        this.headerStatus.className = 'header-status';
        
        if (status === 'Analyzing...') {
            this.headerStatus.classList.add('text-warning');
        } else if (status === 'Downloading...') {
            this.headerStatus.classList.add('text-warning');
        } else if (status === 'Ready') {
            this.headerStatus.classList.add('text-success');
        } else {
            this.headerStatus.classList.add('text-error');
        }
    }

    handleInputChange() {
        const hasContent = this.chatInput.value.trim().length > 0;
        this.sendBtn.classList.toggle('active', hasContent);
        
        // Auto-resize textarea
        this.chatInput.style.height = 'auto';
        this.chatInput.style.height = Math.min(this.chatInput.scrollHeight, 120) + 'px';
    }

    handleKeyDown(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            this.sendMessage();
        }
    }

    async pasteFromClipboard() {
        try {
            const text = await navigator.clipboard.readText();
            this.chatInput.value = text;
            this.handleInputChange();
            this.chatInput.focus();
        } catch (err) {
            console.error('Failed to read clipboard:', err);
        }
    }

    // Chat Methods
    showWelcomeMessage() {
        const welcomeMessage = {
            type: 'assistant',
            content: `👋 Hi! I'm your video download assistant.

Just paste any video URL and I'll help you download it in the best quality possible. I support:

• **YouTube** (videos, playlists, shorts)
• **TikTok** (with watermark removal)
• **Instagram** (posts, reels, stories)
• **Facebook** (videos, reels)
• **Twitter/X** (videos, GIFs)
• **And 50+ other platforms**

What video would you like to download today?`,
            timestamp: new Date()
        };

        this.addMessage(welcomeMessage);
    }

    addMessage(message) {
        const messageElement = this.createMessageElement(message);
        this.chatMessages.appendChild(messageElement);
        this.scrollToBottom();
        
        // Add to current session
        if (!this.currentSession) {
            this.currentSession = {
                id: this.generateId(),
                created: new Date(),
                messages: []
            };
        }
        
        this.currentSession.messages.push(message);
        this.saveChatHistory();
    }

    createMessageElement(message) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${message.type}`;

        const avatar = document.createElement('div');
        avatar.className = 'message-avatar';
        
        if (message.type === 'user') {
            avatar.textContent = 'U';
        } else {
            avatar.innerHTML = `
                <svg width="20" height="20" viewBox="0 0 32 32" fill="none">
                    <circle cx="16" cy="16" r="16" fill="#0F7B7C"/>
                    <path d="M12 10l8 6-8 6V10z" fill="white"/>
                </svg>
            `;
        }

        const content = document.createElement('div');
        content.className = 'message-content';
        
        if (message.html) {
            content.innerHTML = message.content;
        } else {
            content.innerHTML = this.formatMessageContent(message.content);
        }

        messageDiv.appendChild(avatar);
        messageDiv.appendChild(content);

        return messageDiv;
    }

    formatMessageContent(content) {
        // Convert markdown-like formatting
        return content
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/\n/g, '<br>')
            .replace(/•/g, '•');
    }

    showTypingIndicator() {
        const typingMessage = {
            type: 'assistant',
            content: `
                <div class="typing-indicator">
                    <div class="typing-dot"></div>
                    <div class="typing-dot"></div>
                    <div class="typing-dot"></div>
                </div>
            `,
            html: true,
            isTyping: true
        };

        const messageElement = this.createMessageElement(typingMessage);
        messageElement.id = 'typing-indicator';
        this.chatMessages.appendChild(messageElement);
        this.scrollToBottom();
    }

    hideTypingIndicator() {
        const typingElement = document.getElementById('typing-indicator');
        if (typingElement) {
            typingElement.remove();
        }
    }

    scrollToBottom() {
        setTimeout(() => {
            this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
        }, 100);
    }

    // Message Sending
    async sendMessage() {
        const content = this.chatInput.value.trim();
        if (!content) return;

        // Add user message
        this.addMessage({
            type: 'user',
            content: content,
            timestamp: new Date()
        });

        // Clear input
        this.chatInput.value = '';
        this.handleInputChange();

        // Check if it's a URL
        if (this.isValidUrl(content)) {
            await this.analyzeVideo(content);
        } else {
            // Handle as general query
            this.handleGeneralQuery(content);
        }
    }

    isValidUrl(string) {
        try {
            new URL(string);
            return true;
        } catch (_) {
            return false;
        }
    }

    async analyzeVideo(url) {
        this.updateStatus('Analyzing...');
        this.showTypingIndicator();

        try {
            const response = await fetch('/api/analyze', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    url: url,
                    userId: this.getUserId()
                })
            });

            const data = await response.json();
            this.hideTypingIndicator();

            if (data.success) {
                this.showVideoAnalysis(data.videoData);
                this.updateStatus('Ready');
            } else {
                this.showErrorMessage(data.error);
                this.updateStatus('Ready');
            }
        } catch (error) {
            this.hideTypingIndicator();
            this.showErrorMessage('Failed to analyze video. Please check your connection and try again.');
            this.updateStatus('Ready');
        }
    }

    showVideoAnalysis(videoData) {
        const analysisHtml = this.createVideoAnalysisHtml(videoData);
        
        this.addMessage({
            type: 'assistant',
            content: analysisHtml,
            html: true,
            timestamp: new Date(),
            videoData: videoData
        });
        
        // Add event listeners to download buttons
        setTimeout(() => {
            const downloadBtns = document.querySelectorAll('.download-btn[data-title]');
            downloadBtns.forEach(btn => {
                btn.addEventListener('click', () => {
                    const title = btn.dataset.title;
                    const quality = btn.dataset.quality;
                    const format = btn.dataset.format;
                    const formatId = btn.dataset.formatId;
                    this.startDownload(title, quality, format, formatId);
                });
            });
        }, 100);
    }

    createVideoAnalysisHtml(videoData) {
        const formatFileSize = (bytes) => {
            if (!bytes) return 'Unknown';
            const sizes = ['B', 'KB', 'MB', 'GB'];
            const i = Math.floor(Math.log(bytes) / Math.log(1024));
            return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
        };

        const formatDuration = (seconds) => {
            if (!seconds) return 'Unknown';
            const hrs = Math.floor(seconds / 3600);
            const mins = Math.floor((seconds % 3600) / 60);
            const secs = seconds % 60;
            
            if (hrs > 0) {
                return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
            }
            return `${mins}:${secs.toString().padStart(2, '0')}`;
        };

        let html = `
            <div class="video-info">
                <div class="video-header">
                    ${videoData.thumbnail ? `<img src="${videoData.thumbnail}" alt="Thumbnail" class="video-thumbnail">` : ''}
                    <div class="video-details">
                        <h3>${videoData.title}</h3>
                        <div class="video-meta">
                            <strong>Platform:</strong> ${videoData.platform} • 
                            <strong>Duration:</strong> ${formatDuration(videoData.duration)} • 
                            <strong>Uploader:</strong> ${videoData.uploader || 'Unknown'}
                        </div>
                    </div>
                </div>
                
                <div class="video-stats">
                    ${videoData.viewCount ? `<div class="stat-item"><span class="stat-label">Views:</span><span class="stat-value">${videoData.viewCount.toLocaleString()}</span></div>` : ''}
                    ${videoData.uploadDate ? `<div class="stat-item"><span class="stat-label">Uploaded:</span><span class="stat-value">${videoData.uploadDate}</span></div>` : ''}
                </div>
            </div>

            <div class="download-options">
                <h4>📹 Available Download Options:</h4>
                <div class="quality-grid">
        `;

        videoData.formats.forEach((format, index) => {
            html += `
                <div class="quality-option">
                    <div class="quality-info">
                        <div class="quality-label">${format.quality === 'Audio Only' ? '🎵' : '📹'} ${format.quality}</div>
                        <div class="quality-details">${format.format.toUpperCase()} • ${formatFileSize(format.fileSize)}</div>
                    </div>
                    <button class="download-btn" data-title="${videoData.title}" data-quality="${format.quality}" data-format="${format.format}" data-format-id="${format.formatId || 'best'}">
                        Download
                    </button>
                </div>
            `;
        });

        html += `
                </div>
            </div>

            <div class="enhancement-options">
                <h4>✨ Enhancement Options:</h4>
                <div class="enhancement-grid">
                    <div class="enhancement-item">
                        <input type="checkbox" id="enhance-upscale" ${this.settings.autoUpscale ? 'checked' : ''}>
                        <label for="enhance-upscale">AI Upscaling</label>
                    </div>
                    <div class="enhancement-item">
                        <input type="checkbox" id="enhance-noise" ${this.settings.autoNoise ? 'checked' : ''}>
                        <label for="enhance-noise">Noise Reduction</label>
                    </div>
                    <div class="enhancement-item">
                        <input type="checkbox" id="enhance-color" ${this.settings.autoColor ? 'checked' : ''}>
                        <label for="enhance-color">Color Correction</label>
                    </div>
                </div>
            </div>

            <p><strong>Which quality would you prefer?</strong></p>
        `;

        return html;
    }

    async startDownload(title, quality, format, formatId) {
        console.log('Starting download:', { title, quality, format, formatId });
        const enhancements = {
            aiUpscaling: document.getElementById('enhance-upscale')?.checked || false,
            noiseReduction: document.getElementById('enhance-noise')?.checked || false,
            colorCorrection: document.getElementById('enhance-color')?.checked || false
        };

        // Get the original URL from the last user message
        const lastUserMessage = this.currentSession.messages
            .filter(m => m.type === 'user')
            .pop();
        
        if (!lastUserMessage) {
            console.error('No user message found for download');
            return;
        }
        
        console.log('Last user message URL:', lastUserMessage.content);

        this.updateStatus('Downloading...');

        try {
            console.log('Sending download request...');
            const response = await fetch('/api/download', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    url: lastUserMessage.content,
                    quality: quality,
                    format: format,
                    formatId: formatId,
                    enhancements: enhancements,
                    userId: this.getUserId()
                })
            });

            const data = await response.json();
            console.log('Download response:', data);

            if (data.success) {
                this.showDownloadProgress(data.downloadId, title, quality);
                this.activeDownloads.set(data.downloadId, {
                    title,
                    quality,
                    format,
                    startTime: Date.now()
                });
            } else {
                console.error('Download failed:', data.error);
                this.showErrorMessage(data.error);
                this.updateStatus('Ready');
            }
        } catch (error) {
            console.error('Download request failed:', error);
            this.showErrorMessage('Failed to start download. Please try again.');
            this.updateStatus('Ready');
        }
    }

    showDownloadProgress(downloadId, title, quality) {
        const progressHtml = `
            <div class="progress-container" id="progress-${downloadId}">
                <div class="progress-header">
                    <div class="progress-title">⬇️ Downloading: ${title} (${quality})</div>
                    <div class="progress-percentage">0%</div>
                </div>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: 0%"></div>
                </div>
                <div class="progress-stats">
                    <div class="stat-item">
                        <span class="stat-label">Speed:</span>
                        <span class="stat-value" id="speed-${downloadId}">0 B/s</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">ETA:</span>
                        <span class="stat-value" id="eta-${downloadId}">--</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Downloaded:</span>
                        <span class="stat-value" id="downloaded-${downloadId}">0 B / 0 B</span>
                    </div>
                </div>
                <div class="progress-controls">
                    <button class="control-btn" onclick="window.app.cancelDownload('${downloadId}')">Cancel</button>
                </div>
            </div>
        `;

        this.addMessage({
            type: 'assistant',
            content: progressHtml,
            html: true,
            timestamp: new Date(),
            downloadId: downloadId
        });
    }

    updateDownloadProgress(data) {
        const { downloadId, progress, speed, eta, downloaded, total, status, stage } = data;
        
        const progressContainer = document.getElementById(`progress-${downloadId}`);
        if (!progressContainer) return;

        // Update progress bar
        const progressFill = progressContainer.querySelector('.progress-fill');
        const progressPercentage = progressContainer.querySelector('.progress-percentage');
        
        if (progressFill && progressPercentage) {
            progressFill.style.width = `${progress}%`;
            progressPercentage.textContent = `${progress}%`;
        }

        // Update stats
        const speedElement = document.getElementById(`speed-${downloadId}`);
        const etaElement = document.getElementById(`eta-${downloadId}`);
        const downloadedElement = document.getElementById(`downloaded-${downloadId}`);

        if (speedElement) speedElement.textContent = speed || '0 B/s';
        if (etaElement) etaElement.textContent = eta ? `${eta}s` : '--';
        if (downloadedElement) {
            const downloadedSize = this.formatFileSize(downloaded || 0);
            const totalSize = this.formatFileSize(total || 0);
            downloadedElement.textContent = `${downloadedSize} / ${totalSize}`;
        }

        // Update title with stage
        const titleElement = progressContainer.querySelector('.progress-title');
        if (titleElement && stage) {
            const download = this.activeDownloads.get(downloadId);
            if (download) {
                titleElement.textContent = `⬇️ ${stage}: ${download.title} (${download.quality})`;
            }
        }
    }

    handleDownloadComplete(data) {
        const { downloadId, fileName, fileSize, processingTime } = data;
        const download = this.activeDownloads.get(downloadId);
        
        if (!download) return;

        const completeHtml = `
            <div class="video-info">
                <h3>✅ Download Complete!</h3>
                <div class="video-stats">
                    <div class="stat-item">
                        <span class="stat-label">File:</span>
                        <span class="stat-value">${fileName}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Size:</span>
                        <span class="stat-value">${this.formatFileSize(fileSize)}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Quality:</span>
                        <span class="stat-value">${download.quality}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Time:</span>
                        <span class="stat-value">${Math.round(processingTime / 1000)}s</span>
                    </div>
                </div>
                <div class="progress-controls">
                    <button class="download-btn" onclick="window.app.openFile('${fileName}')">📱 Open File</button>
                    <button class="download-btn" onclick="window.app.shareFile('${fileName}')">📤 Share</button>
                    <button class="control-btn" onclick="window.app.deleteFile('${fileName}')">🗑️ Delete</button>
                </div>
            </div>
            <p><strong>Ready for another download?</strong></p>
        `;

        this.addMessage({
            type: 'assistant',
            content: completeHtml,
            html: true,
            timestamp: new Date()
        });

        this.activeDownloads.delete(downloadId);
        this.updateStatus('Ready');
    }

    handleDownloadError(data) {
        const { downloadId, error } = data;
        
        const errorHtml = `
            <div class="video-info">
                <h3>❌ Download Failed</h3>
                <p><strong>Error:</strong> ${error}</p>
                <div class="progress-controls">
                    <button class="download-btn" onclick="window.app.retryLastDownload()">🔄 Try Again</button>
                </div>
            </div>
            <p>Need help? I can analyze a different video URL.</p>
        `;

        this.addMessage({
            type: 'assistant',
            content: errorHtml,
            html: true,
            timestamp: new Date()
        });

        this.activeDownloads.delete(downloadId);
        this.updateStatus('Ready');
    }

    showErrorMessage(error) {
        const errorHtml = `
            <div class="video-info">
                <h3>❌ Error</h3>
                <p>${error}</p>
                <p><strong>Suggestions:</strong></p>
                <ul>
                    <li>Check if the video is publicly available</li>
                    <li>Verify the URL is correct and complete</li>
                    <li>Try copying the URL directly from the video page</li>
                    <li>Some videos may be geo-restricted in your region</li>
                </ul>
            </div>
        `;

        this.addMessage({
            type: 'assistant',
            content: errorHtml,
            html: true,
            timestamp: new Date()
        });
    }

    async handleGeneralQuery(query) {
        this.showTypingIndicator();
        
        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ 
                    message: query,
                    userId: this.getUserId()
                })
            });
            
            const data = await response.json();
            this.hideTypingIndicator();
            
            if (data.message) {
                this.addMessage({
                    type: 'assistant',
                    content: data.message,
                    timestamp: new Date()
                });
                
                // Handle special actions from AI
                if (data.action === 'analyze_url' && data.data && data.data.url) {
                    await this.analyzeVideo(data.data.url);
                } else if (data.action === 'request_url') {
                    // AI is asking for URL, no additional action needed
                }
            } else {
                this.fallbackGeneralQuery(query);
            }
        } catch (error) {
            this.hideTypingIndicator();
            this.fallbackGeneralQuery(query);
        }
    }
    
    fallbackGeneralQuery(query) {
        const response = `I'm here to help you download videos! Just paste a video URL from any supported platform and I'll analyze it for you.

**Supported platforms include:**
• YouTube, TikTok, Instagram, Facebook
• Twitter/X, LinkedIn, Reddit, Vimeo
• And 50+ other video platforms

Try pasting a video URL to get started!`;

        this.addMessage({
            type: 'assistant',
            content: response,
            timestamp: new Date()
        });
    }

    getPlatformSupportResponse() {
        return `🌐 **Supported Platforms (50+ sites)**

**Popular Platforms:**
• **YouTube** (videos, shorts, playlists, live streams)
• **TikTok** (videos, slideshows, watermark removal)
• **Instagram** (posts, reels, stories, IGTV)
• **Facebook** (videos, reels, stories)
• **Twitter/X** (videos, GIFs)
• **LinkedIn** (native videos)
• **Reddit** (v.redd.it videos)

**Additional Platforms:**
• Vimeo, Dailymotion, Twitch clips
• Snapchat, Pinterest, Tumblr
• News sites: CNN, BBC, Reuters
• And many more...

**Special Features:**
✅ Private video download (with authentication)
✅ Age-restricted content (when legally accessible)
✅ Live stream recording
✅ Automatic subtitle download
✅ Multiple audio tracks

Just paste any video URL and I'll let you know if it's supported!`;
    }

    getHelpResponse() {
        return `📖 **How to Use VidHarvest Pro**

**Step 1:** Copy any video URL from supported platforms
**Step 2:** Paste the URL in the chat input below
**Step 3:** I'll analyze the video and show available quality options
**Step 4:** Choose your preferred quality and enhancement options
**Step 5:** Click download and wait for completion!

**Pro Tips:**
• Use the paste button (📋) for quick URL pasting
• Enable auto-enhancements in settings for better quality
• Check chat history to re-download previous videos
• Use dark mode toggle for comfortable viewing

**Need specific help?** Just ask me about:
• Supported platforms
• Quality options
• Enhancement features
• Download management`;
    }

    getQualityResponse() {
        return `🎯 **Quality & Format Options**

**Video Qualities:**
• **4K (2160p)** - Ultra HD, largest file size
• **1080p HD** - Full HD, recommended for most uses
• **720p HD** - Good quality, smaller file size
• **480p** - Standard definition, mobile-friendly
• **Audio Only** - MP3 format, smallest file size

**Enhancement Features:**
• **AI Upscaling** - Improve resolution using AI
• **Noise Reduction** - Remove background noise
• **Color Correction** - Auto-balance colors and contrast

**Supported Formats:**
• **Video:** MP4, MKV, WebM, AVI
• **Audio:** MP3, M4A, WAV, FLAC

The best quality available depends on the source video. I'll always show you all available options when you paste a URL!`;
    }

    // Utility Methods
    formatFileSize(bytes) {
        if (!bytes) return '0 B';
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
    }

    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    getUserId() {
        let userId = localStorage.getItem('vidharvest_user_id');
        if (!userId) {
            userId = this.generateId();
            localStorage.setItem('vidharvest_user_id', userId);
        }
        return userId;
    }

    // Settings Management
    loadSettings() {
        const defaultSettings = {
            defaultQuality: 'best',
            autoUpscale: false,
            autoNoise: false,
            autoColor: false,
            theme: 'light'
        };

        const saved = localStorage.getItem('vidharvest_settings');
        return saved ? { ...defaultSettings, ...JSON.parse(saved) } : defaultSettings;
    }

    saveSettings() {
        this.settings = {
            defaultQuality: this.defaultQuality.value,
            autoUpscale: this.autoUpscale.checked,
            autoNoise: this.autoNoise.checked,
            autoColor: this.autoColor.checked,
            theme: document.documentElement.getAttribute('data-theme') || 'light'
        };

        localStorage.setItem('vidharvest_settings', JSON.stringify(this.settings));
    }

    loadTheme() {
        document.documentElement.setAttribute('data-theme', this.settings.theme);
    }

    toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        
        document.documentElement.setAttribute('data-theme', newTheme);
        this.settings.theme = newTheme;
        this.saveSettings();
    }

    // Chat History Management
    loadChatHistory() {
        const saved = localStorage.getItem('vidharvest_chat_history');
        this.chatHistory = saved ? JSON.parse(saved) : [];
        this.updateHistoryBadge();
    }

    saveChatHistory() {
        if (this.currentSession && this.currentSession.messages.length > 1) {
            // Update existing session or add new one
            const existingIndex = this.chatHistory.findIndex(s => s.id === this.currentSession.id);
            if (existingIndex >= 0) {
                this.chatHistory[existingIndex] = this.currentSession;
            } else {
                this.chatHistory.unshift(this.currentSession);
            }

            // Keep only last 50 sessions
            this.chatHistory = this.chatHistory.slice(0, 50);
            
            localStorage.setItem('vidharvest_chat_history', JSON.stringify(this.chatHistory));
            this.updateHistoryBadge();
        }
    }

    updateHistoryBadge() {
        this.historyBadge.textContent = this.chatHistory.length;
        this.historyBadge.style.display = this.chatHistory.length > 0 ? 'block' : 'none';
    }

    startNewChat() {
        this.currentSession = null;
        this.chatMessages.innerHTML = '';
        this.showWelcomeMessage();
        this.updateStatus('Ready');
    }

    // Modal Management
    showHistoryModal() {
        this.populateHistoryModal();
        this.historyModal.classList.add('show');
    }

    hideHistoryModal() {
        this.historyModal.classList.remove('show');
    }

    showSettingsModal() {
        this.populateSettingsModal();
        this.settingsModal.classList.add('show');
    }

    hideSettingsModal() {
        this.settingsModal.classList.remove('show');
    }

    populateHistoryModal() {
        const historyList = document.getElementById('historyList');
        
        if (this.chatHistory.length === 0) {
            historyList.innerHTML = '<p class="text-center text-secondary">No chat history yet</p>';
            return;
        }

        let html = '';
        this.chatHistory.forEach(session => {
            const firstUserMessage = session.messages.find(m => m.type === 'user');
            const preview = firstUserMessage ? firstUserMessage.content.substring(0, 60) + '...' : 'New session';
            const date = new Date(session.created).toLocaleDateString();
            
            html += `
                <div class="history-item" onclick="app.loadChatSession('${session.id}')">
                    <div class="history-preview">${preview}</div>
                    <div class="history-date">${date}</div>
                </div>
            `;
        });

        historyList.innerHTML = html;
    }

    populateSettingsModal() {
        this.defaultQuality.value = this.settings.defaultQuality;
        this.autoUpscale.checked = this.settings.autoUpscale;
        this.autoNoise.checked = this.settings.autoNoise;
        this.autoColor.checked = this.settings.autoColor;
        
        // Initialize settings tabs
        this.initializeSettingsTabs();
    }
    
    initializeSettingsTabs() {
        const tabs = document.querySelectorAll('.settings-tab');
        const panels = document.querySelectorAll('.settings-panel');
        
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const targetPanel = tab.dataset.tab + '-panel';
                
                // Remove active class from all tabs and panels
                tabs.forEach(t => t.classList.remove('active'));
                panels.forEach(p => p.classList.remove('active'));
                
                // Add active class to clicked tab and corresponding panel
                tab.classList.add('active');
                document.getElementById(targetPanel).classList.add('active');
            });
        });
    }

    loadChatSession(sessionId) {
        const session = this.chatHistory.find(s => s.id === sessionId);
        if (!session) return;

        this.currentSession = session;
        this.chatMessages.innerHTML = '';
        
        session.messages.forEach(message => {
            const messageElement = this.createMessageElement(message);
            this.chatMessages.appendChild(messageElement);
        });

        this.scrollToBottom();
        this.hideHistoryModal();
    }

    // File Management
    async openFile(fileName) {
        // This would typically open the file using the system's default application
        // For web implementation, we might download the file or show a preview
        console.log('Opening file:', fileName);
    }

    async shareFile(fileName) {
        if (navigator.share) {
            try {
                await navigator.share({
                    title: 'VidHarvest Pro Download',
                    text: `Downloaded: ${fileName}`,
                    url: window.location.href
                });
            } catch (err) {
                console.log('Share cancelled');
            }
        } else {
            // Fallback: copy to clipboard
            await navigator.clipboard.writeText(`Downloaded: ${fileName} via VidHarvest Pro`);
            alert('Download info copied to clipboard!');
        }
    }

    async deleteFile(fileName) {
        if (confirm(`Are you sure you want to delete ${fileName}?`)) {
            try {
                const response = await fetch(`/api/downloads/${fileName}`, {
                    method: 'DELETE'
                });
                
                if (response.ok) {
                    alert('File deleted successfully');
                } else {
                    alert('Failed to delete file');
                }
            } catch (error) {
                alert('Error deleting file');
            }
        }
    }

    pauseDownload(downloadId) {
        fetch(`/api/download/${downloadId}/pause`, { method: 'POST' })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    console.log('Download paused:', downloadId);
                } else {
                    console.error('Failed to pause download:', data.error);
                }
            })
            .catch(error => console.error('Pause request failed:', error));
    }

    cancelDownload(downloadId) {
        if (confirm('Are you sure you want to cancel this download?')) {
            fetch(`/api/download/${downloadId}/cancel`, { method: 'POST' })
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        console.log('Download cancelled:', downloadId);
                        this.activeDownloads.delete(downloadId);
                        
                        // Remove progress UI
                        const progressElement = document.getElementById(`progress-${downloadId}`);
                        if (progressElement) {
                            progressElement.remove();
                        }
                        
                        this.updateStatus('Ready');
                    } else {
                        console.error('Failed to cancel download:', data.error);
                    }
                })
                .catch(error => console.error('Cancel request failed:', error));
        }
    }

    handleDownloadReady(data) {
        const { downloadId, downloadUrl } = data;
        const download = this.activeDownloads.get(downloadId);
        
        if (!download) return;

        // Trigger browser download
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = `${download.title.replace(/[^\w\s-]/g, '').replace(/\s+/g, '_')}.${download.quality === 'Audio Only' ? 'mp3' : 'mp4'}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        // Delete server file after successful download
        setTimeout(() => {
            fetch(`/api/cleanup/${downloadId}`, { method: 'DELETE' })
                .catch(err => console.log('Cleanup failed:', err));
        }, 5000); // 5 second delay to ensure download completes

        // Show completion message
        const completeHtml = `
            <div class="video-info">
                <h3>✅ Download Complete!</h3>
                <p><strong>File:</strong> ${download.title} (${download.quality})</p>
                <p>The file has been downloaded to your device.</p>
            </div>
            <p><strong>Ready for another download?</strong></p>
        `;

        this.addMessage({
            type: 'assistant',
            content: completeHtml,
            html: true,
            timestamp: new Date()
        });

        this.activeDownloads.delete(downloadId);
        this.updateStatus('Ready');
    }

    retryLastDownload() {
        // Implementation for retrying failed downloads
        console.log('Retrying last download');
    }

    clearChatHistory() {
        if (confirm('Are you sure you want to clear all chat history? This cannot be undone.')) {
            this.chatHistory = [];
            localStorage.removeItem('vidharvest_chat_history');
            this.updateHistoryBadge();
            this.populateHistoryModal();
            alert('Chat history cleared successfully!');
        }
    }
}

// Initialize the application
const app = new VidHarvestApp();
window.app = app;