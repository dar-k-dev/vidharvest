// VidHarvest Pro - Download Management Module

class DownloadManager {
    constructor(app) {
        this.app = app;
        this.downloads = new Map();
        this.downloadHistory = [];
        this.maxConcurrentDownloads = 3;
        this.downloadQueue = [];
        this.isProcessingQueue = false;
        
        this.initializeDownloadManager();
    }

    initializeDownloadManager() {
        this.loadDownloadHistory();
        this.setupDownloadTracking();
        this.setupBandwidthMonitoring();
        this.setupRetryLogic();
    }

    setupDownloadTracking() {
        // Track download statistics
        this.stats = {
            totalDownloads: 0,
            totalSize: 0,
            totalTime: 0,
            successRate: 0,
            averageSpeed: 0
        };

        this.loadStats();
    }

    setupBandwidthMonitoring() {
        this.bandwidthHistory = [];
        this.currentBandwidth = 0;
        
        // Monitor bandwidth every 5 seconds during downloads
        setInterval(() => {
            if (this.downloads.size > 0) {
                this.calculateBandwidth();
            }
        }, 5000);
    }

    setupRetryLogic() {
        this.retryAttempts = new Map();
        this.maxRetries = 3;
        this.retryDelay = 5000; // 5 seconds
    }

    // Queue Management
    async addToQueue(downloadRequest) {
        const queueItem = {
            id: this.app.generateId(),
            ...downloadRequest,
            status: 'queued',
            addedAt: Date.now(),
            priority: downloadRequest.priority || 0
        };

        this.downloadQueue.push(queueItem);
        this.sortQueue();
        
        if (!this.isProcessingQueue) {
            this.processQueue();
        }

        return queueItem.id;
    }

    sortQueue() {
        // Sort by priority (higher first), then by add time
        this.downloadQueue.sort((a, b) => {
            if (a.priority !== b.priority) {
                return b.priority - a.priority;
            }
            return a.addedAt - b.addedAt;
        });
    }

    async processQueue() {
        if (this.isProcessingQueue) return;
        this.isProcessingQueue = true;

        while (this.downloadQueue.length > 0 && this.downloads.size < this.maxConcurrentDownloads) {
            const queueItem = this.downloadQueue.shift();
            await this.startDownload(queueItem);
        }

        this.isProcessingQueue = false;

        // Continue processing if there are more items
        if (this.downloadQueue.length > 0) {
            setTimeout(() => this.processQueue(), 1000);
        }
    }

