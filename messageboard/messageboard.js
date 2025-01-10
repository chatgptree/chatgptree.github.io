class TreeMessageBoard {
    constructor() {
        this.messages = [];
        this.filteredMessages = [];
        this.currentFilter = 'all';
        this.isLoading = true;
        this.lastUpdateTime = 0;
        this.pollingInterval = 5000; // 5 seconds
        
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
        if (this.pollingTimer) {
            clearInterval(this.pollingTimer);
        }
        
        // Set up new polling interval
        this.pollingTimer = setInterval(async () => {
            await this.checkForNewMessages();
        }, this.pollingInterval);

        // Add visibility change handling to pause/resume polling
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                clearInterval(this.pollingTimer);
            } else {
                this.startPolling();
                this.checkForNewMessages(); // Immediate check when tab becomes visible
            }
        });
    }

    async checkForNewMessages() {
        try {
            const now = new Date();
            const year = now.getFullYear();
            const currentMonth = now.toLocaleString('default', { month: 'long' }).toLowerCase();
            
            const url = `https://raw.githubusercontent.com/chatgptree/chatgptree.github.io/main/messages/${year}/${currentMonth}.json`;
            
            const response = await fetch(url, {
                cache: 'no-store' // Ensure we're not getting cached responses
            });

            if (response.ok) {
                const data = await response.json();
                
                // Check if there are any new or updated messages
                const hasNewMessages = data.some(message => {
                    const messageTime = new Date(message.timestamp).getTime();
                    return messageTime > this.lastUpdateTime;
                });

                if (hasNewMessages) {
                    console.log(`[${new Date().toISOString()}] New messages found, updating...`);
                    this.messages = data;
                    this.messages.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
                    this.lastUpdateTime = Date.now();
                    this.filterAndRenderMessages();
                    this.showNotification('New messages have arrived! 🌱');
                } else {
                    console.log(`[${new Date().toISOString()}] No new messages found`);
                }
            }
        } catch (error) {
            console.error('Error checking for new messages:', error);
        }
    }

    async loadMessages() {
        try {
            this.showLoadingSpinner();
            
            const now = new Date();
            const year = now.getFullYear();
            const currentMonth = now.toLocaleString('default', { month: 'long' }).toLowerCase();
            
            const url = `https://raw.githubusercontent.com/chatgptree/chatgptree.github.io/main/messages/${year}/${currentMonth}.json`;
            console.log('Fetching from:', url);
            
            const response = await fetch(url, {
                cache: 'no-store' // Ensure we're not getting cached responses
            });
            
            if (!response.ok) {
                throw new Error(`Failed to fetch messages: ${response.status}`);
            }

            const data = await response.json();
            console.log('Received data:', data);
            
            this.messages = data;
            this.messages.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
            this.lastUpdateTime = Date.now();
            
            this.isLoading = false;
            this.filterAndRenderMessages();
            
        } catch (error) {
            console.error('Error in loadMessages:', error);
            this.isLoading = false;
            this.showError('Unable to load messages. Please try again later.');
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
                document.querySelectorAll('.filter-btn').forEach(btn => 
                    btn.classList.remove('active')
                );
                button.classList.add('active');
                this.currentFilter = button.dataset.filter;
                this.filterAndRenderMessages();
            });
        });
    }

    filterAndRenderMessages() {
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
        if (this.isLoading) return;

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
    }

    formatDate(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now - date;
        
        if (diff < 24 * 60 * 60 * 1000) {
            const hours = Math.floor(diff / (60 * 60 * 1000));
            if (hours < 1) {
                const minutes = Math.floor(diff / (60 * 1000));
                return `${minutes} minutes ago`;
            }
            return `${hours} hours ago`;
        }
        
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
        this.isLoading = true;
        this.messageContainer.innerHTML = `
            <div class="loading-spinner">
                <i class="fas fa-leaf fa-spin"></i>
                <p>Loading messages...</p>
            </div>
        `;
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
                    <i class="fas fa-sync"></i> Retry
                </button>
            </div>
        `;
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
    window.messageBoard = new TreeMessageBoard();
});
