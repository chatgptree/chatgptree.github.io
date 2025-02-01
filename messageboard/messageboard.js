class TreeMessageBoard {
    constructor() {
        // Pagination properties
        this.pageSize = 20;
        this.lastMessageTimestamp = null;
        this.hasMoreMessages = true;
        this.notificationCooldown = false;
        
        // Existing properties
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
            const year = now.getUTCFullYear();
            const month = now.toLocaleString('default', { 
                month: 'long',
                timeZone: 'UTC'
            }).toLowerCase();
            const day = now.toISOString().split('T')[0];
                
            const url = `https://raw.githubusercontent.com/chatgptree/chatgptree.github.io/main/messages/${year}/${month}/${day}.json`;
                
            const response = await fetch(url, {
                cache: 'no-store'
            });

            if (response.ok) {
                const data = await response.json();
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
                    if (newMessages.length > 0) {
                        const latestMessage = newMessages.reduce((latest, msg) => {
                            const msgTime = new Date(msg.timestamp).getTime();
                            return msgTime > latest ? msgTime : latest;
                        }, 0);
                        this.lastUpdateTime = latestMessage;
                    }
                    this.filterAndRenderMessages();
                    this.showNotification('New messages have arrived! 🌱');
                }
            }
        } catch (error) {
            console.error('Error checking for new messages:', error);
        }
    }

    async loadMessages() {
        try {
            if (!this.hasMoreMessages || this.isLoading) return;
            
            this.showLoadingSpinner();
            
            const date = this.lastMessageTimestamp 
                ? new Date(this.lastMessageTimestamp) 
                : new Date();
                
            const year = date.getUTCFullYear();
            const month = date.toLocaleString('default', { 
                month: 'long',
                timeZone: 'UTC'
            }).toLowerCase();
            const day = date.toISOString().split('T')[0];
            
            const url = `https://raw.githubusercontent.com/chatgptree/chatgptree.github.io/main/messages/${year}/${month}/${day}.json`;
            console.log('Fetching from:', url);
            
            const response = await fetch(url, {
                cache: 'no-store'
            });
            
            if (!response.ok) {
                if (response.status === 404) {
                    // If no messages for this day, try previous day
                    const prevDate = new Date(date);
                    prevDate.setDate(prevDate.getDate() - 1);
                    this.lastMessageTimestamp = prevDate.toISOString();
                    this.loadMessages();
                    return;
                }
                throw new Error(`Failed to fetch messages: ${response.status}`);
            }

            const data = await response.json();
            
            let filteredData = this.lastMessageTimestamp 
                ? data.filter(msg => new Date(msg.timestamp) < new Date(this.lastMessageTimestamp))
                : data;
            
            const newMessages = filteredData.slice(0, this.pageSize);
            
            this.hasMoreMessages = filteredData.length > this.pageSize;
            
            if (newMessages.length > 0) {
                this.lastMessageTimestamp = newMessages[newMessages.length - 1].timestamp;
                this.messages = [...this.messages, ...newMessages];
                this.messages.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
                if (this.messages.length > 0) {
                    const latestMessage = this.messages.reduce((latest, msg) => {
                        const msgTime = new Date(msg.timestamp).getTime();
                        return msgTime > latest ? msgTime : latest;
                    }, 0);
                    this.lastUpdateTime = latestMessage;
                }
            }
            
            this.isLoading = false;
            this.filterAndRenderMessages();
            
            if (this.hasMoreMessages) {
                this.setupInfiniteScroll();
            }
            
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
        if (this.isLoading && !this.messages.length) return;

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
        
        if (minutes < 1) return 'Just now';
        if (minutes < 60) return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'} ago`;
        if (hours < 24) return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
        if (days < 7) return `${days} ${days === 1 ? 'day' : 'days'} ago`;
        
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
            this.messageContainer.innerHTML = `
                <div class="loading-spinner">
                    <i class="fas fa-leaf fa-spin"></i>
                    <p>Loading messages...</p>
                </div>
            `;
        } else {
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
        if (this.notificationCooldown) return;
        this.notificationCooldown = true;

        const existingNotifications = document.querySelectorAll('.notification');
        existingNotifications.forEach(notification => notification.remove());

        const notification = document.createElement('div');
        notification.className = 'notification';
        notification.setAttribute('role', 'alert');
        notification.innerHTML = `
            <i class="fas fa-leaf"></i>
            ${message}
        `;
        document.body.appendChild(notification);

        setTimeout(() => {
            notification.style.opacity = '0';
            setTimeout(() => notification.remove(), 300);
        }, 3000);

        setTimeout(() => {
            this.notificationCooldown = false;
        }, 60000);
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
