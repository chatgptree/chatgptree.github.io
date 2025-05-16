class TreeMessageBoard {
    constructor() {
        // Force refresh mechanism - increment the version when you want to force a refresh
        const CURRENT_VERSION = 4; // Incremented from 3 to force refresh
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
        this.maxSearchDepth = 90; // Maximum days to look back
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
            await this.loadInitialMessages();
            setInterval(() => this.checkForNewMessages(), 5000);
        } catch (error) {
            console.error('Failed to initialize:', error);
            this.showError('Unable to load messages. Please try again.');
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
        
        // MUCH wider initial check - look at today, a week in the past, and a few days in the future
        // This should catch any messages regardless of timezone differences
        const today = new Date();
        console.log("Starting load with browser date:", today.toString());
        
        // Immediately try to load exact message list if available
        await this.tryLoadMessageList();
        
        if (this.messages.length > 0) {
            console.log("Successfully loaded messages from index list");
            this.filterAndRender();
            return;
        }
        
        // If no message list or no messages found, try wide date range search
        // EXPANDED: Check a much wider range for international users
        const initialWindow = 10; // Check 10 days in each direction initially
        let messagesFound = false;
        
        // First check today and a wide range around it to handle international timezones
        for (let offset = -initialWindow; offset <= initialWindow; offset++) {
            const date = new Date(today);
            date.setUTCDate(date.getUTCDate() + offset);
            
            console.log(`Checking date with offset ${offset}:`, date.toISOString().split('T')[0]);
            const foundMessages = await this.loadDateMessages(date);
            if (foundMessages) {
                messagesFound = true;
                // DON'T break - continue to load all dates in range to get complete message set
            }
        }
        
        console.log(`Total messages loaded: ${this.messages.length}`);
        
        if (this.messages.length > 0) {
            this.filterAndRender();
            return;
        }
        
        // If STILL no messages found, continue with normal search pattern for older messages
        let startDay = initialWindow + 1; // Start after our initial window
        while (!messagesFound && startDay < this.maxSearchDepth) {
            // Load next chunk of days
            for (let i = 0; i < this.daysChunk; i++) {
                const date = new Date(today);
                date.setUTCDate(date.getUTCDate() - (startDay + i));
                
                const foundMessages = await this.loadDateMessages(date);
                
                // Check if we found any messages
                if (this.messages.length > 0) {
                    console.log(`Found messages for date: ${date.toISOString().split('T')[0]}`);
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
        
        console.log(`Total messages loaded after deep search: ${this.messages.length}`);
        this.filterAndRender();
    }
    
    // NEW METHOD: Try to load a master message list if available
    async tryLoadMessageList() {
        try {
            // Try to load a master list of all recent messages if available
            const indexUrl = '/messages/recent.json';
            console.log('Trying to load master message list from:', indexUrl);
            
            const response = await fetch(indexUrl, { 
                cache: 'no-store'
            });

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
            console.error(`Error loading master message list:`, error);
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
            console.error(`Error loading messages for ${dateStr}:`, error);
            return false;
        }
    }

    // Other methods remain the same as in your previous update...

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
}

document.addEventListener('DOMContentLoaded', () => {
    window.messageBoard = new TreeMessageBoard();
});
