class NewsBoard {
    constructor() {
        this.pageSize = 12;
        this.hasMoreNews = true;
        this.isLoading = true;
        
        this.newsContainer = document.getElementById('newsGrid');
        this.searchInput = document.getElementById('searchInput');
        
        this.initialize();
    }

    async initialize() {
        console.log('Initializing NewsBoard...');
        try {
            await this.loadNews();
        } catch (error) {
            console.error('Failed to initialize news board:', error);
            this.showError('Failed to load news. Please try again later.');
        }
    }

    async loadNews() {
        console.log('Loading news...');
        try {
            const response = await fetch('news-data.json');
            console.log('Response:', response);
            
            if (!response.ok) {
                throw new Error(`Failed to fetch news: ${response.status}`);
            }

            const data = await response.json();
            console.log('News data loaded:', data);

            this.renderNews(data);
            
        } catch (error) {
            console.error('Error loading news:', error);
            this.showError('Unable to load news. Please try again later.');
        } finally {
            this.isLoading = false;
        }
    }

    renderNews(newsItems) {
        if (!newsItems?.length) {
            this.newsContainer.innerHTML = `
                <div class="no-news">
                    <i class="fas fa-newspaper"></i>
                    <p>No news articles found.</p>
                </div>
            `;
            return;
        }

        this.newsContainer.innerHTML = newsItems.map(item => `
            <div class="news-card">
                <div class="news-image">
                    <img src="${item.image || '../images/default-news.jpg'}" 
                         alt="${this.escapeHtml(item.title)}"
                         onerror="this.src='../images/default-news.jpg'">
                </div>
                <div class="news-content">
                    <div class="news-meta">
                        <span class="news-date">${this.formatDate(item.pubDate || item.date)}</span>
                        <span class="news-source">${this.escapeHtml(item.source || '')}</span>
                    </div>
                    <h3>${this.escapeHtml(item.title)}</h3>
                    <p class="news-description">${this.escapeHtml(item.description)}</p>
                    <div class="news-footer">
                        <a href="${item.link}" class="read-more" target="_blank" rel="noopener noreferrer">
                            Read More <i class="fas fa-external-link-alt"></i>
                        </a>
                        <div class="share-buttons">
                            <button onclick="shareNews('${item.link}', '${this.escapeHtml(item.title)}')" class="share-btn">
                                <i class="fas fa-share-alt"></i>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `).join('');

        // Add search functionality after rendering
        if (this.searchInput) {
            this.setupSearch(newsItems);
        }
    }

    setupSearch(newsItems) {
        this.searchInput.addEventListener('input', (e) => {
            const searchTerm = e.target.value.toLowerCase();
            const filteredNews = newsItems.filter(item => 
                item.title.toLowerCase().includes(searchTerm) ||
                item.description.toLowerCase().includes(searchTerm)
            );
            this.renderNews(filteredNews);
        });
    }

    formatDate(dateStr) {
        try {
            const date = new Date(dateStr);
            return date.toLocaleDateString('en-AU', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
        } catch (e) {
            console.error('Date formatting error:', e);
            return dateStr;
        }
    }

    escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    showError(message) {
        this.newsContainer.innerHTML = `
            <div class="error-message">
                <i class="fas fa-exclamation-circle"></i>
                <p>${message}</p>
                <button onclick="window.newsBoard.loadNews()" class="retry-button">
                    <i class="fas fa-sync"></i> Retry
                </button>
            </div>
        `;
    }
}

// Share functionality
function shareNews(url, title) {
    if (navigator.share) {
        navigator.share({
            title: title,
            url: url
        })
        .catch(error => console.log('Error sharing:', error));
    } else {
        // Fallback for browsers that don't support Web Share API
        navigator.clipboard.writeText(url)
            .then(() => alert('Link copied to clipboard!'))
            .catch(err => console.error('Failed to copy:', err));
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.newsBoard = new NewsBoard();
});
