const axios = require('axios');

class VidHarvestGeminiAI {
  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY;
    this.apiUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';
    this.conversationHistory = new Map();
    this.platformContext = this.initializePlatformContext();
  }

  initializePlatformContext() {
    return {
      identity: "VidHarvest Pro AI Assistant",
      role: "I am the AI assistant for VidHarvest Pro, a ChatGPT-style Progressive Web App for downloading videos from 50+ platforms including YouTube, TikTok, Instagram, Facebook, and more.",
      capabilities: [
        "Download videos from 50+ platforms (YouTube, TikTok, Instagram, Facebook, Twitter, Vimeo, etc.)",
        "Multiple quality options (4K, 1080p, 720p, 480p, audio-only)",
        "AI enhancement features (upscaling, noise reduction, color correction)",
        "Batch downloads and playlist support",
        "Watermark removal for TikTok and Instagram",
        "PWA features (offline support, push notifications, background sync)"
      ],
      pages: [
        "Privacy Policy - Details about data collection and usage",
        "Terms of Service - User agreements and platform rules", 
        "AI Data Processing - Information about how AI processes user data",
        "Supported Platforms - Complete list of 50+ supported video platforms",
        "Download History - User's previous downloads and settings",
        "Settings - Quality preferences, enhancement options, notification settings"
      ],
      personality: "Helpful, knowledgeable, and enthusiastic about video downloading. I maintain a conversational tone while being informative about technical aspects."
    };
  }

  async processMessage(userMessage, sessionId = 'default') {
    const systemPrompt = this.buildSystemPrompt();
    
    // Only send current message with system prompt - no conversation history
    const messages = [
      { role: 'user', parts: [{ text: `${systemPrompt}\n\nUser: ${this.sanitizeMessage(userMessage)}` }] }
    ];

    const response = await this.callGeminiAPI(messages);
    return response;
  }
  
  sanitizeMessage(message) {
    // Remove any URLs or sensitive data before sending to Gemini
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return message.replace(urlRegex, '[VIDEO_URL]');
  }

  buildSystemPrompt() {
    return `You are VidHarvest Pro AI Assistant. You help users download videos from 50+ platforms. Be helpful and conversational. Do not store or remember any user data, URLs, or download information.`;
  }

  async callGeminiAPI(messages) {
    try {
      const requestBody = {
        contents: messages,
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 1024
        }
      };

      const response = await axios.post(`${this.apiUrl}?key=${this.apiKey}`, requestBody, {
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const aiResponse = response.data.candidates[0].content.parts[0].text;
      
      // Determine response type and action
      const type = this.determineResponseType(aiResponse);
      const action = this.determineAction(aiResponse);
      const data = this.extractActionData(aiResponse);

      return {
        type,
        message: aiResponse,
        action,
        data
      };
    } catch (error) {
      console.error('Gemini API Error:', error.message);
      return {
        type: 'error',
        message: "I'm here to help you download videos! Just paste a video URL from any supported platform and I'll analyze it for you.\n\nSupported platforms include:\n• YouTube, TikTok, Instagram, Facebook\n• Twitter/X, LinkedIn, Reddit, Vimeo\n• And 50+ other video platforms\n\nTry pasting a video URL to get started!",
        action: 'none'
      };
    }
  }

  determineResponseType(response) {
    const lower = response.toLowerCase();
    
    if (lower.includes('video detected') || lower.includes('analyze')) return 'url_analysis';
    if (lower.includes('privacy') || lower.includes('policy')) return 'privacy_info';
    if (lower.includes('terms') || lower.includes('service')) return 'terms_info';
    if (lower.includes('ai data') || lower.includes('processing')) return 'ai_data_info';
    if (lower.includes('platforms') || lower.includes('supported')) return 'platform_info';
    if (lower.includes('quality') || lower.includes('download')) return 'download_info';
    if (lower.includes('error') || lower.includes('problem')) return 'error_help';
    
    return 'general';
  }

  determineAction(response) {
    const lower = response.toLowerCase();
    
    if (lower.includes('paste') && lower.includes('url')) return 'request_url';
    if (lower.includes('analyze') || lower.includes('quality options')) return 'analyze_url';
    if (lower.includes('privacy policy')) return 'show_privacy';
    if (lower.includes('terms of service')) return 'show_terms';
    if (lower.includes('ai data processing')) return 'show_ai_data';
    if (lower.includes('supported platforms')) return 'show_platforms';
    
    return 'none';
  }

  extractActionData(response) {
    // Extract URLs if mentioned
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const urls = response.match(urlRegex);
    
    if (urls && urls.length > 0) {
      return { url: urls[0] };
    }
    
    return null;
  }

  getConversation(sessionId) {
    if (!this.conversationHistory.has(sessionId)) {
      this.conversationHistory.set(sessionId, []);
    }
    return this.conversationHistory.get(sessionId);
  }
}

const aiSystem = new VidHarvestGeminiAI();

async function getAIResponse(message, sessionId = 'default') {
  return await aiSystem.processMessage(message, sessionId);
}

module.exports = { getAIResponse, VidHarvestGeminiAI };