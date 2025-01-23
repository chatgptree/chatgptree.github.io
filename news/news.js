// news/news.js
document.addEventListener('DOMContentLoaded', () => {
    const newsGrid = document.getElementById('newsGrid');
    const loadingIndicator = document.querySelector('.loading-indicator');
    const RSS_FEEDS = [
        'https://news.google.com/rss/search?q=trees+forest+environment&hl=en-US&gl=US&ceid=US:en',
        'https://blog.nature.org/feed/',
        'https://www.conservation.org/feed'
    ];

    // Default image to use if no image is provided
    const DEFAULT_IMAGE = '../images/bazzaweb2.jpg'; // Using your existing image as fallback

    async function fetchNews() {
        try {
            loadingIndicator.classList.add('active');
            newsGrid.style.display = 'none';

            let data = null;
            let error = null;

            for (const feed of RSS_FEEDS) {
                try {
                    console.log('Trying feed:', feed);
                    
                    const url = new URL('https://api.rss2json.com/v1/api.json');
                    url.searchParams.append('rss_url', feed);
                    url.searchParams.append('api_key', 'yk1rva0ii4prfxqjuqwvxjz3w10vyp56h5tmlvph');
                    url.searchParams.append('count', '20');

                    const response = await fetch(url);
                    data = await response.json();
                    
                    if (data.status === 'ok' && data.items && data.items.length > 0) {
                        console.log('Found working feed:', feed);
                        break;
                    }
                } catch (e) {
                    error = e;
                    continue;
                }
            }

            if (!data || data.status !== 'ok') {
                throw new Error(error || data?.message || 'Failed to fetch news');
            }

            const treeNews = data.items.filter(item => {
                const text = `${item.title} ${item.description}`.toLowerCase();
                return text.includes('tree') || 
                       text.includes('forest') || 
                       text.includes('woodland') ||
                       text.includes('plant') ||
                       text.includes('environment');
            }).slice(0, 9);

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
                ${article.enclosure?.link || article.thumbnail ? `
                    <div class="news-image">
                        <img src="${article.enclosure?.link || article.thumbnail}" 
                             alt="${article.title}"
                             onerror="this.onerror=null; this.src='${DEFAULT_IMAGE}';">
                    </div>
                ` : ''}
                <div class="news-content">
                    <div class="news-meta">
                        <span>Source: ${article.author || article.source || 'Environmental News'}</span><br>
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
                </div>
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
