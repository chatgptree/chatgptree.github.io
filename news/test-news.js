document.addEventListener('DOMContentLoaded', async () => {
    const newsGrid = document.getElementById('newsGrid');
    const loadingIndicator = document.querySelector('.loading-indicator');
    const errorContainer = document.getElementById('errorContainer');
    const loadMoreButton = document.getElementById('loadMore');
    const DEFAULT_IMAGE = '../images/bazzaweb2.jpg';
    let currentPage = 1;
    const articlesPerPage = 6;

    function estimateReadingTime(text) {
        const wordsPerMinute = 200;
        const words = text.trim().split(/\s+/).length;
        return Math.ceil(words / wordsPerMinute);
    }

    function getCategories(title, description) {
        const keywords = ['environment', 'climate', 'conservation', 'forest', 'biodiversity', 'sustainability'];
        const text = (title + ' ' + description).toLowerCase();
        return keywords.filter(keyword => text.includes(keyword));
    }

    function createShareButtons(article) {
        const encodedUrl = encodeURIComponent(article.link);
        const encodedTitle = encodeURIComponent(article.title);
        
        return `
            <div class="share-buttons">
                <a href="https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}" 
                   class="share-button" target="_blank" rel="noopener noreferrer">
                    <i class="fab fa-twitter"></i>
                </a>
                <a href="https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}" 
                   class="share-button" target="_blank" rel="noopener noreferrer">
                    <i class="fab fa-facebook"></i>
                </a>
                <a href="https://www.linkedin.com/shareArticle?url=${encodedUrl}&title=${encodedTitle}" 
                   class="share-button" target="_blank" rel="noopener noreferrer">
                    <i class="fab fa-linkedin"></i>
                </a>
            </div>
        `;
    }

    async function loadNews(page = 1) {
        try {
            loadingIndicator.classList.add('active');
            if (page === 1) {
                newsGrid.innerHTML = '';
            }

            const response = await fetch('./news-data.json');
            const data = await response.json();

            if (data.articles) {
                const start = (page - 1) * articlesPerPage;
                const end = start + articlesPerPage;
                const pageArticles = data.articles.slice(start, end);

                const html = pageArticles.map(article => {
                    const readingTime = estimateReadingTime(article.description);
                    const categories = getCategories(article.title, article.description);
                    
                    return `
                        <article class="news-card">
                            <div class="news-image">
                                <img src="${article.image || DEFAULT_IMAGE}" 
                                     alt="${article.title}"
                                     onerror="this.onerror=null; this.src='${DEFAULT_IMAGE}';"
                                     loading="lazy">
                            </div>
                            <div class="news-content">
                                <div class="news-meta">
                                    <span>Source: ${article.sourceName}</span>
                                    ${article.author ? `<span> | By ${article.author.trim()}</span>` : ''}
                                    <br>
                                    <span>Published: ${new Date(article.pubDate).toLocaleDateString()}</span>
                                </div>
                                <div class="news-categories">
                                    ${categories.map(cat => `<span class="category-tag">${cat}</span>`).join('')}
                                </div>
                                <h3>${article.title}</h3>
                                <p class="news-description">${article.description}</p>
                                <div class="reading-time">
                                    <i class="fa-regular fa-clock"></i> ${readingTime} min read
                                </div>
                                ${createShareButtons(article)}
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

                if (page === 1) {
                    newsGrid.innerHTML = html;
                } else {
                    newsGrid.insertAdjacentHTML('beforeend', html);
                }

                loadMoreButton.style.display = end < data.articles.length ? 'block' : 'none';

                if (data.lastUpdated) {
                    document.getElementById('lastUpdated').textContent = 
                        `Last updated: ${new Date(data.lastUpdated).toLocaleString()}`;
                }
            }
        } catch (error) {
            console.error('Error:', error);
            errorContainer.innerHTML = `<p>Error loading news: ${error.message}</p>`;
            errorContainer.classList.add('active');
        } finally {
            loadingIndicator.classList.remove('active');
        }
    }

    // Search functionality
    const searchInput = document.querySelector('.search-input');
    searchInput.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        const articles = document.querySelectorAll('.news-card');
        
        articles.forEach(article => {
            const title = article.querySelector('h3').textContent.toLowerCase();
            const description = article.querySelector('.news-description').textContent.toLowerCase();
            const isVisible = title.includes(searchTerm) || description.includes(searchTerm);
            article.style.display = isVisible ? 'flex' : 'none';
        });
    });

    // Load More functionality
    loadMoreButton.addEventListener('click', () => {
        currentPage++;
        loadNews(currentPage);
    });

    // Initial load
    loadNews();
});
