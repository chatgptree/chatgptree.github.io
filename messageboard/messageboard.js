class TreeMessageBoard {
    constructor() {
        // Force refresh mechanism - increment the version when you want to force a refresh
        const CURRENT_VERSION = 5; // Increment again to force refresh
        const storedVersion = parseInt(localStorage.getItem('messageBoardVersion')) || 0;
        
        if (storedVersion < CURRENT_VERSION) {
            // Clear all relevant cached data
            console.log('Clearing cached data for new version...');
            
            // Clear message board specific localStorage items
            localStorage.removeItem('lastUpdateTime');
            localStorage.removeItem('messageBoardDiagnostics');
            localStorage.setItem('messageBoardVersion', CURRENT_VERSION);
            
            // Clear the cache for service workers if you have any
            if ('caches' in window) {
                caches.keys().then(names => {
                    names.forEach(name => {
                        caches.delete(name);
                    });
                });
            }
            
            // Force reload the page to ensure fresh resources
            window.location.reload(true);
            return; // Stop constructor execution as page will reload
        }
        
        // Original constructor code continues here...
        this.messages = [];
        this.filteredMessages = [];
        this.currentFilter = 'all';
        this.isLoading = false;
        this.messageContainer = document.getElementById('messageContainer');
        this.searchInput = document.getElementById('searchInput');
        this.lastCheckedDate = null;
        this.lastUpdateTime = parseInt(localStorage.getItem('lastUpdateTime')) || 0;
        this.loadedDates = new Set();
        this.maxSearchDepth = 30; // Reduced to 30 days max to avoid too much searching
        this.daysChunk = 2; // Reduced from 7 to 2
        
        // Debug information to help diagnose timezone issues
        console.log("Browser time:", new Date().toString());
        console.log("Browser timezone:", Intl.DateTimeFormat().resolvedOptions().timeZone);
        console.log("UTC time:", new Date().toUTCString());
        
        this.setupEventListeners();
        this.initialize();
    }

    async initialize() {
        try {
            // Add a timeout to the initialization process
            const initPromise = this.loadInitialMessages();
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Loading timed out')), 30000); // 30 second timeout
            });
            
            await Promise.race([initPromise, timeoutPromise]);
            setInterval(() => this.checkForNewMessages(), 5000);
        } catch (error) {
            console.error('Failed to initialize:', error);
            this.showError(`Unable to load messages: ${error.message}. Please try again.`);
        }
    }

    formatDatePath(date) {
        // Key change: Use UTC consistently for all date path formatting
        const year = date.getUTCFullYear();
        const month = date.toLocaleString('default', { 
            month: 'long', 
            timeZone: 'UTC' 
        }).toLowerCase();
        const dateStr = date.toISOString().split('T')[0];
        
        return `/messages/${year}/${month}/${dateStr}.json`;
    }

    async loadInitialMessages() {
        this.showLoadingSpinner();
        let loadStart = Date.now();
        
        // MUCH wider initial check - look at today, a week in the past, and a few days in the future
        // This should catch any messages regardless of timezone differences
        const today = new Date();
        console.log("Starting load with browser date:", today.toString());
        
        // First try to load the most recent day we know has messages
        const lastMessageDate = localStorage.getItem('lastMessageDate');
        if (lastMessageDate) {
            try {
                const date = new Date(lastMessageDate);
                console.log("Trying last known message date:", date.toISOString());
                const foundMessages = await this.loadDateMessages(date);
                if (foundMessages) {
                    console.log("Found messages on last known date");
                    this.filterAndRender();
                    return;
                }
            } catch (error) {
                console.error("Error loading last message date:", error);
            }
        }
        
        // Immediately try to load exact message list if available
        try {
            const listLoaded = await this.tryLoadMessageList();
            if (listLoaded && this.messages.length > 0) {
                console.log("Successfully loaded messages from index list");
                this.filterAndRender();
                return;
            }
        } catch (error) {
            console.error("Error loading message list:", error);
        }
        
        // If no message list or no messages found, try wide date range search
        // EXPANDED: Check a much wider range for international users
        const initialWindow = 5; // Reduced to 5 days in each direction
        let messagesFound = false;
        
        // First check today and a wide range around it to handle international timezones
        console.log("Checking wide range of dates around today");
        for (let offset = -initialWindow; offset <= initialWindow; offset++) {
            // Check if we've been searching too long
            if (Date.now() - loadStart > 20000) { // 20 seconds max
                console.log("Search taking too long, stopping");
                break;
            }
            
            const date = new Date(today);
            date.setUTCDate(date.getUTCDate() + offset);
            
            console.log(`Checking date with offset ${offset}:`, date.toISOString().split('T')[0]);
            try {
                const foundMessages = await this.loadDateMessages(date);
                if (foundMessages) {
                    messagesFound = true;
                    
                    // Store this date as the last known good date
                    localStorage.setItem('lastMessageDate', date.toISOString());
                    
                    // Update UI as soon as we find messages
                    console.log("Found messages, updating UI");
                    this.filterAndRender();
                }
            } catch (error) {
                console.error(`Error checking date ${date.toISOString()}:`, error);
            }
        }
        
        console.log(`Messages found in wide search: ${messagesFound}`);
        console.log(`Total messages loaded: ${this.messages.length}`);
        
        if (this.messages.length > 0) {
            this.filterAndRender();
            return;
        }
        
        // If STILL no messages found, try a more limited search of older dates
        console.log("No messages found in wide search, trying older dates");
        let startDay = initialWindow + 1; // Start after our initial window
        let deepSearchEnd = Math.min(startDay + 10, this.maxSearchDepth); // Search only 10 more days max
        
        while (!messagesFound && startDay < deepSearchEnd) {
            // Check if we've been searching too long
            if (Date.now() - loadStart > 25000) { // 25 seconds max
                console.log("Deep search taking too long, stopping");
                break;
            }
            
            // Update loading message with search progress
            this.messageContainer.innerHTML = `
                <div class="loading-spinner">
                    <i class="fas fa-leaf fa-spin"></i>
                    <p>Searching older messages... (${startDay} days back)</p>
                </div>`;
            
            // Load next chunk of days
            let chunkMessagesFound = false;
            for (let i = 0; i < this.daysChunk; i++) {
                const date = new Date(today);
                date.setUTCDate(date.getUTCDate() - (startDay + i));
                
                try {
                    const foundMessages = await this.loadDateMessages(date);
                    if (foundMessages) {
                        chunkMessagesFound = true;
                        messagesFound = true;
                        
                        // Store this date as the last known good date
                        localStorage.setItem('lastMessageDate', date.toISOString());
                    }
                } catch (error) {
                    console.error(`Error loading date ${date.toISOString()}:`, error);
                }
            }
            
            startDay += this.daysChunk;
            
            // If we found messages in this chunk, update the UI
            if (chunkMessagesFound) {
                console.log("Found messages in deep search, updating UI");
                this.filterAndRender();
            }
        }
        
        // Final render after all searches complete
        console.log(`Final message count: ${this.messages.length}`);
        this.filterAndRender();
    }
    
    // NEW METHOD: Try to load a master message list if available
    async tryLoadMessageList() {
        try {
            // Try to load a master list of all recent messages if available
            const indexUrl = '/messages/recent.json';
            console.log('Trying to load master message list from:', indexUrl);
            
            const timeoutController = new AbortController();
            const timeoutId = setTimeout(() => timeoutController.abort(), 5000); // 5 second timeout
            
            const response = await fetch(indexUrl, { 
                cache: 'no-store',
                signal: timeoutController.signal
            });
            
            clearTimeout(timeoutId);

            if (!response.ok) {
                console.log(`No master message list found (${response.status})`);
                return false;
            }

            const allMessages = await response.json();
            console.log(`Loaded ${allMessages.length} messages from master list`);
            
            if (!Array.isArray(allMessages)) {
                console.error(`Invalid message list format:`, allMessages);
                return false;
            }
            
            if (allMessages.length > 0) {
                this.messages = allMessages.sort((a, b) => 
                    new Date(b.timestamp) - new Date(a.timestamp)
                );
                return true;
            }
            
            return false;
        } catch (error) {
            // Check if this was an abort error and handle it gracefully
            if (error.name === 'AbortError') {
                console.log('Master message list request timed out');
            } else {
                console.error(`Error loading master message list:`, error);
            }
            return false;
        }
    }

    async loadDateMessages(date) {
        const dateStr = date.toISOString().split('T')[0];
        if (this.loadedDates.has(dateStr)) {
            return false;
        }

        const url = this.formatDatePath(date);
        console.log('Loading messages from:', url);

        try {
            // Create an AbortController for timeout handling
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
            
            const response = await fetch(url, { 
                cache: 'no-store',
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);

            if (!response.ok) {
                console.log(`No messages found for ${dateStr} (${response.status})`);
                this.loadedDates.add(dateStr);
                return false;
            }

            const newMessages = await response.json();
            console.log(`Loaded ${newMessages.length} messages for ${dateStr}`);
            
            if (!Array.isArray(newMessages)) {
                console.error(`Invalid messages format for ${dateStr}:`, newMessages);
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
            return false;

        } catch (error) {
            // Check if this was an abort error (timeout)
            if (error.name === 'AbortError') {
                console.log(`Request timeout for ${dateStr}`);
            } else {
                console.error(`Error loading messages for ${dateStr}:`, error);
            }
            
            // Still mark this date as processed to avoid retrying
            this.loadedDates.add(dateStr);
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
                const oldestDate = new Date(oldestMessage.timestamp);
                console.log('Loading more messages before:', oldestDate);
                
                let messagesFound = false;
                let daysSearched = 0;
                const maxDaysToSearch = 10; // Reduced from 21 to 10 days
                let startTime = Date.now();
                
                while (!messagesFound && daysSearched < maxDaysToSearch) {
                    // Add timeout check
                    if (Date.now() - startTime > 15000) { // 15 second timeout
                        console.log("Load more operation timed out");
                        break;
                    }
                    
                    for (let i = 1; i <= this.daysChunk; i++) {
                        // KEY FIX: Use UTC for date calculations
                        const nextDate = new Date(oldestDate);
                        nextDate.setUTCDate(nextDate.getUTCDate() - (daysSearched + i));
                        try {
                            const foundMessages = await this.loadDateMessages(nextDate);
                            if (foundMessages) {
                                messagesFound = true;
                                break;
                            }
                        } catch (error) {
                            console.error(`Error loading date ${nextDate.toISOString()}:`, error);
                            // Continue to next date
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
            // Check a more focused range - today and adjacent days
            const now = new Date();
            const datesToCheck = [
                new Date(now), // Today
                new Date(now.setUTCDate(now.getUTCDate() - 1)), // Yesterday 
                new Date(now.setUTCDate(now.getUTCDate() + 2))  // Tomorrow
            ];
            
            for (const date of datesToCheck) {
                try {
                    await this.loadDateMessages(date);
                } catch (error) {
                    console.error(`Error checking date ${date.toISOString()}:`, error);
                    // Continue to next date
                }
            }
            
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
                    <p>No messages found. <button onclick="window.messageBoard.loadInitialMessages()">Try Again</button></p>
                    <p class="timezone-info">Your timezone: ${Intl.DateTimeFormat().resolvedOptions().timeZone}</p>
                    <p class="debug-info">Server stores messages in UTC time.</p>
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

    // UPDATED: Fixed formatting of dates to handle timezone differences properly
    formatDate(timestamp) {
        try {
            // Parse the timestamp into a Date object (it comes from ISO string in UTC)
            const date = new Date(timestamp);
            
            // Get current time in UTC for consistent comparison
            const now = new Date();
            const nowUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
            const dateUTC = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
            
            // Calculate days difference based on UTC dates
            const diff = nowUTC - dateUTC;
            const days = Math.floor(diff / (1000 * 60 * 60 * 24));
            
            if (days < 1) return 'Today';
            if (days === 1) return 'Yesterday';
            if (days < 7) return `${days} days ago`;
            
            // For older dates, show in user's local format
            const options = { month: 'short', day: 'numeric' };
            
            // Add debugging information as a title attribute
            const fullDate = date.toISOString();
            const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
            
            // Return the formatted date with hover information
            const formattedDate = date.toLocaleDateString(navigator.language || 'en-AU', options);
            return `<span title="UTC: ${fullDate}\nYour timezone: ${userTimezone}">${formattedDate}</span>`;
        } catch (error) {
            console.error("Error formatting date:", error);
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
                <p class="debug-info">Browser time: ${new Date().toString()}</p>
                <p class="debug-info">Timezone: ${Intl.DateTimeFormat().resolvedOptions().timeZone}</p>
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
