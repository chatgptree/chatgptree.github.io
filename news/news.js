'use strict';

document.addEventListener('DOMContentLoaded', () => {
    // Check browser compatibility
    if (!window.fetch || !window.URL) {
        showError('Your browser may not support all features. Please update your browser.');
        return;
    }

    const newsGrid = document.getElementById('newsGrid');
    const loadingIndicator = document.querySelector('.loading-indicator');
    const errorContainer = document.getElementById('errorContainer');
    
    const RSS_FEEDS = [
        'https://www.goodnewsnetwork.org/category/earth/feed/'
    ];

    const RSS_SOURCES = {
        'goodnewsnetwork.org': 'Good News Network'
    };

    const DEFAULT_IMAGE = '../images/bazzaweb2.jpg';
    const TREE_KEYWORDS = ['tree', 'forest', 'woodland', 'rainforest'];
    const API_TIMEOUT = 10000; // 10 seconds

    function getSourceName(url) {
        try {
            const domain = new URL(url).hostname.replace('www.', '');
            return RSS_SOURCES[domain] || domain;
        } catch (error) {
            console.error('Error parsing URL:', error);
            return 'Environmental News';
        }
    }

    async function fetchNews() {
        // Check network connectivity
        if (!navigator.onLine) {
            showError('No internet connection. Please check your connection and try again.');
            return;
        }

        try {
            loadingIndicator.classList.add('active');
            newsGrid.style.display = 'none';

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT);

            const url = new URL('https://api.rss2json.com/v1/api.json');
            url.searchParams.append('rss_url', RSS_FEEDS[0]);
            url.searchParams.append('api_key', 'yk1rva0ii4prfxqjuqwvxjz3w10vyp56h5tmlvph');
            url.searchParams.append('count', '20');

            const response = await fetch(url.toString(), {
                signal: controller.signal
            });
            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            
            if (!data || data.status !== 'ok') {
                throw new Error('Invalid data received from RSS feed');
            }

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
                .map(item => ({
                    title: item.title || 'Untitled',
                    content: item.content || '',
                    description: item.description || '',
                    link: item.link || '#',
                    pubDate: item.pubDate || new Date().toISOString(),
                    image: item.thumbnail || item.enclosure?.link || null,
                    sourceName: getSourceName(RSS_FEEDS[0]),
                    author: item.author || '',
                    categories: item.categories || []
                }));

            displayNews(filteredNews);

        } catch (error) {
            console.error('Fetch error:', error);
            if (error.name === 'AbortError') {
                showError('Request timed out. Please try again.');
            } else {
                showError(`Unable to load news: ${error.message}`);
            }
        } finally {
            loadingIndicator.classList.remove('active');
            newsGrid.style.display = 'grid';
        }
    }

    function displayNews(articles) {
        if (!Array.isArray(articles) || articles.length === 0) {
            showError('No news found. Please try again later.');
            return;
        }

        try {
            newsGrid.innerHTML = articles.map(article => {
                let cleanDescription = '';
                try {
                    const rawContent = article.description || article.content || '';
                    cleanDescription = rawContent
                        .replace(/<\/?[^>]+(>|$)/g, '')
                        .replace(/&nbsp;/g, ' ')
                        .replace(/\s+/g, ' ')
                        .trim();

                    if (cleanDescription.length > 150) {
                        cleanDescription = cleanDescription.substring(0, 150) + '...';
                    }
                } catch (e) {
                    console.error('Error cleaning description:', e);
                    cleanDescription = 'Description unavailable';
                }

                return `
                    <article class="news-card">
                        ${article.image ? `
                            <div class="news-image">
                                <img src="${article.image}" 
                                     alt="${article.title}"
                                     loading="lazy"
                                     onerror="this.onerror=null; this.src='${DEFAULT_IMAGE}';">
                            </div>
                        ` : ''}
                        <div class="news-content">
                            <div class="news-meta">
                                <span class="source">Source: ${article.sourceName}</span>
                                ${article.author ? `<span class="author"> | By ${article.author}</span>` : ''}
                                <br>
                                <span class="date">Published: ${new Date(article.pubDate).toLocaleDateString()}</span>
                            </div>
                            <h3 class="title">${article.title}</h3>
                            <div class="news-description">
                                ${cleanDescription || 'No description available'}
                            </div>
                            <a href="${article.link}" 
                               target="_blank" 
                               rel="noopener noreferrer" 
                               class="read-more"
                               aria-label="Read full article about ${article.title}">
                                Read Full Article →
                            </a>
                        </div>
                    </article>
                `;
            }).join('');

        } catch (error) {
            console.error('Error displaying news:', error);
            showError('Error displaying news items');
        }
    }

    function showError(message) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message active';
        errorDiv.textContent = message;
        
        // Clear existing content
        newsGrid.innerHTML = '';
        errorContainer.innerHTML = '';
        
        // Add error message
        errorContainer.appendChild(errorDiv);
    }

    // Add offline/online handlers
    window.addEventListener('online', fetchNews);
    window.addEventListener('offline', () => {
        showError('Your device appears to be offline. Please check your connection.');
    });

    // Initial fetch
    fetchNews();

    // Refresh every hour
    setInterval(fetchNews, 60 * 60 * 1000);
});
