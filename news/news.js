document.addEventListener('DOMContentLoaded', () => {
    const newsGrid = document.getElementById('newsGrid');
    const loadingIndicator = document.querySelector('.loading-indicator');
    
    const DEFAULT_IMAGE = '../images/bazzaweb2.jpg';

    async function loadNews() {
        try {
            loadingIndicator.classList.add('active');
            newsGrid.style.display = 'none';

            const response = await fetch('news-data.json');
            const data = await response.json();

            displayNews(data.articles);
            
            // Show last updated time
            const lastUpdated = new Date(data.lastUpdated);
            document.getElementById('lastUpdated').textContent = 
                `Last updated: ${lastUpdated.toLocaleString()}`;
        } catch (error) {
            console.error('Error loading news:', error);
            showError('Unable to load news. Please try again later.');
        } finally {
            loadingIndicator.classList.remove('active');
            newsGrid.style.display = 'grid';
        }
    }

    function displayNews(articles) {
        if (!articles || articles.length === 0) {
            showError('No news available at the moment.');
            return;
        }

        newsGrid.innerHTML = articles.map(article => `
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
                        ${article.description}
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

    // Load news on page load
    loadNews();

    // Optional: Refresh content periodically
    setInterval(loadNews, 5 * 60 * 1000); // Refresh every 5 minutes
});
