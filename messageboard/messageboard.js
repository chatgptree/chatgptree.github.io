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
        this.maxSearchDepth = 90; // Maximum days to look back
        this.daysChunk = 2; // Reduced from 7 to 2
        
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
        // Always use UTC for consistent file paths regardless of user's time zone
        const year = date.getUTCFullYear();
        const month = date.toLocaleString('default', { 
            month: 'long', 
            timeZone: 'UTC' 
        }).toLowerCase();
        const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD in UTC
        
        return `/messages/${year}/${month}/${dateStr}.json`;
    }

    async loadInitialMessages() {
        // Start with UTC today to ensure consistency across all time zones
        const today = new Date();
        today.setUTCHours(0, 0, 0, 0); // Reset to start of day in UTC
        
        this.showLoadingSpinner();
        console.log('Starting initial load for UTC date:', today.toISOString().split('T')[0]);
        
        let startDay = 0;
        let messagesFound = false;
        
        while (!messagesFound && startDay < this.maxSearchDepth) {
            // Load next chunk of days
            for (let i = 0; i < this.daysChunk; i++) {
                // Create date in UTC to avoid time zone issues
                const date = new Date(today);
                date.setUTCDate(date.getUTCDate() - (startDay + i));
                
                const foundMessages = await this.loadDateMessages(date);
                
                // Check if we found any messages
                if (foundMessages) {
                    console.log(`Found messages for UTC date: ${date.toISOString().split('T')[0]}`);
                    messagesFound = true;
                    break;
                }
            }
            
            startDay += this.daysChunk;
            
            // Update loading message with search progress
            if (!messagesFound) {
                this.messageContainer.innerHTML = `
                    <div class="loading-spinner">
                        <i class="fas fa-leaf fa-spin"></i>
                        <p>Searching older messages... (${startDay} days back)</p>
                    </div>`;
            }
        }
        
        // Also add fallback for maximum reliability
        if (!messagesFound || this.messages.length === 0) {
            console.log('No messages found in date search, trying known dates');
            
            // Try a specific known date that definitely has messages
            // Replace these with dates you know have messages
            const knownDates = [
                new Date('2025-03-15T00:00:00Z'), 
                new Date('2025-03-01T00:00:00Z'),
                new Date('2025-02-15T00:00:00Z')
            ];
            
            for (const date of knownDates) {
                console.log(`Trying fallback date: ${date.toISOString().split('T')[0]}`);
                await this.loadDateMessages(date);
                if (this.messages.length > 0) {
                    messagesFound = true;
                    break;
                }
            }
        }
        
        console.log(`Total messages loaded: ${this.messages.length}`);
        this.filterAndRender();
    }

    async loadDateMessages(date) {
        const dateStr = date.toISOString().split('T')[0];
        if (this.loadedDates.has(dateStr)) {
            return false;
        }

        const url = this.formatDatePath(date);
        console.log('Loading messages from:', url);

        try {
            const response = await fetch(url, { 
                cache: 'no-store'
            });

            if (!response.ok) {
                console.log(`No messages found for ${dateStr} (${response.status})`);
                this.loadedDates.add(dateStr);
                return false;
            }

            const newMessages = await response.json();
            console.log(`Loaded ${newMessages.length} messages for ${dateStr}`);
            
            if (!Array.isArray(newMessages) || newMessages.length === 0) {
                console.log(`No messages in array for ${dateStr}`);
                this.loadedDates.add(dateStr);
                return false;
            }
            
            const existingIds = new Set(this.messages.map(m => m.id));
            const uniqueNewMessages = newMessages.filter(m => !existingIds.has(m.id));
            
            if (uniqueNewMessages.length > 0) {
                console.log(`Adding ${uniqueNewMessages.length} new messages from ${dateStr}`);
                this.messages = [...this.messages, ...uniqueNewMessages]
                    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
                this.loadedDates.add(dateStr);
                return true;
            }
            
            this.loadedDates.add(dateStr);
            return newMessages.length > 0; // Return true if there were messages, even if we had them already

        } catch (error) {
            console.error(`Error loading messages for ${dateStr}:`, error);
            return false;
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
                // Create date in UTC to avoid time zone issues
                const oldestDate = new Date(oldestMessage.timestamp);
                console.log('Loading more messages before UTC date:', oldestDate.toISOString());
                
                let messagesFound = false;
                let daysSearched = 0;
                const maxDaysToSearch = this.maxSearchDepth; // Use the same search depth
                
                while (!messagesFound && daysSearched < maxDaysToSearch) {
                    for (let i = 1; i <= this.daysChunk; i++) {
                        const nextDate = new Date(oldestDate);
                        nextDate.setUTCDate(nextDate.getUTCDate() - (daysSearched + i));
                        const foundMessages = await this.loadDateMessages(nextDate);
                        
                        if (foundMessages) {
                            messagesFound = true;
                            break;
                        }
                    }
                    daysSearched += this.daysChunk;
                    
                    if (!messagesFound && loadMoreBtn) {
                        loadMoreBtn.innerHTML = `<i class="fas fa-leaf fa-spin"></i> Searching older messages... (${daysSearched} days back)`;
                    }
                }
            }
            
            console.log('Rendering updated messages...');
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
            // Use UTC date for consistency
            const today = new Date(now);
            today.setUTCHours(0, 0, 0, 0);
            await this.loadDateMessages(today);
            
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
        console.log(`Rendering ${messages?.length || 0} messages`);
        
        if (!messages?.length) {
            this.messageContainer.innerHTML = `
                <div class="no-messages">
                    <i class="fas fa-seedling"></i>
                    <p>No messages found in the last ${this.maxSearchDepth} days.</p>
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
