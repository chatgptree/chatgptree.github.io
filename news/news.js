// news/news.js
document.addEventListener('DOMContentLoaded', () => {
    const newsGrid = document.getElementById('newsGrid');
    const loadingIndicator = document.querySelector('.loading-indicator');
    const RSS_FEEDS = [
        'https://phys.org/rss-feed/earth-news/environment/earth-sciences/',
        'https://www.sciencedaily.com/rss/earth_climate/nature.xml',
        'https://climate.nasa.gov/feed/news/'
    ];

    async function fetchNews() {
        try {
            loadingIndicator.classList.add('active');
            newsGrid.style.display = 'none';

            // In a real implementation, this would call your backend API
            // For now, we'll use a proxy service for RSS feeds
            const response = await fetch('https://api.rss2json.com/v1/api.json', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    rss_url: RSS_FEEDS[0], // Using first feed for demo
                    api_key: 'yk1rva0ii4prfxqjuqwvxjz3w10vyp56h5tmlvph', //https://rss2json.com/
                    count: 9
                })
            });

            const data = await response.json();
            
            if (!response.ok) throw new Error('Failed to fetch news');

            // Filter for tree-related content and create cards
            const treeNews = data.items.filter(item => {
                const text = `${item.title} ${item.description}`.toLowerCase();
                return text.includes('tree') || 
                       text.includes('forest') || 
                       text.includes('woodland');
            });

            displayNews(treeNews);
        } catch (error) {
            showError('Failed to load news. Please try again later.');
        } finally {
            loadingIndicator.classList.remove('active');
            newsGrid.style.display = 'grid';
        }
    }

    function displayNews(articles) {
        if (articles.length === 0) {
            showError('No tree news found at the moment. Please check back later.');
            return;
        }

        newsGrid.innerHTML = articles.map(article => `
            <article class="news-card">
                <div class="news-meta">
                    <span>Published: ${new Date(article.pubDate).toLocaleDateString()}</span>
                </div>
                <h3>${article.title}</h3>
                <div class="news-description">
                    ${article.description ? 
                      article.description.length > 150 ? 
                      article.description.substring(0, 150) + '...' : 
                      article.description 
                      : 'No description available'}
                </div>
                <a href="${article.link}" target="_blank" rel="noopener noreferrer" class="read-more">
                    Read Full Article →
                </a>
            </article>
        `).join('');
    }

    function showError(message) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message active';
        errorDiv.textContent = message;
        newsGrid.innerHTML = '';
        newsGrid.appendChild(errorDiv);
    }

    // Initial fetch
    fetchNews();

    // Refresh every hour
    setInterval(fetchNews, 60 * 60 * 1000);
});
