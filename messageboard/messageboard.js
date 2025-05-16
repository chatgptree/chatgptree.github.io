class TreeMessageBoard {
    constructor() {
        // Force refresh mechanism - increment when needed
        const CURRENT_VERSION = 10;
        const storedVersion = parseInt(localStorage.getItem('messageBoardVersion')) || 0;
        
        if (storedVersion < CURRENT_VERSION) {
            console.log('Clearing cached data for new version...');
            localStorage.removeItem('lastUpdateTime');
            localStorage.removeItem('lastMessageDate');
            localStorage.setItem('messageBoardVersion', CURRENT_VERSION);
            
            if ('caches' in window) {
                caches.keys().then(names => names.forEach(name => caches.delete(name)));
            }
            
            window.location.reload(true);
            return;
        }
        
        this.messages = [];
        this.filteredMessages = [];
        this.currentFilter = 'all';
        this.isLoading = false;
        this.messageContainer = document.getElementById('messageContainer');
        this.searchInput = document.getElementById('searchInput');
        this.lastUpdateTime = parseInt(localStorage.getItem('lastUpdateTime')) || 0;
        this.loadedDates = new Set();
        this.maxSearchDepth = 90; // 
        this.daysChunk = 3; // Slightly larger chunks for fewer network requests
        this.fetchTimeout = 5000; // 5 second timeout for fetch operations
        
        console.log("Browser timezone:", Intl.DateTimeFormat().resolvedOptions().timeZone);
        
        this.setupEventListeners();
        this.initialize();
    }

    async initialize() {
        try {
            const initPromise = this.loadInitialMessages();
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Loading timed out')), 20000);
            });
            
            await Promise.race([initPromise, timeoutPromise]);
            setInterval(() => this.checkForNewMessages(), 10000); // Check less frequently
        } catch (error) {
            console.error('Failed to initialize:', error);
            this.showError(`Unable to load messages: ${error.message}`);
        }
    }

    // KEY FIX: Always use English locale for month names
    formatDatePath(date) {
        const year = date.getUTCFullYear();
        const month = date.toLocaleString('en-US', { 
            month: 'long', 
            timeZone: 'UTC' 
        }).toLowerCase();
        const dateStr = date.toISOString().split('T')[0];
        
        return `/messages/${year}/${month}/${dateStr}.json`;
    }

    async loadInitialMessages() {
        this.showLoadingSpinner();
        
        // Try to load from saved date first
        const lastMessageDate = localStorage.getItem('lastMessageDate');
        if (lastMessageDate) {
            try {
                const date = new Date(lastMessageDate);
                if (await this.loadDateMessages(date)) {
                    this.filterAndRender();
                    return;
                }
            } catch (error) {
                console.error("Error loading last message date:", error);
            }
        }
        
        // Check a focused range around today first
        const today = new Date();
        const initialWindow = 3; // Check 3 days in each direction
        let messagesFound = false;
        
        for (let offset = -initialWindow; offset <= initialWindow; offset++) {
            const date = new Date();
            date.setUTCDate(date.getUTCDate() + offset);
            
            if (await this.loadDateMessages(date)) {
                messagesFound = true;
                localStorage.setItem('lastMessageDate', date.toISOString());
                
                // Update UI as soon as we find messages
                if (this.messages.length > 0) {
                    this.filterAndRender();
                }
            }
        }
        
        if (this.messages.length > 0) {
            return;
        }
        
        // If no messages found yet, search older dates
        let startDay = initialWindow + 1;
        const maxDays = this.maxSearchDepth;
        
        while (!messagesFound && startDay < maxDays) {
            // Update loading message
            this.messageContainer.innerHTML = `
                <div class="loading-spinner">
                    <i class="fas fa-leaf fa-spin"></i>
                    <p>Searching older messages... (${startDay} days back)</p>
                </div>`;
            
            for (let i = 0; i < this.daysChunk; i++) {
                const date = new Date();
                date.setUTCDate(date.getUTCDate() - (startDay + i));
                
                if (await this.loadDateMessages(date)) {
                    messagesFound = true;
                    localStorage.setItem('lastMessageDate', date.toISOString());
                    break;
                }
            }
            
            startDay += this.daysChunk;
            
            // Break early if any messages found
            if (messagesFound) {
                break;
            }
        }
        
        this.filterAndRender();
    }

    async loadDateMessages(date) {
        const dateStr = date.toISOString().split('T')[0];
        if (this.loadedDates.has(dateStr)) {
            return false;
        }

        const url = this.formatDatePath(date);
        
        try {
            // Use AbortController for timeout
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), this.fetchTimeout);
            
            const response = await fetch(url, { 
                cache: 'no-store',
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);

            if (!response.ok) {
                this.loadedDates.add(dateStr);
                return false;
            }

            const newMessages = await response.json();
            
            if (!Array.isArray(newMessages) || newMessages.length === 0) {
                this.loadedDates.add(dateStr);
                return false;
            }
            
            const existingIds = new Set(this.messages.map(m => m.id));
            const uniqueNewMessages = newMessages.filter(m => !existingIds.has(m.id));
            
            if (uniqueNewMessages.length > 0) {
                this.messages = [...this.messages, ...uniqueNewMessages]
                    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
                this.loadedDates.add(dateStr);
                return true;
            }
            
            this.loadedDates.add(dateStr);
            return false;

        } catch (error) {
            if (error.name === 'AbortError') {
                console.log(`Request timeout for ${dateStr}`);
            } else {
                console.error(`Error loading messages for ${dateStr}:`, error);
            }
            
            this.loadedDates.add(dateStr);
            return false;
        }
    }

