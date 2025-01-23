// news/news.js
document.addEventListener('DOMContentLoaded', () => {
    const newsGrid = document.getElementById('newsGrid');
    const loadingIndicator = document.querySelector('.loading-indicator');
    
    // List of RSS feeds focused on environmental news
    const RSS_FEEDS = [
        'https://phys.org/rss-feed/earth-news/environment/earth-sciences/',
        'https://www.sciencedaily.com/rss/earth_climate/nature.xml',
        'https://climate.nasa.gov/feed/news/',
        // You can add more feeds here
    ];

    async function fetchRSSFeed(url) {
        try {
            const response = await fetch(`https://cors-anywhere.herokuapp.com/${url}`);
            const textData = await response.text();
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(textData, 'text/xml');
            
            // Extract items from RSS feed
            const items = xmlDoc.querySelectorAll('item');
            return Array.from(items).map(item => ({
                title: item.querySelector('title')?.textContent || '',
                description: item.querySelector('description')?.textContent || '',
                link: item.querySelector('link')?.textContent || '',
                pubDate: item.querySelector('pubDate')?.textContent || '',
                source: xmlDoc.querySelector('channel > title')?.textContent || 'News Source'
            }));
        } catch (error) {
            console.error(`Error fetching RSS feed ${url}:`, error);
            return [];
        }
    }

    function cleanHTML(html) {
        const div = document.createElement('div');
        div.innerHTML = html;
        return div.textContent || div.innerText || '';
    }

    async function fetchAllNews() {
        try {
            loadingIndicator.classList.add('active');
            newsGrid.style.display = 'none';

            // Fetch all feeds concurrently
            const allNewsPromises = RSS_FEEDS.map(feed => fetchRSSFeed(feed));
            const allNewsArrays = await Promise.all(allNewsPromises);
            
            // Combine all news items
            let allNews = allNewsArrays.flat();

            // Filter for tree-related content
            allNews = allNews.filter(item => {
                const text = `${item.title} ${item.description}`.toLowerCase();
                return text.includes('tree') || 
                       text.includes('forest') || 
                       text.includes('woodland');
            });

            // Sort by date
            allNews.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));

            // Take most recent items
            allNews = allNews.slice(0, 9);

            displayNews(allNews);
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
                    <span>${article.source}</span><br>
                    <span>Published: ${new Date(article.pubDate).toLocaleDateString()}</span>
                </div>
                <h3>${cleanHTML(article.title)}</h3>
                <div class="news-description">
                    ${cleanHTML(article.description).length > 150 ? 
                      cleanHTML(article.description).substring(0, 150) + '...' : 
                      cleanHTML(article.description)}
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
    fetchAllNews();

    // Refresh every hour
    setInterval(fetchAllNews, 60 * 60 * 1000);
});
