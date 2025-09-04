// VidHarvest Pro - Chat Management Module

class ChatManager {
    constructor(app) {
        this.app = app;
        this.messageQueue = [];
        this.isProcessing = false;
        this.autoScrollEnabled = true;
        this.lastMessageTime = 0;
        
        this.initializeChatFeatures();
    }

    initializeChatFeatures() {
        this.setupAutoScroll();
        this.setupMessageAnimations();
        this.setupKeyboardShortcuts();
    }

    setupAutoScroll() {
        const chatContainer = this.app.chatMessages;
        
        // Detect manual scrolling
        chatContainer.addEventListener('scroll', () => {
            const isAtBottom = chatContainer.scrollTop + chatContainer.clientHeight >= chatContainer.scrollHeight - 10;
            this.autoScrollEnabled = isAtBottom;
        });

        // Auto-scroll button when not at bottom
        this.createScrollToBottomButton();
    }

    createScrollToBottomButton() {
        const scrollButton = document.createElement('button');
        scrollButton.className = 'scroll-to-bottom';
        scrollButton.innerHTML = '↓';
        scrollButton.style.cssText = `
            position: fixed;
            bottom: 140px;
            right: 20px;
            width: 40px;
            height: 40px;
            border-radius: 50%;
            background: var(--accent-teal);
            color: white;
            border: none;
            cursor: pointer;
            display: none;
            z-index: 100;
            box-shadow: 0 2px 10px rgba(0,0,0,0.2);
            transition: all 0.3s ease;
        `;

        scrollButton.addEventListener('click', () => {
            this.app.scrollToBottom();
            this.autoScrollEnabled = true;
            scrollButton.style.display = 'none';
        });

        document.body.appendChild(scrollButton);

        // Show/hide scroll button
        this.app.chatMessages.addEventListener('scroll', () => {
            const isAtBottom = this.app.chatMessages.scrollTop + this.app.chatMessages.clientHeight >= this.app.chatMessages.scrollHeight - 10;
            scrollButton.style.display = isAtBottom ? 'none' : 'block';
        });
    }

