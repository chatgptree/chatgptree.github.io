document.addEventListener('DOMContentLoaded', () => {
    const newsGrid = document.getElementById('newsGrid');
    const loadingIndicator = document.querySelector('.loading-indicator');
    
    const DEFAULT_IMAGE = '/images/bazzaweb2.jpg';

    async function loadNews() {
        try {
            // Show loading state
            if (loadingIndicator) loadingIndicator.classList.add('active');
            if (newsGrid) newsGrid.style.display = 'none';

            // Fetch with explicit path
            const response = await fetch('./news-data.json');
            if (!response.ok) {
                throw new Error(`Failed to fetch news (${response.status})`);
            }

            const data = await response.json();
            
            // Validate data
            if (!data || !data.articles) {
                throw new Error('Invalid news data format');
            }

            // Display news
            displayNews(data.articles);
            
            // Update timestamp
            const lastUpdatedElement = document.getElementById('lastUpdated');
            if (lastUpdatedElement && data.lastUpdated) {
                const lastUpdated = new Date(data.lastUpdated);
                lastUpdatedElement.textContent = `Last updated: ${lastUpdated.toLocaleString()}`;
            }

        } catch (error) {
            console.error('Error loading news:', error);
            showError(`Unable to load news: ${error.message}`);
        } finally {
            // Reset UI state
            if (loadingIndicator) loadingIndicator.classList.remove('active');
            if (newsGrid) newsGrid.style.display = 'grid';
        }
    }

    function displayNews(articles) {
        if (!newsGrid) {
            console.error('News grid element not found');
            return;
        }

        if (!articles || articles.length === 0) {
            showError('No news available at the moment.');
            return;
        }

        const newsHTML = articles.map(article => {
            // Clean up author string
            const author = article.author ? article.author.trim() : '';
            
            return `
                <article class="news-card">
                    <div class="news-image">
                        <img src="${article.image || DEFAULT_IMAGE}" 
                             alt="${article.title}"
                             loading="lazy"
                             onerror="this.onerror=null; this.src='${DEFAULT_IMAGE}';">
                    </div>
                    <div class="news-content">
                        <div class="news-meta">
                            <span>Source: ${article.sourceName}</span>
                            ${author ? `<span> | By ${author}</span>` : ''}
                            <br>
                            <span>Published: ${new Date(article.pubDate).toLocaleDateString()}</span>
                        </div>
                        <h3>${article.title}</h3>
                        <div class="news-description">
                            ${article.description}
                        </div>
                        <a href="${article.link}" 
                           target="_blank" 
                           rel="noopener noreferrer" 
                           class="read-more">
                            Read Full Article →
                        </a>
                    </div>
                </article>
            `;
        }).join('');

        newsGrid.innerHTML = newsHTML;
    }

    function showError(message) {
        if (!newsGrid) return;
        
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message active';
        errorDiv.textContent = message;
        
        newsGrid.innerHTML = '';
        newsGrid.appendChild(errorDiv);
        
        // Make error visible
        errorDiv.style.display = 'block';
        errorDiv.style.padding = '20px';
        errorDiv.style.margin = '20px';
        errorDiv.style.backgroundColor = '#ffebee';
        errorDiv.style.color = '#c62828';
        errorDiv.style.borderRadius = '4px';
    }

    // Initial load
    loadNews().catch(error => {
        console.error('Failed to load news:', error);
        showError('Failed to load news. Please try again later.');
    });

    // Refresh every 5 minutes
    setInterval(() => {
        loadNews().catch(error => {
            console.error('Failed to refresh news:', error);
        });
    }, 5 * 60 * 1000);
});
