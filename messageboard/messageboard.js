class TreeMessageBoard {
    constructor() {
        this.messages = [];
        this.filteredMessages = [];
        this.currentFilter = 'all';
        this.isLoading = true;
        this.lastUpdateTime = 0;
        this.pollingInterval = 5000; // 5 seconds
        this.pageSize = 20;
        this.currentPage = 1;
        this.totalPages = 1;
        this.isIntersectionObserverSupported = 'IntersectionObserver' in window;
        
        // DOM elements
        this.messageContainer = document.getElementById('messageContainer');
        this.searchInput = document.getElementById('searchInput');
        this.prevPageBtn = document.getElementById('prevPage');
        this.nextPageBtn = document.getElementById('nextPage');
        this.pageInfo = document.getElementById('pageInfo');
        
        // Initialize intersection observer
        if (this.isIntersectionObserverSupported) {
            this.setupIntersectionObserver();
        }
        
        this.setupEventListeners();
        this.initialize();
    }

    setupIntersectionObserver() {
        this.observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting && !this.isLoading) {
                    const messageId = entry.target.dataset.id;
                    if (messageId) {
                        this.loadMessageContent(entry.target, messageId);
                    }
                }
            });
        }, {
            root: null,
            rootMargin: '50px',
            threshold: 0.1
        });

        // Observer for infinite scroll
        this.scrollObserver = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting && !this.isLoading) {
                this.loadNextPage();
            }
        });
        
        const scrollObserverElement = document.getElementById('scrollObserver');
        if (scrollObserverElement) {
            this.scrollObserver.observe(scrollObserverElement);
        }
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
        if (this.pollingTimer) {
            clearInterval(this.pollingTimer);
        }
        
        this.pollingTimer = setInterval(async () => {
            await this.checkForNewMessages();
        }, this.pollingInterval);

        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                clearInterval(this.pollingTimer);
            } else {
                this.startPolling();
                this.checkForNewMessages();
            }
        });
    }

    async checkForNewMessages() {
        try {
            const now = new Date();
            const year = now.getFullYear();
            const currentMonth = now.toLocaleString('default', { month: 'long' }).toLowerCase();
            
            const url = `https://api.github.com/repos/chatgptree/chatgptree.github.io/contents/messages/${year}/${currentMonth}.json`;
            
            const response = await fetch(url, {
                headers: {
                    'Accept': 'application/vnd.github.v3.raw'
                }
            });

            if (response.ok) {
                const data = await response.json();
                
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
            
            // Load current and previous month data
            const [currentMonthData, previousMonthData] = await Promise.all([
                this.fetchMonthData(year, currentMonth),
                this.fetchPreviousMonthData(year, currentMonth)
            ]);

            this.messages = [...currentMonthData, ...previousMonthData];
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

    async fetchMonthData(year, month) {
        const url = `https://api.github.com/repos/chatgptree/chatgptree.github.io/contents/messages/${year}/${month}.json`;
        try {
            const response = await fetch(url, {
                headers: {
                    'Accept': 'application/vnd.github.v3.raw'
                }
            });
            return response.ok ? await response.json() : [];
        } catch (error) {
            console.error(`Error fetching ${month} data:`, error);
            return [];
        }
    }

    async fetchPreviousMonthData(year, currentMonth) {
        const date = new Date();
        date.setMonth(date.getMonth() - 1);
        const previousMonth = date.toLocaleString('default', { month: 'long' }).toLowerCase();
        const previousYear = date.getFullYear();
        
        return this.fetchMonthData(previousYear, previousMonth);
    }

    setupEventListeners() {
        if (this.searchInput) {
            this.searchInput.addEventListener('input', debounce(() => {
                this.currentPage = 1;
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
                this.currentPage = 1;
                this.filterAndRenderMessages();
            });
        });

        if (this.prevPageBtn) {
            this.prevPageBtn.addEventListener('click', () => this.changePage(-1));
        }

        if (this.nextPageBtn) {
            this.nextPageBtn.addEventListener('click', () => this.changePage(1));
        }
    }

    changePage(delta) {
        const newPage = this.currentPage + delta;
        if (newPage >= 1 && newPage <= this.totalPages) {
            this.currentPage = newPage;
            this.filterAndRenderMessages();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    }

    filterAndRenderMessages() {
        const searchTerm = (this.searchInput?.value || '').toLowerCase();
        const searchWords = new Set(searchTerm.split(' ').filter(word => word.length > 0));
        
        this.filteredMessages = this.messages.filter(message => {
            if (searchWords.size === 0) return true;
            
            const messageText = `${message.userName} ${message.message} ${message.location} ${message.treeName}`.toLowerCase();
            return Array.from(searchWords).every(word => messageText.includes(word));
        });

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

        this.totalPages = Math.ceil(this.filteredMessages.length / this.pageSize);
        this.updatePaginationControls();
        this.renderMessages();
    }

    updatePaginationControls() {
        if (this.prevPageBtn) {
            this.prevPageBtn.disabled = this.currentPage === 1;
        }
        if (this.nextPageBtn) {
            this.nextPageBtn.disabled = this.currentPage === this.totalPages;
        }
        if (this.pageInfo) {
            this.pageInfo.textContent = `Page ${this.currentPage} of ${this.totalPages}`;
        }
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

        const start = (this.currentPage - 1) * this.pageSize;
        const end = start + this.pageSize;
        const pageMessages = this.filteredMessages.slice(start, end);

        if (this.isIntersectionObserverSupported) {
            this.renderWithVirtualization(pageMessages);
        } else {
            this.renderTraditional(pageMessages);
        }
    }

    renderWithVirtualization(messages) {
        this.messageContainer.innerHTML = messages.map(message => `
            <div class="message-placeholder" data-id="${this.escapeHtml(message.id)}"></div>
        `).join('');

        document.querySelectorAll('.message-placeholder').forEach(placeholder => {
            this.observer.observe(placeholder);
        });
    }

    renderTraditional(messages) {
        this.messageContainer.innerHTML = messages.map(message => this.createMessageHTML(message)).join('');
    }

    async loadMessageContent(placeholder, messageId) {
        const message = this.filteredMessages.find(m => m.id === messageId);
        if (message) {
            placeholder.innerHTML = this.createMessageHTML(message);
            placeholder.classList.remove('message-placeholder');
            this.observer.unobserve(placeholder);
        }
    }

    createMessageHTML(message) {
        return `
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
        `;
    }

    async loadNextPage() {
        if (this.currentPage < this.totalPages) {
            this.currentPage++;
            this.filterAndRenderMessages();
        }
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
            ${messag
