class TreeMessageBoard {
    constructor() {
        // Minimal core properties
        this.messages = [];
        this.isLoading = false;
        this.messageContainer = document.getElementById('messageContainer');
        this.searchInput = document.getElementById('searchInput');
        this.lastCheckedDate = null;
        
        // Use localStorage to track last update time
        this.lastUpdateTime = parseInt(localStorage.getItem('lastUpdateTime')) || 0;
        
        // Simple index to track loaded dates
        this.loadedDates = new Set();
        
        this.setupEventListeners();
        this.initialize();
    }

    async initialize() {
        try {
            await this.loadInitialMessages();
            // Check for new messages every minute instead of every 5 seconds
            setInterval(() => this.checkForNewMessages(), 5000);
        } catch (error) {
            console.error('Failed to initialize:', error);
            this.showError('Unable to load messages. Please try again.');
        }
    }

    formatDatePath(date) {
        // Get the full year
        const year = date.getUTCFullYear();
        
        // Get month name in lowercase
        const month = date.toLocaleString('default', { 
            month: 'long', 
            timeZone: 'UTC' 
        }).toLowerCase();
        
        // Get date in YYYY-MM-DD format
        const dateStr = date.toISOString().split('T')[0];
        
        const url = `/messages/${year}/${month}/${dateStr}.json`;
        console.log('Constructed URL:', url);
        
        return url;
    }

    async loadInitialMessages() {
        const today = new Date();
        this.showLoadingSpinner();
        
        console.log('Starting initial load for date:', today);
        
        // Load last 3 days
        for (let i = 0; i < 7; i++) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);
            console.log(`Loading day ${i}:`, date.toISOString().split('T')[0]);
            await this.loadDateMessages(date);
        }
        
        console.log('Initial load complete. Messages:', this.messages.length);
        
        this.filterAndRender();
        this.setupInfiniteScroll();
    }

    async loadDateMessages(date) {
        if (this.isLoading) return;
        
        const dateStr = date.toISOString().split('T')[0];
        if (this.loadedDates.has(dateStr)) return;

        this.isLoading = true;
        const url = this.formatDatePath(date);
        
        try {
            console.log('Fetching messages from:', url);
            const response = await fetch(url, { 
                cache: 'no-store',  // Disable cache during testing
                headers: {
                    'Accept': 'application/json'
                }
            });

            if (response.ok) {
                const newMessages = await response.json();
                // Only add messages we don't already have
                const existingIds = new Set(this.messages.map(m => m.id));
                const uniqueNewMessages = newMessages.filter(m => !existingIds.has(m.id));
                
                if (uniqueNewMessages.length > 0) {
                    this.messages = [...this.messages, ...uniqueNewMessages]
                        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
                }
                this.loadedDates.add(dateStr);
            }
        } catch (error) {
            if (error.response?.status !== 404) {
                console.error(`Error loading messages for ${dateStr}:`, error);
            }
        } finally {
            this.isLoading = false;
        }
    }

    async checkForNewMessages() {
        const now = new Date();
        const today = now.toISOString().split('T')[0];
        
        // Only check if we haven't checked in the last minute
        if (this.lastCheckedDate === today) return;
        
        try {
            await this.loadDateMessages(now);
            this.lastCheckedDate = today;
            
            // Update localStorage timestamp
            const latestMessageTime = Math.max(
                ...this.messages.map(m => new Date(m.timestamp).getTime())
            );
            if (latestMessageTime > this.lastUpdateTime) {
                this.lastUpdateTime = latestMessageTime;
                localStorage.setItem('lastUpdateTime', latestMessageTime.toString());
                this.filterAndRender();
                this.showNotification('New messages have arrived! 🌱');
            }
        } catch (error) {
            console.error('Error checking new messages:', error);
        }
    }

    setupInfiniteScroll() {
        const observer = new IntersectionObserver(
            async (entries) => {
                if (!entries[0].isIntersecting || this.isLoading) return;
                
                // Load previous day's messages
                const lastDate = new Date(
                    Math.min(...this.messages.map(m => new Date(m.timestamp)))
                );
                lastDate.setDate(lastDate.getDate() - 1);
                
                await this.loadDateMessages(lastDate);
                this.filterAndRender();
            },
            { threshold: 0.1 }
        );

        // Observe the last message
        const lastMessage = this.messageContainer.lastElementChild;
        if (lastMessage) observer.observe(lastMessage);
    }

    filterAndRender() {
        const searchTerm = (this.searchInput?.value || '').toLowerCase();
        let filtered = this.messages;

        if (searchTerm) {
            filtered = filtered.filter(message => 
                (message.userName?.toLowerCase().includes(searchTerm) ||
                message.message?.toLowerCase().includes(searchTerm) ||
                message.treeName?.toLowerCase().includes(searchTerm))
            );
        }

        this.renderMessages(filtered);
    }

    renderMessages(messages) {
        if (!messages?.length) {
            this.messageContainer.innerHTML = `
                <div class="no-messages">
                    <i class="fas fa-seedling"></i>
                    <p>No messages found.</p>
                </div>`;
            return;
        }

        // Use DocumentFragment for better performance
        const fragment = document.createDocumentFragment();
        
        messages.forEach(message => {
            const messageDiv = document.createElement('div');
            messageDiv.className = 'message-card';
            messageDiv.innerHTML = this.createMessageHTML(message);
            fragment.appendChild(messageDiv);
        });

        this.messageContainer.innerHTML = '';
        this.messageContainer.appendChild(fragment);
    }

    createMessageHTML(message) {
        // Add rating stars if rating exists
        const ratingHtml = message.rating ? 
            `<div class="message-rating">${'⭐'.repeat(message.rating)}</div>` : '';

        return `
            <div class="message-header">
                <h3>${this.escapeHtml(message.userName)} 
                    <span class="location-text">from ${this.escapeHtml(message.location)}</span>
                </h3>
                <span class="message-date">${this.formatDate(message.timestamp)}</span>
            </div>
            ${ratingHtml}
            <p class="message-content">${this.escapeHtml(message.message)}</p>
            <div class="message-footer">
                <span>🌳 <strong>${this.escapeHtml(message.treeName)}</strong></span>
                <div class="tree-location">
                    <i class="fas fa-map-marker-alt"></i> 
                    ${this.escapeHtml(message.treeLocation)}
                </div>
            </div>`;
    }

    escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    formatDate(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now - date;
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        
        if (days < 1) return 'Today';
        if (days === 1) return 'Yesterday';
        if (days < 7) return `${days} days ago`;
        
        return date.toLocaleDateString('en-AU', {
            month: 'short',
            day: 'numeric'
        });
    }

    showLoadingSpinner() {
        if (!this.messages.length) {
            this.messageContainer.innerHTML = `
                <div class="loading-spinner">
                    <i class="fas fa-leaf fa-spin"></i>
                </div>`;
        }
    }

    showError(message) {
        this.messageContainer.innerHTML = `
            <div class="error-message">
                <p>${message}</p>
                <button onclick="window.messageBoard.loadInitialMessages()">Retry</button>
            </div>`;
    }

    showNotification(message) {
        const notification = document.createElement('div');
        notification.className = 'notification';
        notification.textContent = message;
        document.body.appendChild(notification);
        setTimeout(() => notification.remove(), 3000);
    }

    setupEventListeners() {
        // Debounced search
        let searchTimeout;
        this.searchInput?.addEventListener('input', () => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => this.filterAndRender(), 300);
        });
    }
}

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', () => {
    window.messageBoard = new TreeMessageBoard();
});