async loadMoreMessages() {
    if (this.isLoading) return;
    
    this.isLoading = true;
    const loadMoreBtn = this.messageContainer.querySelector('.load-more-btn');
    if (loadMoreBtn) {
        loadMoreBtn.innerHTML = `<i class="fas fa-leaf fa-spin"></i> Loading...`;
        loadMoreBtn.disabled = true;
    }

    try {
        // Get the oldest message currently displayed
        const oldestMessage = this.messages[this.messages.length - 1];
        if (!oldestMessage) {
            return;
        }

        // Parse the timestamp of the oldest message
        const oldestDate = new Date(oldestMessage.timestamp);
        
        // Calculate the UTC day of the oldest message
        const oldestUTCDay = new Date(Date.UTC(
            oldestDate.getUTCFullYear(),
            oldestDate.getUTCMonth(),
            oldestDate.getUTCDate()
        ));
        
        console.log('Looking for messages before:', oldestUTCDay.toISOString());
        
        // Variables for our search state
        let currentSearchDate = new Date(oldestUTCDay);
        let daysSearched = 0;
        let messagesFound = false;
        let searchPhase = 'daily'; // We'll start searching day by day
        
        // We'll keep searching until we find messages or hit a very distant date
        // 5 years (1825 days) is effectively unlimited for most applications
        while (!messagesFound && daysSearched < 1825) {
            // Move to the next date to search
            currentSearchDate.setUTCDate(currentSearchDate.getUTCDate() - 1);
            daysSearched++;
            
            // Update the button to show progress
            if (loadMoreBtn) {
                loadMoreBtn.innerHTML = `<i class="fas fa-leaf fa-spin"></i> Looking ${daysSearched} days back...`;
            }
            
            // Try to load messages for this date
            const foundMessages = await this.loadDateMessages(currentSearchDate);
            if (foundMessages) {
                console.log(`Found messages ${daysSearched} days before oldest message`);
                messagesFound = true;
                break;
            }
            
            // After 30 days of daily checking, switch to checking weekly
            if (daysSearched === 30 && searchPhase === 'daily') {
                console.log('Switching to weekly search pattern');
                searchPhase = 'weekly';
            }
            
            // After 90 days of checking, switch to checking monthly
            if (daysSearched === 90 && searchPhase === 'weekly') {
                console.log('Switching to monthly search pattern');
                searchPhase = 'monthly';
            }
            
            // Skip days based on search phase to speed up distant searches
            if (searchPhase === 'weekly' && daysSearched >= 30) {
                // Skip ahead 6 days (checking every 7th day)
                currentSearchDate.setUTCDate(currentSearchDate.getUTCDate() - 6);
                daysSearched += 6;
            } else if (searchPhase === 'monthly' && daysSearched >= 90) {
                // Skip ahead 29 days (checking approximately monthly)
                currentSearchDate.setUTCDate(currentSearchDate.getUTCDate() - 29);
                daysSearched += 29;
            }
            
            // Every 50 checks, update the UI with any messages found so far
            if (daysSearched % 50 === 0 && this.messages.length > 0) {
                this.filterAndRender();
            }
        }
        
        if (!messagesFound) {
            console.log('No older messages found after extensive search');
            this.showNotification('No older messages found');
        }
        
        // Update the UI
        this.filterAndRender();
        
    } catch (error) {
        console.error('Error loading more messages:', error);
        
        // Show error in the UI
        if (loadMoreBtn) {
            loadMoreBtn.innerHTML = 'Error loading messages';
            setTimeout(() => {
                loadMoreBtn.innerHTML = 'Load More Messages';
            }, 3000);
        }
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
            // Check just today and yesterday
            const now = new Date();
            const dates = [
                new Date(now),
                new Date(new Date().setUTCDate(now.getUTCDate() - 1))
            ];
            
            let newMessages = false;
            for (const date of dates) {
                if (await this.loadDateMessages(date)) {
                    newMessages = true;
                }
            }
            
            if (newMessages && this.messages.length > 0) {
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
                    return ratingB === ratingA ? 
                        new Date(b.timestamp) - new Date(a.timestamp) : 
                        ratingB - ratingA;
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
                    <p>No messages found. <button onclick="window.messageBoard.loadInitialMessages()">Try Again</button></p>
                    <p class="timezone-info">Your timezone: ${Intl.DateTimeFormat().resolvedOptions().timeZone}</p>
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
        try {
            const date = new Date(timestamp);
            const now = new Date();
            const nowUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
            const dateUTC = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
            
            const diff = nowUTC - dateUTC;
            const days = Math.floor(diff / (1000 * 60 * 60 * 24));
            
            if (days < 1) return 'Today';
            if (days === 1) return 'Yesterday';
            if (days < 7) return `${days} days ago`;
            
            // Use English format for consistency
            return date.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric'
            });
        } catch (error) {
            return "Unknown date";
        }
    }

    showLoadingSpinner() {
        if (!this.messages.length) {
            this.messageContainer.innerHTML = `
                <div class="loading-spinner">
                    <i class="fas fa-leaf fa-spin"></i>
                    <p>Loading messages...</p>
                    <p class="timezone-info">Your timezone: ${Intl.DateTimeFormat().resolvedOptions().timeZone}</p>
                </div>`;
        }
    }

    showError(message) {
        this.messageContainer.innerHTML = `
            <div class="error-message">
                <p>${message}</p>
                <button onclick="window.messageBoard.loadInitialMessages()">Retry</button>
                <p class="timezone-info">Your timezone: ${Intl.DateTimeFormat().resolvedOptions().timeZone}</p>
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
