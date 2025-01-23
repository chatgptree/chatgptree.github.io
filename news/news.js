// news/news.js
document.addEventListener('DOMContentLoaded', () => {
    const newsGrid = document.getElementById('newsGrid');
    const loadingIndicator = document.querySelector('.loading-indicator');
    
    // Reduced feed list for testing
    const RSS_FEEDS = [
        'https://www.goodnewsnetwork.org/category/earth/feed/',
        'https://www.positive.news/environment/feed/',
        'https://www.treehugger.com/feed'
    ];

    const RSS_SOURCES = {
        'goodnewsnetwork.org': 'Good News Network',
        'positive.news': 'Positive News',
        'treehugger.com': 'Treehugger'
    };

    const DEFAULT_IMAGE = '../images/bazzaweb2.jpg';

    const TREE_KEYWORDS = ['tree', 'forest', 'woodland', 'rainforest'];

    function getSourceName(url) {
        try {
            const domain = new URL(url).hostname.replace('www.', '');
            return RSS_SOURCES[domain] || domain;
        } catch (error) {
            return 'Environmental News';
        }
    }

    async function fetchNews() {
        try {
            loadingIndicator.classList.add('active');
            newsGrid.style.display = 'none';

            let allNews = [];
            for (const feed of RSS_FEEDS) {
                try {
                    const url = new URL('https://api.rss2json.com/v1/api.json');
                    url.searchParams.append('rss_url', feed);
                    url.searchParams.append('api_key', 'yk1rva0ii4prfxqjuqwvxjz3w10vyp56h5tmlvph');
                    url.searchParams.append('count', '10');

                    const response = await fetch(url);
                    const data = await response.json();
                    
                    if (data.status === 'ok' && data.items?.length > 0) {
                        // Log first item to see structure
                        console.log('Sample article from ' + feed + ':', data.items[0]);
                        
                        const items = data.items.map(item => {
                            // Clean and validate content
                            const cleanedItem = {
                                ...item,
                                title: item.title || 'No Title',
                                description: item.description || item.content || 'No description available',
                                link: item.link || '#',
                                pubDate: item.pubDate || new Date().toISOString(),
                                thumbnail: item.thumbnail || item.enclosure?.link || null,
                                sourceName: getSourceName(feed)
                            };
                            
                            // Log cleaned item
                            console.log('Cleaned item:', cleanedItem);
                            
                            return cleanedItem;
                        });
                        allNews = allNews.concat(items);
                    }
                } catch (e) {
                    console.error('Error fetching feed:', feed, e);
                }
            }

            const threeMonthsAgo = new Date();
            threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

            const filteredNews = allNews
                .filter(item => {
                    const pubDate = new Date(item.pubDate);
                    if (pubDate < threeMonthsAgo) return false;

                    const text = `${item.title} ${item.description}`.toLowerCase();
                    return TREE_KEYWORDS.some(keyword => 
                        text.includes(keyword.toLowerCase())
                    );
                })
                .map(item => ({
                    ...item,
                    description: item.description
                        .replace(/<\/?[^>]+(>|$)/g, '')
                        .replace(/&nbsp;/g, ' ')
                        .replace(/\s+/g, ' ')
                        .trim()
                        .substring(0, 150) + '...'
                }))
                .sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate))
                .slice(0, 6);

            console.log('Final filtered articles:', filteredNews);
            displayNews(filteredNews);
        } catch (error) {
            console.error('Detailed error:', error);
            showError(`Unable to load news. Please try again.`);
        } finally {
            loadingIndicator.classList.remove('active');
            newsGrid.style.display = 'grid';
        }
    }

    function displayNews(articles) {
        if (articles.length === 0) {
            showError('No news found. Please try again later.');
            return;
        }

        newsGrid.innerHTML = articles.map(article => {
            // Log each article as it's being rendered
            console.log('Rendering article:', article);
            
            return `
                <article class="news-card">
                    ${article.thumbnail ? `
                        <div class="news-image">
                            <img src="${article.thumbnail}" 
                                 alt="${article.title}"
                                 onerror="this.onerror=null; this.src='${DEFAULT_IMAGE}';">
                        </div>
                    ` : ''}
                    <div class="news-content">
                        <div class="news-meta">
                            <span>Source: ${article.sourceName}</span><br>
                            <span>Published: ${new Date(article.pubDate).toLocaleDateString()}</span>
                        </div>
                        <h3>${article.title || 'Untitled'}</h3>
                        <div class="news-description">
                            ${article.description || 'No description available'}
                        </div>
                        <a href="${article.link}" target="_blank" rel="noopener noreferrer" class="read-more">
                            Read Full Article →
                        </a>
                    </div>
                </article>
            `;
        }).join('');
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
