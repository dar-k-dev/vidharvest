// VidHarvest Pro - Progressive Web App Module

class PWAManager {
    constructor(app) {
        this.app = app;
        this.isOnline = navigator.onLine;
        this.installPrompt = null;
        this.registration = null;
        
        this.initializePWA();
    }

    initializePWA() {
        this.registerServiceWorker();
        this.setupInstallPrompt();
        this.setupOfflineHandling();
        this.setupNotifications();
        this.setupBackgroundSync();
        this.setupPeriodicSync();
    }

    // Service Worker Registration
    async registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            try {
                this.registration = await navigator.serviceWorker.register('/sw.js');
                console.log('Service Worker registered successfully');
                
                // Handle updates
                this.registration.addEventListener('updatefound', () => {
                    const newWorker = this.registration.installing;
                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            this.showUpdateAvailable();
                        }
                    });
                });
                
            } catch (error) {
                console.error('Service Worker registration failed:', error);
            }
        }
    }

    showUpdateAvailable() {
        const updateBanner = document.createElement('div');
        updateBanner.className = 'update-banner';
        updateBanner.innerHTML = `
            <div class="update-content">
                <span>🚀 A new version of VidHarvest Pro is available!</span>
                <button class="update-btn" onclick="pwaManager.updateApp()">Update Now</button>
                <button class="dismiss-btn" onclick="this.parentElement.parentElement.remove()">×</button>
            </div>
        `;
        
        updateBanner.style.cssText = `
            position: fixed;
            top: 64px;
            left: 0;
            right: 0;
            background: var(--accent-teal);
            color: white;
            padding: 12px 20px;
            z-index: 1001;
            animation: slideDown 0.3s ease;
        `;
        
        document.body.appendChild(updateBanner);
    }

    async updateApp() {
        if (this.registration && this.registration.waiting) {
            this.registration.waiting.postMessage({ type: 'SKIP_WAITING' });
            window.location.reload();
        }
    }

    // Install Prompt
    setupInstallPrompt() {
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            this.installPrompt = e;
            this.showInstallButton();
        });

        // Handle successful installation
        window.addEventListener('appinstalled', () => {
            console.log('VidHarvest Pro installed successfully');
            this.hideInstallButton();
            this.trackInstallation();
        });
    }

    showInstallButton() {
        // Add install button to header if not already present
        if (document.getElementById('installBtn')) return;

        const installBtn = document.createElement('button');
        installBtn.id = 'installBtn';
        installBtn.className = 'header-btn';
        installBtn.title = 'Install VidHarvest Pro';
        installBtn.innerHTML = `
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7,10 12,15 17,10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
        `;
        
        installBtn.addEventListener('click', () => this.promptInstall());
        
        // Insert before theme toggle
        const headerRight = document.querySelector('.header-right');
        const themeToggle = document.getElementById('themeToggle');
        headerRight.insertBefore(installBtn, themeToggle);
    }

    hideInstallButton() {
        const installBtn = document.getElementById('installBtn');
        if (installBtn) {
            installBtn.remove();
        }
    }

    async promptInstall() {
        if (!this.installPrompt) return;

        const result = await this.installPrompt.prompt();
        console.log('Install prompt result:', result.outcome);
        
        this.installPrompt = null;
        this.hideInstallButton();
    }

    trackInstallation() {
        // Track installation analytics
        const installData = {
            timestamp: Date.now(),
            userAgent: navigator.userAgent,
            platform: navigator.platform
        };
        
        localStorage.setItem('vidharvest_install_data', JSON.stringify(installData));
    }

    // Offline Handling
    setupOfflineHandling() {
        window.addEventListener('online', () => {
            this.isOnline = true;
            this.handleOnline();
        });

        window.addEventListener('offline', () => {
            this.isOnline = false;
            this.handleOffline();
        });

        // Check initial state
        if (!this.isOnline) {
            this.handleOffline();
        }
    }

    handleOnline() {
        console.log('App is online');
        this.app.updateStatus('Ready');
        this.hideOfflineBanner();
        this.syncOfflineData();
    }

    handleOffline() {
        console.log('App is offline');
        this.app.updateStatus('Offline');
        this.showOfflineBanner();
    }

    showOfflineBanner() {
        if (document.getElementById('offlineBanner')) return;

        const offlineBanner = document.createElement('div');
        offlineBanner.id = 'offlineBanner';
        offlineBanner.className = 'offline-banner';
        offlineBanner.innerHTML = `
            <div class="offline-content">
                <span>📡 You're offline. Some features may be limited.</span>
                <button class="retry-btn" onclick="pwaManager.checkConnection()">Retry</button>
            </div>
        `;
        
        offlineBanner.style.cssText = `
            position: fixed;
            top: 64px;
            left: 0;
            right: 0;
            background: var(--warning-orange);
            color: white;
            padding: 12px 20px;
            z-index: 1001;
            animation: slideDown 0.3s ease;
        `;
        
        document.body.appendChild(offlineBanner);
    }

    hideOfflineBanner() {
        const offlineBanner = document.getElementById('offlineBanner');
        if (offlineBanner) {
            offlineBanner.remove();
        }
    }

    checkConnection() {
        // Force a connection check
        fetch('/api/ping', { method: 'HEAD' })
            .then(() => {
                if (!this.isOnline) {
                    this.isOnline = true;
                    this.handleOnline();
                }
            })
            .catch(() => {
                console.log('Still offline');
            });
    }

    // Offline Data Sync
    async syncOfflineData() {
        const offlineData = this.getOfflineData();
        
        if (offlineData.length === 0) return;

        console.log(`Syncing ${offlineData.length} offline items`);
        
        for (const item of offlineData) {
            try {
                await this.syncOfflineItem(item);
                this.removeOfflineItem(item.id);
            } catch (error) {
                console.error('Failed to sync offline item:', error);
            }
        }
    }

    async syncOfflineItem(item) {
        switch (item.type) {
            case 'download_request':
                return await this.syncDownloadRequest(item);
            case 'settings_update':
                return await this.syncSettingsUpdate(item);
            case 'chat_message':
                return await this.syncChatMessage(item);
            default:
                console.warn('Unknown offline item type:', item.type);
        }
    }

    async syncDownloadRequest(item) {
        const response = await fetch('/api/download', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(item.data)
        });
        
        if (!response.ok) {
            throw new Error('Failed to sync download request');
        }
        
        return await response.json();
    }

    getOfflineData() {
        const data = localStorage.getItem('vidharvest_offline_data');
        return data ? JSON.parse(data) : [];
    }

    addOfflineData(type, data) {
        const offlineData = this.getOfflineData();
        const item = {
            id: this.app.generateId(),
            type: type,
            data: data,
            timestamp: Date.now()
        };
        
        offlineData.push(item);
        localStorage.setItem('vidharvest_offline_data', JSON.stringify(offlineData));
        
        return item.id;
    }

    removeOfflineItem(itemId) {
        const offlineData = this.getOfflineData();
        const filteredData = offlineData.filter(item => item.id !== itemId);
        localStorage.setItem('vidharvest_offline_data', JSON.stringify(filteredData));
    }

    // Push Notifications
    setupNotifications() {
        if ('Notification' in window) {
            this.checkNotificationPermission();
        }
    }

    async checkNotificationPermission() {
        const permission = await Notification.requestPermission();
        
        if (permission === 'granted') {
            console.log('Notification permission granted');
            this.setupPushSubscription();
        } else {
            console.log('Notification permission denied');
        }
    }

    async setupPushSubscription() {
        if (!this.registration) return;

        try {
            const subscription = await this.registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: this.urlBase64ToUint8Array(this.getVapidPublicKey())
            });
            
            console.log('Push subscription created');
            await this.sendSubscriptionToServer(subscription);
            
        } catch (error) {
            console.error('Failed to subscribe to push notifications:', error);
        }
    }

    async sendSubscriptionToServer(subscription) {
        try {
            await fetch('/api/push/subscribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    subscription: subscription,
                    userId: this.app.getUserId()
                })
            });
        } catch (error) {
            console.error('Failed to send subscription to server:', error);
        }
    }

    getVapidPublicKey() {
        // In a real implementation, this would be your VAPID public key
        return 'BEl62iUYgUivxIkv69yViEuiBIa40HI80NqIUHI80NqIUHI80NqIUHI80NqIUHI80NqIUHI80NqI';
    }

    urlBase64ToUint8Array(base64String) {
        const padding = '='.repeat((4 - base64String.length % 4) % 4);
        const base64 = (base64String + padding)
            .replace(/-/g, '+')
            .replace(/_/g, '/');

        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);

        for (let i = 0; i < rawData.length; ++i) {
            outputArray[i] = rawData.charCodeAt(i);
        }
        return outputArray;
    }

    async showNotification(title, options = {}) {
        if (Notification.permission !== 'granted') return;

        const defaultOptions = {
            icon: '/images/icon-192x192.png',
            badge: '/images/badge-72x72.png',
            tag: 'vidharvest-notification',
            renotify: true,
            requireInteraction: false,
            ...options
        };

        if (this.registration) {
            await this.registration.showNotification(title, defaultOptions);
        } else {
            new Notification(title, defaultOptions);
        }
    }

    // Background Sync
    setupBackgroundSync() {
        if ('serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype) {
            navigator.serviceWorker.ready.then((registration) => {
                // Register for background sync when offline data is added
                this.backgroundSyncRegistration = registration;
            });
        }
    }

    async requestBackgroundSync(tag) {
        if (this.backgroundSyncRegistration) {
            try {
                await this.backgroundSyncRegistration.sync.register(tag);
                console.log('Background sync registered:', tag);
            } catch (error) {
                console.error('Background sync registration failed:', error);
            }
        }
    }

    // Periodic Background Sync
    setupPeriodicSync() {
        if ('serviceWorker' in navigator && 'periodicSync' in window.ServiceWorkerRegistration.prototype) {
            navigator.serviceWorker.ready.then(async (registration) => {
                const status = await navigator.permissions.query({ name: 'periodic-background-sync' });
                
                if (status.state === 'granted') {
                    try {
                        await registration.periodicSync.register('check-updates', {
                            minInterval: 24 * 60 * 60 * 1000 // 24 hours
                        });
                        console.log('Periodic sync registered');
                    } catch (error) {
                        console.error('Periodic sync registration failed:', error);
                    }
                }
            });
        }
    }

    // App Shortcuts
    setupAppShortcuts() {
        // This would be handled in the manifest.json file
        // But we can also handle shortcut actions here
        navigator.serviceWorker.addEventListener('message', (event) => {
            if (event.data && event.data.type === 'SHORTCUT_ACTION') {
                this.handleShortcutAction(event.data.action);
            }
        });
    }

    handleShortcutAction(action) {
        switch (action) {
            case 'new-download':
                this.app.chatInput.focus();
                break;
            case 'view-history':
                this.app.showHistoryModal();
                break;
            case 'settings':
                this.app.showSettingsModal();
                break;
            default:
                console.log('Unknown shortcut action:', action);
        }
    }

    // Share Target API
    setupShareTarget() {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.addEventListener('message', (event) => {
                if (event.data && event.data.type === 'SHARE_TARGET') {
                    this.handleSharedContent(event.data);
                }
            });
        }
    }

    handleSharedContent(data) {
        const { url, text, title } = data;
        
        // If a URL is shared, add it to the chat input
        if (url) {
            this.app.chatInput.value = url;
            this.app.handleInputChange();
            this.app.chatInput.focus();
        } else if (text && this.app.isValidUrl(text)) {
            this.app.chatInput.value = text;
            this.app.handleInputChange();
            this.app.chatInput.focus();
        }
    }

    // File System Access API
    async setupFileSystemAccess() {
        if ('showDirectoryPicker' in window) {
            // Add option to choose download directory
            const changePathBtn = document.getElementById('changePathBtn');
            if (changePathBtn) {
                changePathBtn.addEventListener('click', async () => {
                    try {
                        const dirHandle = await window.showDirectoryPicker();
                        const downloadPath = document.getElementById('downloadPath');
                        downloadPath.value = dirHandle.name;
                        
                        // Store directory handle for future use
                        localStorage.setItem('vidharvest_download_dir', dirHandle.name);
                        
                    } catch (error) {
                        console.log('Directory picker cancelled');
                    }
                });
            }
        }
    }

    // Web Locks API
    async acquireLock(name, callback) {
        if ('locks' in navigator) {
            return await navigator.locks.request(name, callback);
        } else {
            // Fallback for browsers without Web Locks API
            return await callback();
        }
    }

    // Performance Monitoring
    setupPerformanceMonitoring() {
        // Monitor app performance
        if ('performance' in window) {
            // Track navigation timing
            window.addEventListener('load', () => {
                setTimeout(() => {
                    const perfData = performance.getEntriesByType('navigation')[0];
                    this.trackPerformance('page_load', {
                        loadTime: perfData.loadEventEnd - perfData.loadEventStart,
                        domContentLoaded: perfData.domContentLoadedEventEnd - perfData.domContentLoadedEventStart,
                        firstPaint: this.getFirstPaint()
                    });
                }, 0);
            });

            // Track resource loading
            const observer = new PerformanceObserver((list) => {
                for (const entry of list.getEntries()) {
                    if (entry.entryType === 'resource') {
                        this.trackResourceLoad(entry);
                    }
                }
            });
            
            observer.observe({ entryTypes: ['resource'] });
        }
    }

    getFirstPaint() {
        const paintEntries = performance.getEntriesByType('paint');
        const firstPaint = paintEntries.find(entry => entry.name === 'first-paint');
        return firstPaint ? firstPaint.startTime : null;
    }

    trackPerformance(event, data) {
        // In a real implementation, this would send to analytics
        console.log('Performance tracking:', event, data);
    }

    trackResourceLoad(entry) {
        if (entry.duration > 1000) { // Track slow resources
            console.warn('Slow resource load:', entry.name, entry.duration + 'ms');
        }
    }

    // App State Management
    saveAppState() {
        const state = {
            currentSession: this.app.currentSession,
            chatHistory: this.app.chatHistory,
            settings: this.app.settings,
            downloadHistory: this.app.downloadManager?.downloadHistory || [],
            timestamp: Date.now()
        };
        
        localStorage.setItem('vidharvest_app_state', JSON.stringify(state));
    }

    restoreAppState() {
        const saved = localStorage.getItem('vidharvest_app_state');
        if (!saved) return false;

        try {
            const state = JSON.parse(saved);
            
            // Restore session if recent (within 24 hours)
            if (state.timestamp && (Date.now() - state.timestamp) < 24 * 60 * 60 * 1000) {
                if (state.currentSession) {
                    this.app.currentSession = state.currentSession;
                    // Restore messages to UI
                    state.currentSession.messages.forEach(message => {
                        const messageElement = this.app.createMessageElement(message);
                        this.app.chatMessages.appendChild(messageElement);
                    });
                }
                
                return true;
            }
        } catch (error) {
            console.error('Failed to restore app state:', error);
        }
        
        return false;
    }

    // Cleanup
    cleanup() {
        // Clean up old data
        this.cleanupOldData();
        this.cleanupOldCaches();
    }

    cleanupOldData() {
        const maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days
        const now = Date.now();
        
        // Clean up old chat history
        const chatHistory = this.app.chatHistory.filter(session => 
            (now - new Date(session.created).getTime()) < maxAge
        );
        
        if (chatHistory.length !== this.app.chatHistory.length) {
            this.app.chatHistory = chatHistory;
            this.app.saveChatHistory();
        }
        
        // Clean up old offline data
        const offlineData = this.getOfflineData().filter(item =>
            (now - item.timestamp) < maxAge
        );
        
        localStorage.setItem('vidharvest_offline_data', JSON.stringify(offlineData));
    }

    async cleanupOldCaches() {
        if ('caches' in window) {
            const cacheNames = await caches.keys();
            const oldCaches = cacheNames.filter(name => 
                name.startsWith('vidharvest-') && !name.includes('v1.0.0')
            );
            
            await Promise.all(oldCaches.map(name => caches.delete(name)));
        }
    }
}

// Export for use in main app
window.PWAManager = PWAManager;