    // Download Execution
    async startDownload(downloadRequest) {
        const { id, url, quality, format, enhancements, title } = downloadRequest;
        
        try {
            // Add to active downloads
            const download = {
                id,
                url,
                quality,
                format,
                title,
                enhancements,
                status: 'starting',
                progress: 0,
                speed: 0,
                eta: 0,
                downloaded: 0,
                total: 0,
                startTime: Date.now(),
                retryCount: 0
            };

            this.downloads.set(id, download);
            this.updateDownloadUI(download);

            // Make API request
            const response = await fetch('/api/download', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    url,
                    quality,
                    format,
                    enhancements,
                    userId: this.app.getUserId(),
                    downloadId: id
                })
            });

            const data = await response.json();

            if (data.success) {
                download.status = 'downloading';
                this.updateDownloadUI(download);
            } else {
                throw new Error(data.error || 'Download failed to start');
            }

        } catch (error) {
            console.error('Download start error:', error);
            await this.handleDownloadError(id, error.message);
        }
    }

    // Progress Updates
    updateDownloadProgress(data) {
        const { downloadId, progress, speed, eta, downloaded, total, status, stage } = data;
        const download = this.downloads.get(downloadId);
        
        if (!download) return;

        // Update download object
        download.progress = progress || 0;
        download.speed = this.parseSpeed(speed);
        download.eta = eta || 0;
        download.downloaded = downloaded || 0;
        download.total = total || 0;
        download.status = status || download.status;
        download.stage = stage;
        download.lastUpdate = Date.now();

        // Update UI
        this.updateDownloadUI(download);
        
        // Update bandwidth tracking
        this.updateBandwidthTracking(download);
        
        // Check for stalled downloads
        this.checkForStalledDownload(download);
    }

    updateDownloadUI(download) {
        const progressContainer = document.getElementById(`progress-${download.id}`);
        if (!progressContainer) return;

        // Update progress bar
        const progressFill = progressContainer.querySelector('.progress-fill');
        const progressPercentage = progressContainer.querySelector('.progress-percentage');
        
        if (progressFill && progressPercentage) {
            progressFill.style.width = `${download.progress}%`;
            progressPercentage.textContent = `${Math.round(download.progress)}%`;
        }

        // Update stats
        const speedElement = document.getElementById(`speed-${download.id}`);
        const etaElement = document.getElementById(`eta-${download.id}`);
        const downloadedElement = document.getElementById(`downloaded-${download.id}`);

        if (speedElement) {
            speedElement.textContent = this.formatSpeed(download.speed);
        }
        
        if (etaElement) {
            etaElement.textContent = this.formatETA(download.eta);
        }
        
        if (downloadedElement) {
            const downloadedSize = this.app.formatFileSize(download.downloaded);
            const totalSize = this.app.formatFileSize(download.total);
            downloadedElement.textContent = `${downloadedSize} / ${totalSize}`;
        }

        // Update title with stage
        const titleElement = progressContainer.querySelector('.progress-title');
        if (titleElement) {
            const statusIcon = this.getStatusIcon(download.status);
            const stageText = download.stage || this.getStatusText(download.status);
            titleElement.textContent = `${statusIcon} ${stageText}: ${download.title} (${download.quality})`;
        }

        // Update progress bar color based on status
        if (progressFill) {
            progressFill.className = `progress-fill ${download.status}`;
        }
    }

    // Download Completion
    async handleDownloadComplete(data) {
        const { downloadId, fileName, fileSize, processingTime } = data;
        const download = this.downloads.get(downloadId);
        
        if (!download) return;

        // Update download record
        download.status = 'completed';
        download.fileName = fileName;
        download.fileSize = fileSize;
        download.completedAt = Date.now();
        download.processingTime = processingTime;

        // Add to history
        this.addToHistory(download);
        
        // Update statistics
        this.updateStats(download);
        
        // Remove from active downloads
        this.downloads.delete(downloadId);
        
        // Show completion message
        this.showCompletionMessage(download);
        
        // Process next item in queue
        this.processQueue();
        
        // Update app status
        if (this.downloads.size === 0) {
            this.app.updateStatus('Ready');
        }
    }

    showCompletionMessage(download) {
        const enhancementsApplied = [];
        if (download.enhancements?.aiUpscaling) enhancementsApplied.push('✅ AI Upscaling');
        if (download.enhancements?.noiseReduction) enhancementsApplied.push('✅ Noise Reduction');
        if (download.enhancements?.colorCorrection) enhancementsApplied.push('✅ Color Correction');

        const completeHtml = `
            <div class="video-info">
                <h3>✅ Download Complete!</h3>
                <div class="video-stats">
                    <div class="stat-item">
                        <span class="stat-label">File:</span>
                        <span class="stat-value">${download.fileName}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Size:</span>
                        <span class="stat-value">${this.app.formatFileSize(download.fileSize)}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Quality:</span>
                        <span class="stat-value">${download.quality}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Time:</span>
                        <span class="stat-value">${this.formatDuration(download.processingTime)}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Avg Speed:</span>
                        <span class="stat-value">${this.calculateAverageSpeed(download)}</span>
                    </div>
                </div>
                
                ${enhancementsApplied.length > 0 ? `
                    <div class="enhancements-applied">
                        <h4>🎨 Enhancements Applied:</h4>
                        ${enhancementsApplied.map(e => `<div>${e}</div>`).join('')}
                    </div>
                ` : ''}
                
                <div class="progress-controls">
                    <button class="download-btn" onclick="downloadManager.downloadFile('${download.fileName}', '${this.detectPlatform(download.url) || 'YouTube'}')">📎 Download File</button>
                    <button class="download-btn" onclick="downloadManager.shareFile('${download.fileName}')">📤 Share</button>
                    <button class="download-btn" onclick="downloadManager.showFileInfo('${download.id}')">ℹ️ Info</button>
                    <button class="control-btn" onclick="downloadManager.deleteFile('${download.fileName}')">🗑️ Delete</button>
                </div>
            </div>
            <p><strong>Ready for another download?</strong></p>
        `;

        this.app.addMessage({
            type: 'assistant',
            content: completeHtml,
            html: true,
            timestamp: new Date()
        });
    }

    // Error Handling
    async handleDownloadError(downloadId, error) {
        const download = this.downloads.get(downloadId);
        
        if (!download) return;

        download.status = 'error';
        download.error = error;
        download.errorTime = Date.now();

        // Check if we should retry
        const retryCount = this.retryAttempts.get(downloadId) || 0;
        
        if (retryCount < this.maxRetries && this.isRetryableError(error)) {
            // Schedule retry
            this.scheduleRetry(downloadId, retryCount + 1);
        } else {
            // Show error message
            this.showErrorMessage(download);
            
            // Remove from active downloads
            this.downloads.delete(downloadId);
            this.retryAttempts.delete(downloadId);
            
            // Process next item in queue
            this.processQueue();
        }
    }

    isRetryableError(error) {
        const retryableErrors = [
            'network error',
            'timeout',
            'connection reset',
            'temporary failure',
            'rate limited'
        ];
        
        return retryableErrors.some(retryableError => 
            error.toLowerCase().includes(retryableError)
        );
    }

    async scheduleRetry(downloadId, retryCount) {
        const download = this.downloads.get(downloadId);
        if (!download) return;

        this.retryAttempts.set(downloadId, retryCount);
        
        // Show retry message
        this.showRetryMessage(download, retryCount);
        
        // Wait before retry
        const delay = this.retryDelay * Math.pow(2, retryCount - 1); // Exponential backoff
        
        setTimeout(async () => {
            if (this.downloads.has(downloadId)) {
                download.status = 'retrying';
                download.retryCount = retryCount;
                await this.startDownload(download);
            }
        }, delay);
    }

    showRetryMessage(download, retryCount) {
        const retryHtml = `
            <div class="video-info">
                <h3>🔄 Retrying Download (${retryCount}/${this.maxRetries})</h3>
                <p><strong>File:</strong> ${download.title}</p>
                <p><strong>Error:</strong> ${download.error}</p>
                <p>Retrying in ${this.retryDelay / 1000} seconds...</p>
            </div>
        `;

        this.app.addMessage({
            type: 'assistant',
            content: retryHtml,
            html: true,
            timestamp: new Date()
        });
    }

    showErrorMessage(download) {
        const errorHtml = `
            <div class="video-info">
                <h3>❌ Download Failed</h3>
                <p><strong>File:</strong> ${download.title}</p>
                <p><strong>Error:</strong> ${download.error}</p>
                <p><strong>Attempts:</strong> ${(this.retryAttempts.get(download.id) || 0) + 1}</p>
                
                <div class="progress-controls">
                    <button class="download-btn" onclick="downloadManager.retryDownload('${download.id}')">🔄 Try Again</button>
                    <button class="control-btn" onclick="downloadManager.reportError('${download.id}')">📝 Report Issue</button>
                </div>
            </div>
            <p>Need help? I can analyze a different video URL.</p>
        `;

        this.app.addMessage({
            type: 'assistant',
            content: errorHtml,
            html: true,
            timestamp: new Date()
        });
    }

    // Download Control
    pauseDownload(downloadId) {
        const download = this.downloads.get(downloadId);
        if (!download) return;

        download.status = 'paused';
        this.updateDownloadUI(download);
        
        // Send pause request to server
        fetch('/api/download/pause', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ downloadId })
        });
    }

    resumeDownload(downloadId) {
        const download = this.downloads.get(downloadId);
        if (!download) return;

        download.status = 'downloading';
        this.updateDownloadUI(download);
        
        // Send resume request to server
        fetch('/api/download/resume', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ downloadId })
        });
    }

    cancelDownload(downloadId) {
        const download = this.downloads.get(downloadId);
        if (!download) return;

        // Remove from active downloads
        this.downloads.delete(downloadId);
        this.retryAttempts.delete(downloadId);
        
        // Send cancel request to server
        fetch('/api/download/cancel', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ downloadId })
        });
        
        // Update UI
        const progressContainer = document.getElementById(`progress-${downloadId}`);
        if (progressContainer) {
            progressContainer.innerHTML = `
                <div class="video-info">
                    <h3>❌ Download Cancelled</h3>
                    <p>${download.title} (${download.quality})</p>
                </div>
            `;
        }
        
        // Process next item in queue
        this.processQueue();
    }

    retryDownload(downloadId) {
        // Find download in history or recreate from last attempt
        const historyItem = this.downloadHistory.find(item => item.id === downloadId);
        if (historyItem) {
            this.addToQueue({
                url: historyItem.url,
                quality: historyItem.quality,
                format: historyItem.format,
                enhancements: historyItem.enhancements,
                title: historyItem.title,
                priority: 1 // Higher priority for retries
            });
        }
    }

    // File Management
    async downloadFile(fileName, platform) {
        try {
            const url = `/api/downloads/file/${encodeURIComponent(platform)}/${encodeURIComponent(fileName)}`;
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        } catch (error) {
            console.error('Error downloading file:', error);
            alert('Failed to download file');
        }
    }

    async openFile(fileName) {
        // Redirect to downloadFile for web compatibility
        const platform = 'YouTube'; // Default platform
        this.downloadFile(fileName, platform);
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
            const shareText = `Downloaded "${fileName}" using VidHarvest Pro - ${window.location.href}`;
            await navigator.clipboard.writeText(shareText);
            alert('Download info copied to clipboard!');
        }
    }

    async deleteFile(fileName) {
        if (confirm(`Are you sure you want to delete "${fileName}"?`)) {
            try {
                const response = await fetch(`/api/downloads/${encodeURIComponent(fileName)}`, {
                    method: 'DELETE'
                });
                
                if (response.ok) {
                    alert('File deleted successfully');
                    // Remove from history
                    this.downloadHistory = this.downloadHistory.filter(item => item.fileName !== fileName);
                    this.saveHistory();
                } else {
                    alert('Failed to delete file');
                }
            } catch (error) {
                alert('Error deleting file');
            }
        }
    }

    showFileInfo(downloadId) {
        const historyItem = this.downloadHistory.find(item => item.id === downloadId);
        if (!historyItem) return;

        const infoHtml = `
            <div class="video-info">
                <h3>📄 File Information</h3>
                <div class="video-stats">
                    <div class="stat-item">
                        <span class="stat-label">Title:</span>
                        <span class="stat-value">${historyItem.title}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">URL:</span>
                        <span class="stat-value"><a href="${historyItem.url}" target="_blank">${historyItem.url.substring(0, 50)}...</a></span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Quality:</span>
                        <span class="stat-value">${historyItem.quality}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Format:</span>
                        <span class="stat-value">${historyItem.format}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Size:</span>
                        <span class="stat-value">${this.app.formatFileSize(historyItem.fileSize)}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Downloaded:</span>
                        <span class="stat-value">${new Date(historyItem.completedAt).toLocaleString()}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Processing Time:</span>
                        <span class="stat-value">${this.formatDuration(historyItem.processingTime)}</span>
                    </div>
                </div>
            </div>
        `;

        this.app.addMessage({
            type: 'assistant',
            content: infoHtml,
            html: true,
            timestamp: new Date()
        });
    }

    // Statistics and Analytics
    updateStats(download) {
        this.stats.totalDownloads++;
        this.stats.totalSize += download.fileSize || 0;
        this.stats.totalTime += download.processingTime || 0;
        
        // Calculate success rate
        const successfulDownloads = this.downloadHistory.filter(d => d.status === 'completed').length;
        this.stats.successRate = (successfulDownloads / this.stats.totalDownloads) * 100;
        
        // Calculate average speed
        if (download.processingTime && download.fileSize) {
            const speed = download.fileSize / (download.processingTime / 1000); // bytes per second
            this.stats.averageSpeed = (this.stats.averageSpeed + speed) / 2;
        }
        
        this.saveStats();
    }

    getDownloadStats() {
        return {
            ...this.stats,
            activeDownloads: this.downloads.size,
            queuedDownloads: this.downloadQueue.length,
            totalHistory: this.downloadHistory.length,
            currentBandwidth: this.formatSpeed(this.currentBandwidth)
        };
    }

    // Utility Methods
    parseSpeed(speedString) {
        if (!speedString) return 0;
        
        const match = speedString.match(/([0-9.]+)\s*([KMGT]?B)/i);
        if (!match) return 0;
        
        const value = parseFloat(match[1]);
        const unit = match[2].toUpperCase();
        
        const multipliers = {
            'B': 1,
            'KB': 1024,
            'MB': 1024 * 1024,
            'GB': 1024 * 1024 * 1024,
            'TB': 1024 * 1024 * 1024 * 1024
        };
        
        return value * (multipliers[unit] || 1);
    }

    formatSpeed(bytesPerSecond) {
        if (!bytesPerSecond) return '0 B/s';
        
        const units = ['B/s', 'KB/s', 'MB/s', 'GB/s'];
        let size = bytesPerSecond;
        let unitIndex = 0;
        
        while (size >= 1024 && unitIndex < units.length - 1) {
            size /= 1024;
            unitIndex++;
        }
        
        return `${size.toFixed(1)} ${units[unitIndex]}`;
    }

    formatETA(seconds) {
        if (!seconds || seconds === Infinity) return '--';
        
        if (seconds < 60) return `${Math.round(seconds)}s`;
        if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
        
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.round((seconds % 3600) / 60);
        return `${hours}h ${minutes}m`;
    }

    formatDuration(milliseconds) {
        if (!milliseconds) return '0s';
        
        const seconds = Math.floor(milliseconds / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        
        if (hours > 0) {
            return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
        } else if (minutes > 0) {
            return `${minutes}m ${seconds % 60}s`;
        } else {
            return `${seconds}s`;
        }
    }

    calculateAverageSpeed(download) {
        if (!download.processingTime || !download.fileSize) return 'Unknown';
        
        const bytesPerSecond = download.fileSize / (download.processingTime / 1000);
        return this.formatSpeed(bytesPerSecond);
    }

    getStatusIcon(status) {
        const icons = {
            'starting': '🚀',
            'downloading': '⬇️',
            'enhancing': '✨',
            'completed': '✅',
            'paused': '⏸️',
            'error': '❌',
            'retrying': '🔄',
            'cancelled': '❌'
        };
        
        return icons[status] || '📥';
    }

    getStatusText(status) {
        const texts = {
            'starting': 'Starting',
            'downloading': 'Downloading',
            'enhancing': 'Enhancing',
            'completed': 'Completed',
            'paused': 'Paused',
            'error': 'Failed',
            'retrying': 'Retrying',
            'cancelled': 'Cancelled'
        };
        
        return texts[status] || 'Processing';
    }

    // Bandwidth Monitoring
    calculateBandwidth() {
        let totalSpeed = 0;
        
        this.downloads.forEach(download => {
            if (download.status === 'downloading' && download.speed) {
                totalSpeed += download.speed;
            }
        });
        
        this.currentBandwidth = totalSpeed;
        this.bandwidthHistory.push({
            timestamp: Date.now(),
            bandwidth: totalSpeed
        });
        
        // Keep only last 100 measurements
        if (this.bandwidthHistory.length > 100) {
            this.bandwidthHistory.shift();
        }
    }

    updateBandwidthTracking(download) {
        // Update individual download speed tracking
        if (!download.speedHistory) {
            download.speedHistory = [];
        }
        
        download.speedHistory.push({
            timestamp: Date.now(),
            speed: download.speed,
            progress: download.progress
        });
        
        // Keep only last 20 measurements per download
        if (download.speedHistory.length > 20) {
            download.speedHistory.shift();
        }
    }

    checkForStalledDownload(download) {
        const now = Date.now();
        const stallThreshold = 30000; // 30 seconds
        
        if (download.lastUpdate && (now - download.lastUpdate) > stallThreshold) {
            if (download.status === 'downloading') {
                console.warn(`Download ${download.id} appears stalled`);
                // Could implement automatic retry or notification here
            }
        }
    }

    // Data Persistence
    addToHistory(download) {
        const historyItem = {
            id: download.id,
            title: download.title,
            url: download.url,
            quality: download.quality,
            format: download.format,
            fileName: download.fileName,
            fileSize: download.fileSize,
            enhancements: download.enhancements,
            completedAt: download.completedAt,
            processingTime: download.processingTime,
            status: download.status
        };
        
        this.downloadHistory.unshift(historyItem);
        
        // Keep only last 100 downloads
        if (this.downloadHistory.length > 100) {
            this.downloadHistory.pop();
        }
        
        this.saveHistory();
    }

    loadDownloadHistory() {
        const saved = localStorage.getItem('vidharvest_download_history');
        this.downloadHistory = saved ? JSON.parse(saved) : [];
    }

    saveHistory() {
        localStorage.setItem('vidharvest_download_history', JSON.stringify(this.downloadHistory));
    }

    loadStats() {
        const saved = localStorage.getItem('vidharvest_download_stats');
        if (saved) {
            this.stats = { ...this.stats, ...JSON.parse(saved) };
        }
    }

    saveStats() {
        localStorage.setItem('vidharvest_download_stats', JSON.stringify(this.stats));
    }

    reportError(downloadId) {
        const download = this.downloads.get(downloadId) || 
                        this.downloadHistory.find(d => d.id === downloadId);
        
        if (!download) return;
        
        const errorReport = {
            downloadId: downloadId,
            url: download.url,
            error: download.error,
            userAgent: navigator.userAgent,
            timestamp: Date.now()
        };
        
        // In a real implementation, this would send to an error reporting service
        console.log('Error report:', errorReport);
        
        alert('Error report submitted. Thank you for helping us improve VidHarvest Pro!');
    }
}

// Export for use in main app
window.DownloadManager = DownloadManager;