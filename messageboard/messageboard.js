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
            const messages = await this.fetchMessagesForDate(this.currentDate);
            
            if (messages.length === 0) {
                // Move to previous day
                this.currentDate.setDate(this.currentDate.getDate() - 1);
                
                // Check 6-month limit
                const maxHistory = new Date();
                maxHistory.setMonth(maxHistory.getMonth() - 6);
                if (this.currentDate < maxHistory) {
                    this.hasMoreMessages = false;
                }
            } else {
                this.messages = [...this.messages, ...messages];
                this.messages.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
                this.lastUpdateTime = Math.max(this.lastUpdateTime, 
                    ...messages.map(m => new Date(m.timestamp).getTime()));
            }

            this.filterAndRenderMessages();
            this.setupInfiniteScroll();
        } catch (error) {
            console.error('Load error:', error);
            this.showError('Unable to load messages');
        } finally {
            this.isLoading = false;
        }
    }

    async fetchMessagesForDate(date) {
        const year = date.getUTCFullYear();
        const month = date.toLocaleString('default', { month: 'long', timeZone: 'UTC' }).toLowerCase();
        const day = date.toISOString().split('T')[0];
        
        const url = `https://raw.githubusercontent.com/chatgptree/chatgptree.github.io/main/messages/${year}/${month}/${day}.json`;
        
        try {
            const response = await fetch(url, { cache: 'no-store' });
            if (response.status === 404) return [];
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return await response.json();
        } catch (error) {
            if (error.message.includes('404')) return [];
            throw error;
        }
    }

    async checkForNewMessages() {
        try {
            const messages = await this.fetchMessagesForDate(new Date());
            const newMessages = messages.filter(msg => 
                new Date(msg.timestamp).getTime() > this.lastUpdateTime
            );

            if (newMessages.length) {
                this.messages = [...newMessages, ...this.messages];
                this.lastUpdateTime = Math.max(...newMessages.map(m => 
                    new Date(m.timestamp).getTime()
                ));
                this.filterAndRenderMessages();
                this.showNotification('New messages arrived! 🌱');
            }
        } catch (error) {
            console.error('Check new messages error:', error);
        }
    }

    // ... keep existing helper methods (filterAndRenderMessages, setupEventListeners, 
    //     formatDate, escapeHtml, showLoadingSpinner, showNotification, showError) ...
}
