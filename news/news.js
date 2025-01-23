// news/news.js
document.addEventListener('DOMContentLoaded', () => {
    const newsGrid = document.getElementById('newsGrid');
    const loadingIndicator = document.querySelector('.loading-indicator');
    const RSS_FEEDS = [
        'https://www.treehugger.com/feeds/latest-rss.xml',
        'https://forestnewsfeed.com/feed/',
        'https://www.arborday.org/media/rss.cfm'
    ];

    async function fetchNews() {
        try {
            loadingIndicator.classList.add('active');
            newsGrid.style.display = 'none';

            // Try each feed until one works
            let data = null;
            let error = null;

            for (const feed of RSS_FEEDS) {
                try {
                    const apiUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(feed)}&api_key=yk1rva0ii4prfxqjuqwvxjz3w10vyp56h5tmlvph&count=20`;
                    console.log('Trying feed:', feed);
                    
                    const response = await fetch(apiUrl);
                    data = await response.json();
                    
                    if (data.status === 'ok' && data.items) {
                        break; // We found a working feed
                    }
                } catch (e) {
                    error = e;
                    continue; // Try next feed
                }
            }

            if (!data || data.status !== 'ok') {
                throw new Error(error || data?.message || 'Failed to fetch news');
            }

            // Filter for tree-related content
            const treeNews = data.items.filter(item => {
                const text = `${item.title} ${item.description}`.toLowerCase();
                return text.includes('tree') || 
                       text.includes('forest') || 
                       text.includes('woodland') ||
                       text.includes('plant');
            });

            console.log('Found tree news items:', treeNews.length);
            displayNews(treeNews);
        } catch (error) {
            console.error('Detailed error:', error);
            showError(`Failed to load news. Please try again later.`);
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
                    <span>Source: ${article.source || 'Environmental News'}</span><br>
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
