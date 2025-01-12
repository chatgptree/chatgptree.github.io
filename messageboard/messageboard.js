class ModeratedTreeMessageBoard {
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
        
        // Initialize profanity filter with multiple languages
        this.initializeContentFilter();
        
        this.setupEventListeners();
        this.initialize();
    }

    initializeContentFilter() {
        this.filter = new Filter();
        
        // Load all supported languages except French
        const languages = ['en', 'es', 'zh', 'ja', 'ko', 'de', 'ru', 'ar', 'hi', 'it'];
        languages.forEach(lang => {
            this.filter.loadDictionary(lang);
        });

        // Add any custom words that should be filtered
        this.filter.add([
            // Add your custom words here
        ]);
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
            
            const url = `https://raw.githubusercontent.com/chatgptree/chatgptree.github.io/main/messages/${year}/${currentMonth}.json`;
            
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
                    const newMessages = data.filter(message => {
                        const messageTime = new Date(message.timestamp).getTime();
                        return messageTime > this.lastUpdateTime;
                    });

                    for (const message of newMessages) {
                        const modResult = await this.moderateMessage(message);
                        if (modResult.isAccepted) {
                            message.message = modResult.moderatedContent;
                            message.isModerated = modResult.requiresModeration;
                            message.moderationReasons = modResult.reasons;
                            this.messages.unshift(message);
                        }
                    }

                    const latestMessage = newMessages.reduce((latest, msg) => {
                        const msgTime = new Date(msg.timestamp).getTime();
                        return msgTime > latest ? msgTime : latest;
                    }, 0);
                    this.lastUpdateTime = latestMessage;

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
            
            const now = new Date();
            const year = now.getFullYear();
            const currentMonth = now.toLocaleString('default', { month: 'long' }).toLowerCase();
            
            const url = `https://raw.githubusercontent.com/chatgptree/chatgptree.github.io/main/messages/${year}/${currentMonth}.json`;
            
            const response = await fetch(url, {
                cache: 'no-store'
            });
            
            if (!response.ok) {
                throw new Error(`Failed to fetch messages: ${response.status}`);
            }

            const data = await response.json();
            
            let filteredData = this.lastMessageTimestamp 
                ? data.filter(msg => new Date(msg.timestamp) < new Date(this.lastMessageTimestamp))
                : data;
            
            const newMessages = filteredData.slice(0, this.pageSize);
            
            this.hasMoreMessages = filteredData.length > this.pageSize;

            for (const message of newMessages) {
                const modResult = await this.moderateMessage(message);
                if (modResult.isAccepted) {
                    message.message = modResult.moderatedContent;
                    message.isModerated = modResult.requiresModeration;
                    message.moderationReasons = modResult.reasons;
                    this.messages.push(message);
                }
            }
            
            if (newMessages.length > 0) {
                this.lastMessageTimestamp = newMessages[newMessages.length - 1].timestamp;
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

    async moderateMessage(message) {
        const results = {
            isAccepted: true,
            reasons: [],
            moderatedContent: message.message,
            requiresModeration: false
        };

        try {
            if (!this.validateMessage(message)) {
                results.isAccepted = false;
                results.reasons.push('Invalid message format');
                return results;
            }

            if (!this.checkLength(message.message)) {
                results.moderatedContent = message.message.slice(0, 1000);
                results.requiresModeration = true;
                results.reasons.push('Message truncated to maximum length');
            }

            const cleanedMessage = this.filter.clean(message.message);
            if (cleanedMessage !== message.message) {
                results.moderatedContent = cleanedMessage;
                results.requiresModeration = true;
                results.reasons.push('Inappropriate content filtered');
            }

            if (this.isExtremeSpam(results.moderatedContent)) {
                results.isAccepted = false;
                results.reasons.push('Excessive spam detected');
                return results;
            }

            return results;
        } catch (error) {
            console.error('Moderation error:', error);
            results.isAccepted = false;
            results.reasons.push('Moderation error');
            return results;
        }
    }

    validateMessage(message) {
        return message?.message?.length > 0 && 
               message?.userName?.length > 0 && 
               message?.location?.length > 0;
    }

    checkLength(text) {
        return text.length >= 2 && text.length <= 1000;
    }

    isExtremeSpam(text) {
        if (/(.)\1{10,}/.test(text)) return true;
        
        const capitals = text.replace(/[^A-Z]/g, '').length;
        const letters = text.replace(/[^a-zA-Z]/g, '').length;
        if (letters > 20 && (capitals / letters) > 0.9) return true;
        
        const urlCount = (text.match(/https?:\/\/\S+/g) || []).length;
        if (urlCount > 5) return true;

        return false;
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
        
        const messageCards = this.messageContainer.querySelectorAll('.message-card');
        if (messageCards.length > 0) {
            observer.observe(messageCards[messageCards.length - 1]);
        }
    }

    filterAndRenderMessages() {
        if (this.isLoading && !this.messages.length) return;

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
                    ${message.isModerated ? '<span class="moderated-tag">Filtered</span>' : ''}
                </div>
                <div class="message-rating">
                    ${'⭐'.repeat(message.rating || 0)}
                </div>
                <p class="message-content ${message.isModerated ? 'moderated-content' : ''}">${this.escapeHtml(message.message)}</p>
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
        
        if (minutes < 1) {
            return 'Just now';
        }
        if (minutes < 60) {
            return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'} ago`;
        }
        if (hours < 24) {
            return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
        }
        if (days < 7) {
            return `${days} ${days === 1 ? 'day' : 'days'} ago`;
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

        // Remove notification after 3 seconds
        setTimeout(() => {
            notification.style.opacity = '0';
            setTimeout(() => notification.remove(), 300);
        }, 3000);

        // Reset cooldown after 1 minute
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
    window.messageBoard = new ModeratedTreeMessageBoard();
});
