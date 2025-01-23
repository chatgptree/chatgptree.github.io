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

            // Log the URL we're trying to fetch
            const apiUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(RSS_FEEDS[0])}&api_key=yk1rva0ii4prfxqjuqwvxjz3w10vyp56h5tmlvph&count=20`;
            console.log('Fetching from:', apiUrl);

            const response = await fetch(apiUrl);
            console.log('Response status:', response.status);
            
            const data = await response.json();
            console.log('API Response:', data);

            if (!data || data.status !== 'ok') {
                throw new Error(data?.message || 'Failed to fetch news');
            }

            // Filter for tree-related content
            const treeNews = data.items.filter(item => {
                const text = `${item.title} ${item.description}`.toLowerCase();
                return text.includes('tree') || 
                       text.includes('forest') || 
                       text.includes('woodland');
            });

            console.log('Found tree news items:', treeNews.length);
            displayNews(treeNews);
        } catch (error) {
            console.error('Detailed error:', error);
            showError(`Failed to load news. Error: ${error.message}`);
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
