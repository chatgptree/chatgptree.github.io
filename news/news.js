// news/news.js
document.addEventListener('DOMContentLoaded', () => {
    const newsGrid = document.getElementById('newsGrid');
    const loadingIndicator = document.querySelector('.loading-indicator');
    
    // Curated list of positive environmental news sources
    const RSS_FEEDS = [
        'https://www.positive.news/environment/feed/',
        'https://www.goodnewsnetwork.org/category/earth/feed/',
        'https://www.nationalforests.org/rss.xml',
        'https://forestsnews.cifor.org/feed',
        'https://www.worldagroforestry.org/feed',
        'https://www.ecowatch.com/rss/environment'
    ];

    const DEFAULT_IMAGE = '../images/bazzaweb2.jpg';

    // Keywords for filtering tree-related news
    const TREE_KEYWORDS = [
        'tree', 'forest', 'woodland', 'rainforest', 'reforestation',
        'agroforestry', 'conservation', 'biodiversity', 'ecosystem',
        'planting', 'restoration', 'canopy', 'grove', 'jungle'
    ];

    async function fetchNews() {
        try {
            loadingIndicator.classList.add('active');
            newsGrid.style.display = 'none';

            // Fetch from all feeds concurrently
            const allNewsPromises = RSS_FEEDS.map(async feed => {
                try {
                    const url = new URL('https://api.rss2json.com/v1/api.json');
                    url.searchParams.append('rss_url', feed);
                    url.searchParams.append('api_key', 'yk1rva0ii4prfxqjuqwvxjz3w10vyp56h5tmlvph');
                    url.searchParams.append('count', '50'); // Increased to get more articles per feed

                    const response = await fetch(url);
                    const data = await response.json();
                    
                    if (data.status === 'ok' && data.items?.length > 0) {
                        return data.items;
                    }
                } catch (e) {
                    console.error('Error fetching feed:', feed, e);
                }
                return [];
            });

            // Combine all news items
            const allResults = await Promise.all(allNewsPromises);
            let allNews = allResults.flat();

            // Filter for articles from the last 3 months
            const threeMonthsAgo = new Date();
            threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

            const filteredNews = allNews
                .filter(item => {
                    const pubDate = new Date(item.pubDate);
                    if (pubDate < threeMonthsAgo) return false;

                    // Check for tree-related content
                    const text = `${item.title} ${item.description}`.toLowerCase();
                    return TREE_KEYWORDS.some(keyword => 
                        text.includes(keyword.toLowerCase())
                    );
                })
                .map(item => ({
                    ...item,
                    link: item.link.replace(/\?.*$/, ''),
                    description: item.description
                        .replace(/<\/?[^>]+(>|$)/g, '')
                        .replace(/&nbsp;/g, ' ')
                        .replace(/\s+/g, ' ')
                        .trim()
                }))
                .sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate))
                .slice(0, 12); // Showing more articles

            displayNews(filteredNews);
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
            showError('No tree-related news found from the past 3 months. Please check back later.');
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
                        <span>Source: ${article.author || article.source || article.categories?.[0] || 'Environmental News'}</span><br>
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
