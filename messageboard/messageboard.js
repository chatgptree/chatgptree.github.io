class TreeMessageBoard {
    constructor() {
        // Core properties
        this.pageSize = 20;
        this.messages = [];
        this.filteredMessages = [];
        this.currentFilter = 'all';
        this.isLoading = true;
        this.hasMoreMessages = true;
        this.currentDate = new Date();
        this.lastUpdateTime = 0;
        this.pollingInterval = 5000;
        
        // DOM elements
        this.messageContainer = document.getElementById('messageContainer');
        this.searchInput = document.getElementById('searchInput');
        
        this.setupEventListeners();
        this.initialize();
    }

    async initialize() {
        try {
            await this.loadMessages();
            this.startPolling();
        } catch (error) {
            console.error('Failed to initialize:', error);
            this.showError('Failed to load messages');
        }
    }

    async loadMessages() {
        if (!this.hasMoreMessages || this.isLoading) return;
        this.isLoading = true;
        this.showLoadingSpinner();

        try {
            console.log('Loading messages for date:', this.currentDate.toISOString().split('T')[0]);
            const messages = await this.fetchMessagesForDate(this.currentDate);
            
            if (messages.length === 0) {
                // Move to previous day
                this.currentDate.setDate(this.currentDate.getDate() - 1);
                
                // Check 6-month limit
                const maxHistory = new Date();
                maxHistory.setMonth(maxHistory.getMonth() - 6);
                if (this.currentDate < maxHistory) {
                    console.log('Reached 6-month history limit');
                    this.hasMoreMessages = false;
                }
            } else {
                console.log(`Found ${messages.length} messages for ${this.currentDate.toISOString().split('T')[0]}`);
                this.messages = [...this.messages, ...messages];
                this.messages.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
                this.lastUpdateTime = Math.max(
                    this.lastUpdateTime, 
                    ...messages.map(m => new Date(m.timestamp).getTime())
                );
            }

            this.filterAndRenderMessages();
            this.setupInfiniteScroll();
        } catch (error) {
            console.error('Load error:', error);
            this.showError('Unable to load messages');
        } finally {
            this.isLoading = false;
            this.hideLoadingSpinner();
        }
    }

    async fetchMessagesForDate(date) {
        const year = date.getUTCFullYear();
        const month = date.toLocaleString('default', { month: 'long', timeZone: 'UTC' }).toLowerCase();
        const day = date.toISOString().split('T')[0];
        
        const url = `https://raw.githubusercontent.com/chatgptree/chatgptree.github.io/main/messages/${year}/${month}/${day}.json`;
        
        try {
            console.log('Fetching messages from:', url);
            const response = await fetch(url, { cache: 'no-store' });
            
            if (response.status === 404) {
                console.log(`No messages found for ${day}`);
                return [];
            }
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            const messages = await response.json();
            console.log(`Successfully loaded ${messages.length} messages for ${day}`);
            return messages;
        } catch (error) {
            if (error.message.includes('404')) return [];
            console.error('Fetch error:', error);
            throw error;
        }
    }

    async checkForNewMessages() {
        try {
            const currentDate = new Date();
            const messages = await this.fetchMessagesForDate(currentDate);
            
            const newMessages = messages.filter(msg => 
                new Date(msg.timestamp).getTime() > this.lastUpdateTime
            );

            if (newMessages.length) {
                console.log(`Found ${newMessages.length} new messages`);
                this.messages = [...newMessages, ...this.messages];
                this.lastUpdateTime = Math.max(
                    ...newMessages.map(m => new Date(m.timestamp).getTime())
                );
                this.filterAndRenderMessages();
                this.showNotification(`${newMessages.length} new message${newMessages.length > 1 ? 's' : ''} arrived! 🌱`);
            }
        } catch (error) {
            console.error('Check new messages error:', error);
        }
    }

    startPolling() {
        setInterval(() => this.checkForNewMessages(), this.pollingInterval);
    }

    filterAndRenderMessages() {
        this.filteredMessages = this.messages.filter(message => {
            if (this.currentFilter === 'all') return true;
            return message.rating >= parseInt(this.currentFilter);
        });

        if (this.searchInput.value.trim()) {
            const searchTerm = this.searchInput.value.toLowerCase();
            this.filteredMessages = this.filteredMessages.filter(message =>
                message.message.toLowerCase().includes(searchTerm) ||
                message.userName.toLowerCase().includes(searchTerm) ||
                message.location.toLowerCase().includes(searchTerm)
            );
        }

        this.renderMessages();
    }

    renderMessages() {
        if (!this.messageContainer) return;
        
        const messagesHtml = this.filteredMessages
            .slice(0, this.pageSize)
            .map(message => this.createMessageHtml(message))
            .join('');

        this.messageContainer.innerHTML = messagesHtml || '<p class="no-messages">No messages yet. Be the first to leave feedback!</p>';
    }

    createMessageHtml(message) {
        const timestamp = new Date(message.timestamp);
        const timeAgo = this.getTimeAgo(timestamp);
        
        return `
            <div class="message-card">
                <div class="message-header">
                    <span class="user-name">${this.escapeHtml(message.userName)}</span>
                    <span class="location">${this.escapeHtml(message.location)}</span>
                    <span class="timestamp" title="${timestamp.toLocaleString()}">${timeAgo}</span>
                </div>
                <div class="message-body">
                    <p>${this.escapeHtml(message.message)}</p>
                </div>
                <div class="message-footer">
                    <div class="rating">
                        ${'⭐'.repeat(message.rating)}
                    </div>
                    <div class="tree-info">
                        <span class="tree-name">${this.escapeHtml(message.treeName)}</span>
                        <span class="tree-location">${this.escapeHtml(message.treeLocation)}</span>
                    </div>
                </div>
            </div>
        `;
    }

    setupEventListeners() {
        if (this.searchInput) {
            this.searchInput.addEventListener('input', () => this.filterAndRenderMessages());
        }

        window.addEventListener('scroll', () => {
            if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 1000) {
                this.loadMessages();
            }
        });
    }

    getTimeAgo(date) {
        const seconds = Math.floor((new Date() - date) / 1000);
        const intervals = {
            year: 31536000,
            month: 2592000,
            week: 604800,
            day: 86400,
            hour: 3600,
            minute: 60
        };

        for (const [unit, secondsInUnit] of Object.entries(intervals)) {
            const interval = Math.floor(seconds / secondsInUnit);
            if (interval >= 1) {
                return `${interval} ${unit}${interval === 1 ? '' : 's'} ago`;
            }
        }
        return 'Just now';
    }

    escapeHtml(unsafe) {
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    showLoadingSpinner() {
        const spinner = document.createElement('div');
        spinner.className = 'loading-spinner';
        spinner.innerHTML = '🌱';
        this.messageContainer.appendChild(spinner);
    }

    hideLoadingSpinner() {
        const spinner = this.messageContainer.querySelector('.loading-spinner');
        if (spinner) spinner.remove();
    }

    showNotification(message) {
        const notification = document.createElement('div');
        notification.className = 'notification';
        notification.textContent = message;
        document.body.appendChild(notification);
        setTimeout(() => notification.remove(), 3000);
    }

    showError(message) {
        const error = document.createElement('div');
        error.className = 'error-message';
        error.textContent = message;
        this.messageContainer.appendChild(error);
        setTimeout(() => error.remove(), 5000);
    }
}
