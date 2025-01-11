class TreeMessageBoard {
    constructor() {
        // Pagination properties
        this.pageSize = 20;
        this.lastMessageTimestamp = null;
        this.hasMoreMessages = true;
        
        // Message and filtering properties
        this.messages = [];
        this.filteredMessages = [];
        this.currentFilter = 'all';
        this.isLoading = true;
        this.lastUpdateTime = 0;
        
        // Polling properties
        this.pollingTimer = null;
        this.pollingInterval = 5000; // 5 seconds
        this.maxRetries = 3;
        this.retryCount = 0;
        
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
            console.error('Failed to initialize message board:', error);
            this.showError('Failed to load messages. Please try again later.');
        }
    }

    startPolling() {
        // Clear any existing interval first
        this.stopPolling();
        
        // Set up new polling interval
        this.pollingTimer = setInterval(() => {
            this.checkForNewMessages().catch(error => {
                console.error('Polling error:', error);
                this.retryCount++;
                
                if (this.retryCount >= this.maxRetries) {
                    console.log('Max retries reached, stopping polling');
                    this.stopPolling();
                    // Restart polling after 1 minute
                    setTimeout(() => {
                        console.log('Restarting polling');
                        this.retryCount = 0;
                        this.startPolling();
                    }, 60000);
                }
            });
        }, this.pollingInterval);

        // Add visibility change handling
        document.addEventListener('visibilitychange', this.handleVisibilityChange.bind(this));
    }

    stopPolling() {
        if (this.pollingTimer) {
            clearInterval(this.pollingTimer);
            this.pollingTimer = null;
        }
    }

    handleVisibilityChange() {
        if (document.hidden) {
            console.log('Page hidden, stopping polling');
            this.stopPolling();
        } else {
            console.log('Page visible, restarting polling');
            this.retryCount = 0;
            this.startPolling();
            this.checkForNewMessages(); // Immediate check when tab becomes visible
        }
    }

    async checkForNewMessages() {
        try {
            const now = new Date();
            const year = now.getFullYear();
            const currentMonth = now.toLocaleString('default', { month: 'long' }).toLowerCase();
            
            const url = `https://raw.githubusercontent.com/chatgptree/chatgptree.github.io/main/messages/${year}/${currentMonth}.json`;
            
            const response = await fetch(url, {
                cache: 'no-store',
                headers: {
                    'Cache-Control': 'no-cache',
                    'Pragma': 'no-cache'
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            
            // Reset retry count on successful fetch
            this.retryCount = 0;
            
            // Check for new messages
            const hasNewMessages = data.some(message => {
                const messageTime = new Date(message.timestamp).getTime();
                return messageTime > this.lastUpdateTime;
            });

            if (hasNewMessages) {
                console.log(`[${new Date().toISOString()}] New messages found, updating...`);
                const newMessages = data.filter(message => {
                    const messageTime = new Date(message.timestamp).getTime();
                    return messageTime > this.lastUpdateTime;
                });
                this.messages = [...newMessages, ...this.messages];
                this.lastUpdateTime = Date.now();
                this.filterAndRenderMessages();
                this.showNotification('New messages have arrived! 🌱');
            }
        } catch (error) {
            console.error('Error checking for new messages:', error);
            throw error; // Rethrow to trigger retry logic
        }
    }

    async loadMessages() {
        try {
            if (!this.hasMoreMessages || this.isLoading) return;
            
            this.showLoadingSpinner();
            
            const now = new Date();
            const year = now.getFullYear();
            const currentMonth = now.toLocaleString('default', { month: 'long' }).toLowerCase();
            
            const url = `https://raw.githubusercontent.com/chatgptree/chatgptree.github.io/main/messages/${year}/${currentMonth}.json`;
            console.log('Fetching from:', url);
            
            const response = await fetch(url, {
                cache: 'no-store',
                headers: {
                    'Cache-Control': 'no-cache',
                    'Pragma': 'no-cache'
                }
            });
            
            if (!response.ok) {
                throw new Error(`Failed to fetch messages: ${response.status}`);
            }

            const data = await response.json();
            
            // Filter messages after the cursor
            let filteredData = this.lastMessageTimestamp 
                ? data.filter(msg => new Date(msg.timestamp) < new Date(this.lastMessageTimestamp))
                : data;
            
            // Get only pageSize number of messages
            const newMessages = filteredData.slice(0, this.pageSize);
            
            // Check if we have more messages to load
            this.hasMoreMessages = filteredData.length > this.pageSize;
            
            if (newMessages.length > 0) {
                // Update cursor to last message's timestamp
                this.lastMessageTimestamp = newMessages[newMessages.length - 1].timestamp;
                
                // Append new messages to existing ones
                this.messages = [...this.messages, ...newMessages];
                this.messages.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
                this.lastUpdateTime = Date.now();
            }
            
            this.isLoading = false;
            this.filterAndRenderMessages();
            
            // Set up infinite scroll if we have more messages
            if (this.hasMoreMessages) {
                this.setupInfiniteScroll();
            }
            
        } catch (error) {
            console.error('Error in loadMessages:', error);
            this.isLoading = false;
            this.showError('Unable to load messages. Please try again in a moment.');
        }
    }

    setupEventListeners() {
        if (this.searchInput) {
            this.searchInput.addEventListener('input', debounce(() => {
                this.filterAndRenderMessages();
            }, 300));
        }

        document.querySelectorAll('.filter-btn').forEach(button => {
            button.addEventListener('click', () => {
                // Skip if it's the home button
                if (button.classList.contains('home-btn')) return;
                
                document.querySelectorAll('.filter-btn').forEach(btn => 
                    btn.classList.remove('active')
                );
                button.classList.add('active');
                this.currentFilter = button.dataset.filter;
                this.filterAndRenderMessages();
            });
        });
    }

    setupInfiniteScroll() {
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting && this.hasMoreMessages && !this.isLoading) {
                    this.loadMessages();
                }
            },
            { threshold: 0.1 }
        );
        
        // Observe the last message card
        const messageCards = this.messageContainer.querySelectorAll('.message-card');
        if (messageCards.length > 0) {
            observer.observe(messageCards[messageCards.length - 1]);
        }
    }

    filterAndRenderMessages() {
        if (this.isLoading && !this.messages.length) return;

        // Remove any existing loading spinner
        const existingSpinner = this.messageContainer.querySelector('.loading-spinner');
        if (existingSpinner) {
            existingSpinner.remove();
        }

        const searchTerm = (this.searchInput?.value || '').toLowerCase();
        
        this.filteredMessages = [...this.messages];

        if (searchTerm) {
            this.filteredMessages = this.filteredMessages.filter(message => {
                return (
                    message.userName?.toLowerCase().includes(searchTerm) ||
                    message.message?.toLowerCase().includes(searchTerm) ||
                    message.location?.toLowerCase().includes(searchTerm) ||
                    message.treeName?.toLowerCase().includes(searchTerm)
                );
            });
        }

        switch (this.currentFilter) {
            case 'recent':
                const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
                this.filteredMessages = this.filteredMessages.filter(msg => 
                    new Date(msg.timestamp) > dayAgo
                );
                break;
            case 'popular':
                this.filteredMessages.sort((a, b) => (b.rating || 0) - (a.rating || 0));
                break;
        }

        this.renderMessages();
    }

    renderMessages() {
        if (!this.filteredMessages?.length) {
            this.messageContainer.innerHTML = `
                <div class="no-messages">
                    <i class="fas fa-seedling"></i>
                    <p>No messages found. Try adjusting your search.</p>
                </div>
            `;
            return;
        }

        this.messageContainer.innerHTML = this.filteredMessages.map(message => `
            <div class="message-card" data-id="${this.escapeHtml(message.id)}">
                <div class="message-header">
                    <h3>${this.escapeHtml(message.userName)} <span class="location-text">from ${this.escapeHtml(message.location)}</span></h3>
                    <span class="message-date">${this.formatDate(message.timestamp)}</span>
                </div>
                <div class="message-rating">
                    ${'⭐'.repeat(message.rating || 0)}
                </div>
                <p class="message-content">${this.escapeHtml(message.message)}</p>
                <div class="message-footer">
                    <div>
                        <span>🌳 <strong>${this.escapeHtml(message.treeName)}</strong></span>
                        <div class="tree-location">
                            <i class="fas fa-map-marker-alt"></i> ${this.escapeHtml(message.treeLocation)}
                        </div>
                    </div>
                </div>
            </div>
        `).join('');

        // Setup infinite scroll after rendering
        if (this.hasMoreMessages) {
            this.setupInfiniteScroll();
        }
    }

    formatDate(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now - date;
        const minutes = Math.floor(diff / (60 * 1000));
        const hours = Math.floor(diff / (3600 * 1000));
        const days = Math.floor(diff / (86400 * 1000));
        
        // Less than a minute
        if (minutes < 1) {
            return 'Just now';
        }
        // Less than an hour
        if (minutes < 60) {
            return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'} ago`;
        }
        // Less than a day
        if (hours < 24) {
            return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
        }
        // Less than 7 days
        if (days < 7) {
            return `${days} ${days === 1 ? 'day' : 'days'} ago`;
        }
        
        // More than 7 days - show full date
        return date.toLocaleDateString('en-AU', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    }

    escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    showLoadingSpinner() {
        if (!this.messages.length) {
            // Initial load - full screen spinner
            this.messageContainer.innerHTML = `
                <div class="loading-spinner">
                    <i class="fas fa-leaf fa-spin"></i>
                    <p>Loading messages...</p>
                </div>
            `;
        } else {
            // Infinite scroll - append spinner at bottom
            const spinner = document.createElement('div');
            spinner.className = 'loading-spinner';
            spinner.innerHTML = `
                <i class="fas fa-leaf fa-spin"></i>
                <p>Loading more messages...</p>
            `;
            this.messageContainer.appendChild(spinner);
        }
    }

    showNotification(message) {
        const notification = document.createElement('div');
        notification.className = 'notification';
        notification.innerHTML = `
            <i class="fas fa-leaf"></i>
            ${message}
        `;
        document.body.appendChild(notification);
        setTimeout(() => {
            notification.style.opacity = '0';
            setTimeout(() => notification.remove(), 300);
        }, 2700);
    }

    showError(message) {
        this.isLoading = false;
        this.messageContainer.innerHTML = `
            <div class="error-message">
                <i class="fas fa-exclamation-circle"></i>
                <p>${message}</p>
                <button onclick="window.messageBoard.loadMessages()" class="retry-button">
                    <i class="fas fa-sync"></i> Try Again
                </button>
            </div>
        `;
    }

    destroy() {
        this.stopPolling();
        document.removeEventListener('visibilitychange', this.handleVisibilityChange.bind(this));
    }
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

document.addEventListener('DOMContentLoaded', () => {
    // Clean up any existing instance
    if (window.messageBoard) {
        window.messageBoard.destroy();
    }
    window.messageBoard = new TreeMessageBoard();
});
