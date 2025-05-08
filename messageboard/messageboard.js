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
        this.maxSearchDepth = 90; 
        this.daysChunk = 2;
        
        // For diagnostic data
        this.fetchAttempts = 0;
        this.fetchSuccesses = 0;
        this.fetchErrors = 0;
        
        this.setupEventListeners();
        this.initialize();
    }

    async initialize() {
        try {
            // Clear any old diagnostic data
            localStorage.removeItem('messageBoardDiagnostics');
            
            // Try the methods in order of most likely to work
            await this.attemptDirectLoad();
            
            if (this.messages.length === 0) {
                await this.loadInitialMessages();
            }
            
            setInterval(() => this.checkForNewMessages(), 5000);
        } catch (error) {
            console.error('Failed to initialize:', error);
            this.showError('Unable to load messages. Please try again.');
        }
    }
    
    // Method 1: Try to directly load known messages
    async attemptDirectLoad() {
        this.showLoadingSpinner('Trying direct message load...');
        
        // Known paths to try - ADD MORE IF POSSIBLE
        const knownPaths = [
            // Exact paths from your example timestamps
            '/messages/2025/march/2025-03-15.json',
            
            // Try other recent months (check your server structure)
            '/messages/2025/february/2025-02-15.json',
            '/messages/2025/january/2025-01-15.json',
            '/messages/2024/december/2024-12-25.json',
            
            // Maybe the structure is different
            '/messages/2025-03-15.json',
            '/messages/latest.json',
            '/messages/all.json'
        ];
        
        for (const path of knownPaths) {
            try {
                console.log(`Attempting direct load from: ${path}`);
                const response = await fetch(path, { cache: 'no-store' });
                
                if (response.ok) {
                    const data = await response.json();
                    if (Array.isArray(data) && data.length > 0) {
                        console.log(`SUCCESS! Found ${data.length} messages at ${path}`);
                        this.messages = [...data];
                        this.saveDiagnosticInfo('directLoad', { 
                            success: true, 
                            path: path,
                            count: data.length 
                        });
                        return true;
                    }
                }
            } catch (error) {
                console.log(`Error trying ${path}:`, error);
            }
        }
        
        return false;
    }

    formatDatePath(date) {
        // Try multiple date formats to find the right one
        const year = date.getFullYear();
        const utcYear = date.getUTCFullYear();
        const australianYear = new Date(date.toLocaleString('en-US', {timeZone: 'Australia/Melbourne'})).getFullYear();
        
        const month = date.toLocaleString('default', { month: 'long' }).toLowerCase();
        const utcMonth = date.toLocaleString('default', { month: 'long', timeZone: 'UTC' }).toLowerCase();
        const australianMonth = date.toLocaleString('default', { month: 'long', timeZone: 'Australia/Melbourne' }).toLowerCase();
        
        const day = date.getDate().toString().padStart(2, '0');
        const utcDay = date.getUTCDate().toString().padStart(2, '0');
        const australianDay = new Date(date.toLocaleString('en-US', {timeZone: 'Australia/Melbourne'})).getDate().toString().padStart(2, '0');
        
        const dateStr = `${year}-${(date.getMonth()+1).toString().padStart(2, '0')}-${day}`;
        const utcDateStr = `${utcYear}-${(date.getUTCMonth()+1).toString().padStart(2, '0')}-${utcDay}`;
        const australianDateStr = `${australianYear}-${(new Date(date.toLocaleString('en-US', {timeZone: 'Australia/Melbourne'})).getMonth()+1).toString().padStart(2, '0')}-${australianDay}`;
        
        // Return the standard path, but log all options for diagnostic purposes
        console.log('Path options:', {
            standard: `/messages/${year}/${month}/${dateStr}.json`,
            utc: `/messages/${utcYear}/${utcMonth}/${utcDateStr}.json`,
            australian: `/messages/${australianYear}/${australianMonth}/${australianDateStr}.json`
        });
        
        // Default to Australian time zone
        return `/messages/${australianYear}/${australianMonth}/${australianDateStr}.json`;
    }

    async loadInitialMessages() {
        const today = new Date();
        this.showLoadingSpinner('Searching for messages...');
        
        console.log('Starting initial load for date:', today);
        
        // First try the hard-coded paths for your known messages
        const specificPaths = [
            // Use specific paths from your messages
            `/messages/2025/march/2025-03-15.json`
        ];
        
        for (const path of specificPaths) {
            const success = await this.tryLoadPath(path);
            if (success) {
                console.log(`Successfully loaded messages from ${path}`);
                this.filterAndRender();
                return;
            }
        }
        
        // If specific paths failed, try the normal date-based search
        let startDay = 0;
        let messagesFound = false;
        
        while (!messagesFound && startDay < this.maxSearchDepth) {
            for (let i = 0; i < this.daysChunk; i++) {
                const date = new Date(today);
                date.setDate(date.getDate() - (startDay + i));
                
                // Try Australian time zone explicitly
                const australianDate = new Date(date.toLocaleString('en-US', {timeZone: 'Australia/Melbourne'}));
                const path = this.formatDatePath(australianDate);
                
                const foundMessages = await this.tryLoadPath(path);
                if (foundMessages) {
                    messagesFound = true;
                    break;
                }
            }
            
            startDay += this.daysChunk;
            
            if (!messagesFound) {
                this.showLoadingSpinner(`Searching older messages... (${startDay} days back)`);
            }
        }
        
        console.log(`Total messages loaded: ${this.messages.length}`);
        this.saveDiagnosticInfo('searchResult', {
            totalAttempts: this.fetchAttempts,
            successes: this.fetchSuccesses,
            errors: this.fetchErrors,
            messageCount: this.messages.length
        });
        
        this.filterAndRender();
        
        // If we still couldn't find messages, show diagnostic info
        if (this.messages.length === 0) {
            this.showDiagnosticInfo();
        }
    }
    
    async tryLoadPath(path) {
        console.log(`Trying to load from: ${path}`);
        this.fetchAttempts++;
        
        try {
            const response = await fetch(path, { cache: 'no-store' });
            
            if (response.ok) {
                this.fetchSuccesses++;
                const newMessages = await response.json();
                
                if (Array.isArray(newMessages) && newMessages.length > 0) {
                    console.log(`Found ${newMessages.length} messages at ${path}`);
                    
                    const existingIds = new Set(this.messages.map(m => m.id));
                    const uniqueNewMessages = newMessages.filter(m => !existingIds.has(m.id));
                    
                    if (uniqueNewMessages.length > 0) {
                        this.messages = [...this.messages, ...uniqueNewMessages]
                            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
                        return true;
                    }
                    
                    return newMessages.length > 0;
                }
            } else {
                console.log(`No messages at ${path} (${response.status})`);
            }
            
            return false;
        } catch (error) {
            this.fetchErrors++;
            console.error(`Error loading from ${path}:`, error);
            return false;
        }
    }
    
    saveDiagnosticInfo(key, data) {
        try {
            const diagnostics = JSON.parse(localStorage.getItem('messageBoardDiagnostics') || '{}');
            diagnostics[key] = data;
            localStorage.setItem('messageBoardDiagnostics', JSON.stringify(diagnostics));
        } catch (e) {
            console.error('Error saving diagnostics:', e);
        }
    }
    
    showDiagnosticInfo() {
        const userAgent = navigator.userAgent;
        const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const locale = navigator.language;
        const now = new Date();
        
        const diagnosticInfo = {
            browser: userAgent,
            timeZone: timeZone,
            locale: locale,
            time: now.toString(),
            fetchAttempts: this.fetchAttempts,
            fetchSuccesses: this.fetchSuccesses,
            fetchErrors: this.fetchErrors
        };
        
        console.log('Diagnostic Info:', diagnosticInfo);
        this.saveDiagnosticInfo('userInfo', diagnosticInfo);
        
        this.messageContainer.innerHTML = `
            <div class="diagnostic-info">
                <h3>No Messages Found</h3>
                <p>We couldn't find any messages after searching ${this.maxSearchDepth} days back.</p>
                
                <div class="diagnostic-details">
                    <h4>Diagnostic Information:</h4>
                    <ul>
                        <li><strong>Time Zone:</strong> ${timeZone}</li>
                        <li><strong>Locale:</strong> ${locale}</li>
                        <li><strong>Current Time:</strong> ${now.toString()}</li>
                        <li><strong>Fetch Attempts:</strong> ${this.fetchAttempts}</li>
                        <li><strong>Fetch Successes:</strong> ${this.fetchSuccesses}</li>
                        <li><strong>Fetch Errors:</strong> ${this.fetchErrors}</li>
                    </ul>
                </div>
                
                <div class="manual-path-form">
                    <p>Try a different path:</p>
                    <input type="text" id="manualPath" placeholder="/messages/2025/march/2025-03-15.json">
                    <button id="tryPathBtn">Try This Path</button>
                </div>
                
                <button onclick="window.messageBoard.attemptDirectLoad()">Try Known Paths Again</button>
            </div>
        `;
        
        document.getElementById('tryPathBtn').addEventListener('click', () => {
            const path = document.getElementById('manualPath').value;
            if (path) {
                this.tryManualPath(path);
            }
        });
    }
    
    async tryManualPath(path) {
        this.showLoadingSpinner(`Trying manual path: ${path}`);
        const success = await this.tryLoadPath(path);
        
        if (success) {
            this.filterAndRender();
            this.showNotification('Successfully loaded messages!');
        } else {
            this.showDiagnosticInfo();
            this.showNotification('Could not find messages at that path.');
        }
    }
    
    showLoadingSpinner(message = '') {
        if (!this.messages.length) {
            this.messageContainer.innerHTML = `
                <div class="loading-spinner">
                    <i class="fas fa-leaf fa-spin"></i>
                    ${message ? `<p>${message}</p>` : ''}
                </div>`;
        }
    }

    // The rest of your methods stay the same
    
    // ... (keep all existing methods for checking new messages, filtering, rendering, etc.)
    
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
                
                while (!messagesFound && daysSearched < this.maxSearchDepth) {
                    for (let i = 1; i <= this.daysChunk; i++) {
                        const nextDate = new Date(oldestDate);
                        nextDate.setDate(nextDate.getDate() - (daysSearched + i));
                        
                        // Try to load using Australian time
                        const australianDate = new Date(nextDate.toLocaleString('en-US', {timeZone: 'Australia/Melbourne'}));
                        const path = this.formatDatePath(australianDate);
                        const foundMessages = await this.tryLoadPath(path);
                        
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
            const australianDate = new Date(now.toLocaleString('en-US', {timeZone: 'Australia/Melbourne'}));
            const path = this.formatDatePath(australianDate);
            
            await this.tryLoadPath(path);
            
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

// Add some styles for the diagnostic info
document.addEventListener('DOMContentLoaded', () => {
    const style = document.createElement('style');
    style.textContent = `
        .diagnostic-info {
            background-color: #f8f9fa;
            border-radius: 8px;
            padding: 20px;
            margin-top: 20px;
        }
        .diagnostic-details {
            margin: 15px 0;
            background-color: #fff;
            border-radius: 4px;
            padding: 10px;
            border: 1px solid #ddd;
        }
        .manual-path-form {
            margin: 20px 0;
        }
        #manualPath {
            padding: 8px;
            width: 100%;
            max-width: 400px;
            margin-bottom: 10px;
        }
        #tryPathBtn {
            background-color: #4CAF50;
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 4px;
            cursor: pointer;
        }
    `;
    document.head.appendChild(style);
    
    window.messageBoard = new TreeMessageBoard();
});
