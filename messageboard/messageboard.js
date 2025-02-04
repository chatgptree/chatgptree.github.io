class TreeMessageBoard {
    constructor() {
        this.messages = [];
        this.filteredMessages = [];
        this.currentFilter = 'all';
        this.isLoading = false;
        this.messageContainer = document.getElementById('messageContainer');
        this.searchInput = document.getElementById('searchInput');
        this.lastCheckedDate = null;
        this.lastUpdateTime = parseInt(localStorage.getItem('lastUpdateTime')) || 0;
        this.loadedDates = new Set();
        
        this.setupEventListeners();
        this.initialize();
    }

    async initialize() {
        try {
            await this.loadInitialMessages();
            setInterval(() => this.checkForNewMessages(), 5000);
        } catch (error) {
            console.error('Failed to initialize:', error);
            this.showError('Unable to load messages. Please try again.');
        }
    }

    formatDatePath(date) {
        const year = date.getUTCFullYear();
        const month = date.toLocaleString('default', { 
            month: 'long', 
            timeZone: 'UTC' 
        }).toLowerCase();
        const dateStr = date.toISOString().split('T')[0];
        
        return `/messages/${year}/${month}/${dateStr}.json`;
    }

    async loadInitialMessages() {
        const today = new Date();
        this.showLoadingSpinner();
        
        console.log('Starting initial load for date:', today);
        
        // Load last 7 days
        for (let i = 0; i < 2; i++) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);
            await this.loadDateMessages(date);
        }
        
        this.filterAndRender();
    }

    async loadDateMessages(date) {
        const dateStr = date.toISOString().split('T')[0];
        if (this.loadedDates.has(dateStr)) {
            return;
        }

        const url = this.formatDatePath(date);
        console.log('Loading messages from:', url);

        try {
            const response = await fetch(url, { 
                cache: 'no-store'
            });

            if (response.ok) {
                const newMessages = await response.json();
                console.log(`Loaded ${newMessages.length} messages for ${dateStr}`);
                
                const existingIds = new Set(this.messages.map(m => m.id));
                const uniqueNewMessages = newMessages.filter(m => !existingIds.has(m.id));
                
                if (uniqueNewMessages.length > 0) {
                    this.messages = [...this.messages, ...uniqueNewMessages]
                        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
                }
                this.loadedDates.add(dateStr);
            }
        } catch (error) {
            console.error(`Error loading messages for ${dateStr}:`, error);
        }
    }

    async loadMoreMessages() {
        if (this.isLoading) return;
        
        this.isLoading = true;
        const loadMoreBtn = this.messageContainer.querySelector('.load-more-btn');
        
        try {
            if (loadMoreBtn) {
                loadMoreBtn.innerHTML = `<i class="fas fa-leaf fa-spin"></i> Loading...`;
                loadMoreBtn.disabled = true;
            }

            const oldestMessage = this.messages[this.messages.length - 1];
            if (oldestMessage) {
                const oldestDate = new Date(oldestMessage.timestamp);
                console.log('Loading more messages before:', oldestDate);
                
                for (let i = 1; i <= 7; i++) {
                    const nextDate = new Date(oldestDate);
                    nextDate.setDate(nextDate.getDate() - i);
                    await this.loadDateMessages(nextDate);
                }
            }
            
            this.filterAndRender();
            
        } catch (error) {
            console.error('Error loading more messages:', error);
        } finally {
            this.isLoading = false;
            if (loadMoreBtn) {
                loadMoreBtn.innerHTML = 'Load More Messages';
                loadMoreBtn.disabled = false;
            }
        }
    }

    async checkForNewMessages() {
        try {
            const now = new Date();
            await this.loadDateMessages(now);
            
            if (this.messages.length > 0) {
                const latestMessageTime = Math.max(
                    ...this.messages.map(m => new Date(m.timestamp).getTime())
                );
                if (latestMessageTime > this.lastUpdateTime) {
                    this.lastUpdateTime = latestMessageTime;
                    localStorage.setItem('lastUpdateTime', latestMessageTime.toString());
                    this.filterAndRender();
                    this.showNotification('New messages have arrived! 🌱');
                }
            }
        } catch (error) {
            console.error('Error checking new messages:', error);
        }
    }

    filterAndRender() {
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
                this.filteredMessages.sort((a, b) => 
                    new Date(b.timestamp) - new Date(a.timestamp)
                );
                break;
            case 'popular':
                this.filteredMessages.sort((a, b) => {
                    const ratingA = a.rating || 0;
                    const ratingB = b.rating || 0;
                    if (ratingB === ratingA) {
                        return new Date(b.timestamp) - new Date(a.timestamp);
                    }
                    return ratingB - ratingA;
                });
                break;
            default:
                this.filteredMessages.sort((a, b) => 
                    new Date(b.timestamp) - new Date(a.timestamp)
                );
        }

        this.renderMessages(this.filteredMessages);
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

        const fragment = document.createDocumentFragment();
        
        messages.forEach(message => {
            const messageDiv = document.createElement('div');
            messageDiv.className = 'message-card';
            messageDiv.innerHTML = this.createMessageHTML(message);
            fragment.appendChild(messageDiv);
        });

        this.messageContainer.innerHTML = '';
        this.messageContainer.appendChild(fragment);

        const loadMoreButton = document.createElement('button');
        loadMoreButton.className = 'load-more-btn';
        loadMoreButton.innerHTML = 'Load More Messages';
        loadMoreButton.onclick = () => this.loadMoreMessages();
        this.messageContainer.appendChild(loadMoreButton);
    }

    createMessageHTML(message) {
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
        let searchTimeout;
        this.searchInput?.addEventListener('input', () => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => this.filterAndRender(), 300);
        });

        document.querySelectorAll('.filter-btn').forEach(button => {
            button.addEventListener('click', () => {
                document.querySelectorAll('.filter-btn').forEach(btn => 
                    btn.classList.remove('active')
                );
                button.classList.add('active');
                this.currentFilter = button.dataset.filter;
                this.filterAndRender();
            });
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.messageBoard = new TreeMessageBoard();
});