    setupMessageAnimations() {
        // Intersection Observer for message animations
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                }
            });
        }, {
            threshold: 0.1,
            rootMargin: '0px 0px -50px 0px'
        });

        // Observe new messages
        const originalAddMessage = this.app.addMessage.bind(this.app);
        this.app.addMessage = (message) => {
            const messageElement = originalAddMessage(message);
            if (messageElement) {
                observer.observe(messageElement);
            }
            return messageElement;
        };
    }

    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Ctrl/Cmd + K: Focus input
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                this.app.chatInput.focus();
            }

            // Ctrl/Cmd + N: New chat
            if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
                e.preventDefault();
                this.app.startNewChat();
            }

            // Ctrl/Cmd + H: Show history
            if ((e.ctrlKey || e.metaKey) && e.key === 'h') {
                e.preventDefault();
                this.app.showHistoryModal();
            }

            // Escape: Close modals
            if (e.key === 'Escape') {
                this.app.hideHistoryModal();
                this.app.hideSettingsModal();
            }
        });
    }

    // Enhanced message processing
    async processMessageQueue() {
        if (this.isProcessing || this.messageQueue.length === 0) return;

        this.isProcessing = true;

        while (this.messageQueue.length > 0) {
            const message = this.messageQueue.shift();
            await this.processMessage(message);
            
            // Small delay between messages for better UX
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        this.isProcessing = false;
    }

    async processMessage(message) {
        // Add typing delay for assistant messages
        if (message.type === 'assistant' && !message.skipTyping) {
            this.app.showTypingIndicator();
            
            // Calculate typing delay based on message length
            const typingDelay = Math.min(Math.max(message.content.length * 20, 1000), 3000);
            await new Promise(resolve => setTimeout(resolve, typingDelay));
            
            this.app.hideTypingIndicator();
        }

        this.app.addMessage(message);
    }

    // Message formatting utilities
    formatMessage(content, type = 'text') {
        switch (type) {
            case 'code':
                return this.formatCodeMessage(content);
            case 'list':
                return this.formatListMessage(content);
            case 'table':
                return this.formatTableMessage(content);
            default:
                return this.formatTextMessage(content);
        }
    }

    formatTextMessage(content) {
        return content
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/`(.*?)`/g, '<code>$1</code>')
            .replace(/\n/g, '<br>')
            .replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');
    }

    formatCodeMessage(content) {
        return `<pre><code>${this.escapeHtml(content)}</code></pre>`;
    }

    formatListMessage(items) {
        const listItems = items.map(item => `<li>${this.formatTextMessage(item)}</li>`).join('');
        return `<ul>${listItems}</ul>`;
    }

    formatTableMessage(data) {
        if (!data.headers || !data.rows) return '';

        const headers = data.headers.map(h => `<th>${h}</th>`).join('');
        const rows = data.rows.map(row => 
            `<tr>${row.map(cell => `<td>${cell}</td>`).join('')}</tr>`
        ).join('');

        return `<table><thead><tr>${headers}</tr></thead><tbody>${rows}</tbody></table>`;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Message search functionality
    searchMessages(query) {
        if (!this.app.currentSession) return [];

        const results = [];
        const lowerQuery = query.toLowerCase();

        this.app.currentSession.messages.forEach((message, index) => {
            if (message.content.toLowerCase().includes(lowerQuery)) {
                results.push({
                    message,
                    index,
                    preview: this.getMessagePreview(message.content, query)
                });
            }
        });

        return results;
    }

    getMessagePreview(content, query, contextLength = 50) {
        const lowerContent = content.toLowerCase();
        const lowerQuery = query.toLowerCase();
        const index = lowerContent.indexOf(lowerQuery);

        if (index === -1) return content.substring(0, contextLength) + '...';

        const start = Math.max(0, index - contextLength);
        const end = Math.min(content.length, index + query.length + contextLength);

        let preview = content.substring(start, end);
        if (start > 0) preview = '...' + preview;
        if (end < content.length) preview = preview + '...';

        // Highlight the query
        const regex = new RegExp(`(${query})`, 'gi');
        preview = preview.replace(regex, '<mark>$1</mark>');

        return preview;
    }

    // Message export functionality
    exportChat(format = 'json') {
        if (!this.app.currentSession) return null;

        switch (format) {
            case 'json':
                return this.exportAsJSON();
            case 'txt':
                return this.exportAsText();
            case 'html':
                return this.exportAsHTML();
            default:
                return null;
        }
    }

    exportAsJSON() {
        return JSON.stringify(this.app.currentSession, null, 2);
    }

    exportAsText() {
        let text = `VidHarvest Pro Chat Export\n`;
        text += `Session: ${new Date(this.app.currentSession.created).toLocaleString()}\n`;
        text += `Messages: ${this.app.currentSession.messages.length}\n\n`;

        this.app.currentSession.messages.forEach((message, index) => {
            const timestamp = new Date(message.timestamp).toLocaleTimeString();
            const sender = message.type === 'user' ? 'You' : 'VidHarvest Pro';
            
            text += `[${timestamp}] ${sender}:\n`;
            text += `${message.content}\n\n`;
        });

        return text;
    }

    exportAsHTML() {
        let html = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>VidHarvest Pro Chat Export</title>
                <style>
                    body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
                    .message { margin: 20px 0; padding: 15px; border-radius: 10px; }
                    .user { background: #e3f2fd; margin-left: 20%; }
                    .assistant { background: #f5f5f5; margin-right: 20%; }
                    .timestamp { font-size: 12px; color: #666; margin-bottom: 5px; }
                    .sender { font-weight: bold; margin-bottom: 10px; }
                </style>
            </head>
            <body>
                <h1>VidHarvest Pro Chat Export</h1>
                <p>Session: ${new Date(this.app.currentSession.created).toLocaleString()}</p>
                <p>Messages: ${this.app.currentSession.messages.length}</p>
        `;

        this.app.currentSession.messages.forEach(message => {
            const timestamp = new Date(message.timestamp).toLocaleString();
            const sender = message.type === 'user' ? 'You' : 'VidHarvest Pro';
            
            html += `
                <div class="message ${message.type}">
                    <div class="timestamp">${timestamp}</div>
                    <div class="sender">${sender}</div>
                    <div class="content">${message.html ? message.content : this.formatTextMessage(message.content)}</div>
                </div>
            `;
        });

        html += `
            </body>
            </html>
        `;

        return html;
    }

    // Download exported chat
    downloadExport(format = 'json') {
        const content = this.exportChat(format);
        if (!content) return;

        const timestamp = new Date().toISOString().split('T')[0];
        const filename = `vidharvest-chat-${timestamp}.${format}`;
        
        const blob = new Blob([content], { 
            type: format === 'html' ? 'text/html' : 'text/plain' 
        });
        
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    // Message reactions (for future enhancement)
    addMessageReaction(messageIndex, reaction) {
        if (!this.app.currentSession || !this.app.currentSession.messages[messageIndex]) return;

        const message = this.app.currentSession.messages[messageIndex];
        if (!message.reactions) message.reactions = {};
        
        message.reactions[reaction] = (message.reactions[reaction] || 0) + 1;
        this.app.saveChatHistory();
        
        // Update UI
        this.updateMessageReactions(messageIndex);
    }

    updateMessageReactions(messageIndex) {
        // Implementation for updating reaction display in UI
        // This would add reaction buttons/counts to message elements
    }

    // Message threading (for complex conversations)
    createThread(parentMessageIndex, content) {
        if (!this.app.currentSession) return;

        const parentMessage = this.app.currentSession.messages[parentMessageIndex];
        if (!parentMessage) return;

        if (!parentMessage.thread) parentMessage.thread = [];
        
        parentMessage.thread.push({
            id: this.app.generateId(),
            content: content,
            timestamp: new Date(),
            type: 'user'
        });

        this.app.saveChatHistory();
    }

    // Auto-save draft messages
    saveDraft() {
        const draft = this.app.chatInput.value.trim();
        if (draft) {
            localStorage.setItem('vidharvest_draft', draft);
        } else {
            localStorage.removeItem('vidharvest_draft');
        }
    }

    loadDraft() {
        const draft = localStorage.getItem('vidharvest_draft');
        if (draft) {
            this.app.chatInput.value = draft;
            this.app.handleInputChange();
        }
    }

    clearDraft() {
        localStorage.removeItem('vidharvest_draft');
    }

    // Message templates for common queries
    getMessageTemplates() {
        return {
            'Download YouTube video': 'Please download this YouTube video: ',
            'Download TikTok video': 'I need to download this TikTok video: ',
            'Download Instagram reel': 'Can you download this Instagram reel: ',
            'Download playlist': 'Please download all videos from this playlist: ',
            'Audio only': 'I only need the audio from this video: ',
            'Best quality': 'Download this video in the best quality available: ',
            'Mobile quality': 'Download this video in mobile-friendly quality: ',
            'Help with platforms': 'What platforms do you support?',
            'Help with quality': 'What quality options are available?',
            'Help with features': 'What features do you offer?'
        };
    }

    insertTemplate(templateKey) {
        const templates = this.getMessageTemplates();
        const template = templates[templateKey];
        
        if (template) {
            this.app.chatInput.value = template;
            this.app.handleInputChange();
            this.app.chatInput.focus();
            
            // Position cursor at the end
            this.app.chatInput.setSelectionRange(template.length, template.length);
        }
    }

    // Voice input support (for future enhancement)
    startVoiceInput() {
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
            alert('Voice input is not supported in your browser');
            return;
        }

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        const recognition = new SpeechRecognition();
        
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = 'en-US';

        recognition.onstart = () => {
            this.app.updateStatus('Listening...');
        };

        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            this.app.chatInput.value = transcript;
            this.app.handleInputChange();
            this.app.updateStatus('Ready');
        };

        recognition.onerror = (event) => {
            console.error('Speech recognition error:', event.error);
            this.app.updateStatus('Ready');
        };

        recognition.onend = () => {
            this.app.updateStatus('Ready');
        };

        recognition.start();
    }
}

// Export for use in main app
window.ChatManager = ChatManager;