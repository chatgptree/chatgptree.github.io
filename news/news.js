// news/news.js
document.addEventListener('DOMContentLoaded', () => {
    const newsGrid = document.getElementById('newsGrid');
    const loadingIndicator = document.querySelector('.loading-indicator');
    
    // Combined list of all feeds - reduced for initial load speed
    const RSS_FEEDS = [
        'https://www.goodnewsnetwork.org/category/earth/feed/',
        'https://www.positive.news/environment/feed/',
        'https://www.treehugger.com/feed',
        'https://news.mongabay.com/feed/',
        'https://www.sciencedaily.com/rss/earth_climate/trees.xml'
    ];

    const RSS_SOURCES = {
        'goodnewsnetwork.org': 'Good News Network',
        'positive.news': 'Positive News',
        'treehugger.com': 'Treehugger',
        'mongabay.com': 'Mongabay News',
        'sciencedaily.com': 'ScienceDaily'
    };

    const DEFAULT_IMAGE = '../images/bazzaweb2.jpg';

    // Simplified keywords for better matching
    const TREE_KEYWORDS = [
        'tree', 'forest', 'woodland', 'rainforest',
        'reforestation', 'conservation', 'planting'
    ];

    function getSourceName(url) {
        try {
            const domain = new URL(url).hostname.replace('www.', '');
            return RSS_SOURCES[domain] || domain;
        } catch (error) {
            console.error('Error getting source name:', error);
            return 'Environmental News';
        }
    }

    async function fetchNews() {
        try {
            loadingIndicator.classList.add('active');
            newsGrid.style.display = 'none';

            // Try to fetch from each feed sequentially instead of all at once
            let allNews = [];
            for (const feed of RSS_FEEDS) {
                try {
                    console.log('Fetching:', feed);
                    const url = new URL('https://api.rss2json.com/v1/api.json');
                    url.searchParams.append('rss_url', feed);
                    url.searchParams.append('api_key', 'yk1rva0ii4prfxqjuqwvxjz3w10vyp56h5tmlvph');
                    url.searchParams.append('count', '10'); // Reduced for mobile

                    const response = await fetch(url);
                    console.log('Response status:', response.status);
                    const data = await response.json();
                    console.log('Feed data received:', feed);
                    
                    if (data.status === 'ok' && data.items?.length > 0) {
                        const items = data.items.map(item => ({
                            ...item,
                            sourceName: getSourceName(feed)
                        }));
                        allNews = allNews.concat(items);
                    }
                } catch (e) {
                    console.error('Error fetching feed:', feed, e);
                }
            }

            console.log('Total news items fetched:', allNews.length);

            const threeMonthsAgo = new Date();
            threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

            const filteredNews = allNews
                .filter(item => {
                    try {
                        const pubDate = new Date(item.pubDate);
                        if (pubDate < threeMonthsAgo) return false;

                        const text = `${item.title} ${item.description}`.toLowerCase();
                        return TREE_KEYWORDS.some(keyword => 
                            text.includes(keyword.toLowerCase())
                        );
                    } catch (error) {
                        console.error('Error filtering item:', error);
                        return false;
                    }
                })
                .map(item => ({
                    ...item,
                    link: item.link.replace(/\?.*$/, ''),
                    description: item.description
                        ? item.description
                            .replace(/<\/?[^>]+(>|$)/g, '')
                            .replace(/&nbsp;/g, ' ')
                            .replace(/\s+/g, ' ')
                            .trim()
                        : 'No description available'
                }))
                .sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate))
                .slice(0, 6); // Reduced for mobile

            console.log(`Found ${filteredNews.length} tree-related articles`);
            
            if (filteredNews.length === 0) {
                throw new Error('No articles found');
            }

            displayNews(filteredNews);
        } catch (error) {
            console.error('Detailed error:', error);
            showError(`Unable to load news. Please check your connection and try again.`);
        } finally {
            loadingIndicator.classList.remove('active');
            newsGrid.style.display = 'grid';
        }
    }

    function displayNews(articles) {
        if (articles.length === 0) {
            showError('No tree-related news found. Please try again later.');
            return;
        }

        newsGrid.innerHTML = articles.map(article => `
            <article class="news-card">
                ${article.thumbnail || article.enclosure?.link ? `
                    <div class="news-image">
                        <img src="${article.thumbnail || article.enclosure?.link}" 
                             alt="${article.title}"
                             onerror="this.onerror=null; this.src='${DEFAULT_IMAGE}';">
                    </div>
                ` : ''}
                <div class="news-content">
                    <div class="news-meta">
                        <span>Source: ${article.sourceName}</span><br>
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
    fetchNews().catch(error => {
        console.error('Failed to fetch news:', error);
        showError('Failed to load news. Please try again later.');
    });

    // Refresh every hour
    setInterval(() => {
        fetchNews().catch(error => {
            console.error('Failed to refresh news:', error);
        });
    }, 60 * 60 * 1000);
});
