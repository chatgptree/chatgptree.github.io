// messageboard.js
class TreeMessageBoard {
    constructor() {
        // Initialize our core properties
        this.messages = [];
        this.filteredMessages = [];
        this.currentFilter = 'all';
        this.isLoading = true;
        
        // Cache DOM elements we'll use frequently
        this.messageContainer = document.getElementById('messageContainer');
        this.searchInput = document.getElementById('searchInput');
        
        // Bind event handlers
        this.setupEventListeners();
        
        // Start loading messages
        this.initialize();
    }

    async initialize() {
        try {
            // Show loading state
            this.showLoadingSpinner();
            
            // Load initial messages
            await this.loadMessages();
            
            // Set up real-time updates for new messages
            this.setupRealtimeUpdates();
        } catch (error) {
            console.error('Failed to initialize message board:', error);
            this.showError('Failed to load messages. Please try again later.');
        }
    }

    async loadMessages() {
        console.log('1. Starting to load messages');
        try {
            // Fetch directly from your GitHub repository
            const response = await fetch(
                'https://raw.githubusercontent.com/chatgptree/chatgptree-messages/main/messages/2025/january.json'
            );
            console.log('2. Fetch response status:', response.status);
            
            if (!response.ok) {
                throw new Error('Failed to fetch messages');
            }

            const data = await response.json();
            console.log('3. Received messages:', data);
            this.messages = data || [];
            
            console.log('4. Messages stored:', this.messages.length);
            
            // Sort messages by date (newest first)
            this.messages.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
            
            // Turn off loading state before filtering and rendering
            this.isLoading = false;
            
            // Apply current filter and render
            console.log('5. About to filter and render');
            this.filterAndRenderMessages();
            console.log('6. Filtering and rendering complete');
            
        } catch (error) {
            console.error('Error loading messages:', error);
            this.isLoading = false;
            this.showError('Failed to load messages');
            throw error;
        }
    }

    setupEventListeners() {
        // Search functionality with debounce
        this.searchInput.addEventListener('input', debounce(() => {
            this.filterAndRenderMessages();
        }, 300));

        // Filter buttons
        document.querySelectorAll('.filter-btn').forEach(button => {
            button.addEventListener('click', () => {
                // Update active filter button
                document.querySelectorAll('.filter-btn').forEach(btn => 
                    btn.classList.remove('active')
                );
                button.classList.add('active');
                
                // Apply filter
                this.currentFilter = button.dataset.filter;
                this.filterAndRenderMessages();
            });
        });
    }

    setupRealtimeUpdates() {
        // Create a shared channel for new messages
        const messageChannel = new BroadcastChannel('new_tree_messages');
        
        messageChannel.onmessage = (event) => {
            const newMessage = event.data;
            
            // Add new message to our collection
            this.messages.unshift(newMessage);
            
            // Re-render with the new message
            this.filterAndRenderMessages();
            
            // Show a notification
            this.showNotification('New message received!');
        };
    }

    filterAndRenderMessages() {
        console.log('7. Starting filter');
        const searchTerm = (this.searchInput?.value || '').toLowerCase();
        
        // First apply search filter
        this.filteredMessages = this.messages.filter(message => {
            // Only search in fields we know exist in the messages
            const userNameMatch = message.userName?.toLowerCase().includes(searchTerm) || false;
            const messageMatch = message.message?.toLowerCase().includes(searchTerm) || false;
            const locationMatch = message.location?.toLowerCase().includes(searchTerm) || false;
            
            return userNameMatch || messageMatch || locationMatch;
        });

        console.log('8. Messages after filter:', this.filteredMessages.length);

        // Then apply category filter
        switch (this.currentFilter) {
            case 'recent':
                // Show only last 24 hours
                const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
                this.filteredMessages = this.filteredMessages.filter(msg => 
                    new Date(msg.timestamp) > dayAgo
                );
                break;
            case 'popular':
                // Sort by rating
                this.filteredMessages.sort((a, b) => (b.rating || 0) - (a.rating || 0));
                break;
            // 'all' requires no additional filtering
        }

        console.log('9. About to render messages');
        this.renderMessages();
    }

    renderMessages() {
        console.log('10. Rendering messages, loading state:', this.isLoading);
        
        if (this.isLoading) {
            return; // Don't render while loading
        }

        if (this.filteredMessages.length === 0) {
            this.messageContainer.innerHTML = `
                <div class="no-messages">
                    <i class="fas fa-seedling"></i>
                    <p>No messages found. Try adjusting your search.</p>
                </div>
            `;
            return;
        }

        console.log('11. Rendering messages:', this.filteredMessages.length);

        this.messageContainer.innerHTML = this.filteredMessages.map(message => `
            <div class="message-card" data-id="${message.id}">
                <div class="message-header">
                    <h3>${this.escapeHtml(message.userName)}</h3>
                    <span class="message-date">
                        ${this.formatDate(message.timestamp)}
                    </span>
                </div>
                <p class="message-content">${this.escapeHtml(message.message)}</p>
                <div class="message-footer">
                    <div class="message-rating">
                        ${'⭐'.repeat(message.rating || 0)}
                    </div>
                    <span class="message-location">
                        <i class="fas fa-map-marker-alt"></i>
                        ${this.escapeHtml(message.location)}
                    </span>
                </div>
            </div>
        `).join('');

        console.log('12. Render complete');
    }

    formatDate(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now - date;
        
        // Show relative time for recent messages
        if (diff < 24 * 60 * 60 * 1000) {
            const hours = Math.floor(diff / (60 * 60 * 1000));
            if (hours < 1) {
                const minutes = Math.floor(diff / (60 * 1000));
                return `${minutes} minutes ago`;
            }
            return `${hours} hours ago`;
        }
        
        // Show actual date for older messages
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
        console.log('Loading spinner shown');
        this.messageContainer.innerHTML = `
            <div class="loading-spinner">
                <i class="fas fa-leaf fa-spin"></i>
                <p>Loading messages...</p>
            </div>
        `;
    }

    hideLoadingSpinner() {
        this.isLoading = false;
        console.log('Loading spinner hidden');
    }

    showNotification(message) {
        const notification = document.createElement('div');
        notification.className = 'notification';
        notification.innerHTML = `
            <i class="fas fa-bell"></i>
            ${message}
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }

    showError(message) {
        this.messageContainer.innerHTML = `
            <div class="error-message">
                <i class="fas fa-exclamation-circle"></i>
                <p>${message}</p>
            </div>
        `;
    }
}

// Helper function for debouncing search input
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

// Initialize the message board when the page loads
document.addEventListener('DOMContentLoaded', () => {
    window.messageBoard = new TreeMessageBoard();
});
