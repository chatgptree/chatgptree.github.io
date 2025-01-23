// news/news.js
document.addEventListener('DOMContentLoaded', () => {
    const newsGrid = document.getElementById('newsGrid');
    const loadingIndicator = document.querySelector('.loading-indicator');
    
    const RSS_FEEDS = [
        'https://www.goodnewsnetwork.org/category/earth/feed/'
    ];

    const RSS_SOURCES = {
        'goodnewsnetwork.org': 'Good News Network'
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

            const url = new URL('https://api.rss2json.com/v1/api.json');
            url.searchParams.append('rss_url', RSS_FEEDS[0]);
            url.searchParams.append('api_key', 'yk1rva0ii4prfxqjuqwvxjz3w10vyp56h5tmlvph');
            url.searchParams.append('count', '20');

            const response = await fetch(url.toString());
            const data = await response.json();
            
            if (!data || data.status !== 'ok') {
                throw new Error('Failed to fetch news feed');
            }

            // Log the first full article to see its structure
            console.log('Sample raw article:', data.items[0]);

            const threeMonthsAgo = new Date();
            threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

            const filteredNews = data.items
                .filter(item => {
                    const pubDate = new Date(item.pubDate);
                    if (pubDate < threeMonthsAgo) return false;

                    const text = `${item.title} ${item.description}`.toLowerCase();
                    return TREE_KEYWORDS.some(keyword => 
                        text.includes(keyword.toLowerCase())
                    );
                })
                .map(item => {
                    // Log each item being processed
                    console.log('Processing item:', item);
                    return {
                        title: item.title,
                        content: item.content,
                        description: item.description,
                        link: item.link,
                        pubDate: item.pubDate,
                        image: item.thumbnail || item.enclosure?.link || null,
                        sourceName: getSourceName(RSS_FEEDS[0]),
                        author: item.author,
                        categories: item.categories
                    };
                });

            console.log('Processed articles:', filteredNews);
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
            // Clean up description - try content if description is empty
            let cleanDescription = '';
            const rawContent = article.description || article.content || '';
            
            // Remove HTML tags and clean up the text
            cleanDescription = rawContent
                .replace(/<\/?[^>]+(>|$)/g, '')
                .replace(/&nbsp;/g, ' ')
                .replace(/\s+/g, ' ')
                .trim();

            // Limit description length
            if (cleanDescription.length > 150) {
                cleanDescription = cleanDescription.substring(0, 150) + '...';
            }

            return `
                <article class="news-card">
                    ${article.image ? `
                        <div class="news-image">
                            <img src="${article.image}" 
                                 alt="${article.title}"
                                 onerror="this.onerror=null; this.src='${DEFAULT_IMAGE}';">
                        </div>
                    ` : ''}
                    <div class="news-content">
                        <div class="news-meta">
                            <span>Source: ${article.sourceName}</span>
                            ${article.author ? `<span> | By ${article.author}</span>` : ''}
                            <br>
                            <span>Published: ${new Date(article.pubDate).toLocaleDateString()}</span>
                        </div>
                        <h3>${article.title}</h3>
                        <div class="news-description">
                            ${cleanDescription || 'No description available'}
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
