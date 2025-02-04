class TreeMessageBoard {
    constructor() {
        // Minimal core properties
        this.messages = [];
        this.filteredMessages = [];  // Added back for filtering
        this.currentFilter = 'all';  // Added back for filtering
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
            // Check for new messages every 5 seconds
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
        
        // Load last 7 days
        for (let i = 0; i < 2; i++) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);
            console.log(`Loading day ${i}:`, date.toISOString().split('T')[0]);
            await this.loadDateMessages(date);
        }
        
        console.log('Initial load complete. Messages:', this.messages.length);
        
        this.filterAndRender();
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

    async loadMoreMessages() {
        if (this.isLoading) return;

        const loadMoreBtn = this.messageContainer.querySelector('.load-more-btn');
        if (loadMoreBtn) {
            loadMoreBtn.innerHTML = `
                <i class="fas fa-leaf fa-spin"></i>
                Loading...
            `;
            loadMoreBtn.disabled = true;
        }

        try {
            // Get the oldest loaded date
            const oldestMessage = this.messages[this.messages.length - 1];
            if (oldestMessage) {
                const oldestDate = new Date(oldestMessage.timestamp);
                
                // Load next 7 days before the oldest message
                for (let i = 1; i <= 7; i++) {
                    const nextDate = new Date(oldestDate);
                    nextDate.setDate(nextDate.getDate() - i);
                    await this.loadDateMessages(nextDate);
                }
                
                // Re-render with new messages
                this.filterAndRender();
            }
        } catch (error) {
            console.error('Error loading more messages:', error);
            if (loadMoreBtn) {
                loadMoreBtn.innerHTML = `
                    <i class="fas fa-leaf"></i>
                    Load More Messages
                    <i class="fas fa-leaf"></i>
                `;
                loadMoreBtn.disabled = false;
            }
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
        if (this.isLoading && !this.messages.length) return;

        // Remove any existing loading spinner
        const existingSpinner = this.messageContainer.querySelector('.loading-spinner');
        if (existingSpinner) {
            existingSpinner.remove();
        }

        const searchTerm = (this.searchInput?.value || '').toLowerCase();
        
        // Start with all messages
        this.filteredMessages = [...this.messages];

        // Apply search filter if there's a search term
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

        // Apply sorting based on current filter
        switch (this.currentFilter) {
            case 'recent':
                // Sort by timestamp, newest first
                this.filteredMessages.sort((a, b) => 
                    new Date(b.timestamp) - new Date(a.timestamp)
                );
                break;
            case 'popular':
                // Sort by rating (handle undefined ratings as 0)
                this.filteredMessages.sort((a, b) => {
                    const ratingA = a.rating || 0;
                    const ratingB = b.rating || 0;
                    if (ratingB === ratingA) {
                        // If ratings are equal, sort by timestamp
                        return new Date(b.timestamp) - new Date(a.timestamp);
                    }
                    return ratingB - ratingA;
                });
                break;
            default: // 'all'
                // Default chronological sort
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

        // Add "Load More" button
        const loadMoreButton = document.createElement('button');
        loadMoreButton.className = 'load-more-btn';
        loadMoreButton.innerHTML = `
            <i class="fas fa-leaf"></i>
            Load More Messages
            <i class="fas fa-leaf"></i>
        `;
        loadMoreButton.onclick = () => this.loadMoreMessages();
        this.messageContainer.appendChild(loadMoreButton);

        // Setup infinite scroll
        this.setupInfiniteScroll();
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
        // Search input handling
        let searchTimeout;
        this.searchInput?.addEventListener('input', () => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => this.filterAndRender(), 300);
        });

        // Filter buttons handling
        document.querySelectorAll('.filter-btn').forEach(button => {
            button.addEventListener('click', () => {
                // Remove active class from all buttons
                document.querySelectorAll('.filter-btn').forEach(btn => 
                    btn.classList.remove('active')
                );
                // Add active class to clicked button
                button.classList.add('active');
                // Update current filter and re-render
                this.currentFilter = button.dataset.filter;
                this.filterAndRender();
            });
        });
    }
}

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', () => {
    window.messageBoard = new TreeMessageBoard();
});