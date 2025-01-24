document.addEventListener('DOMContentLoaded', async () => {
    const newsGrid = document.getElementById('newsGrid');
    const loadingIndicator = document.querySelector('.loading-indicator');
    const DEFAULT_IMAGE = '../images/bazzaweb2.jpg';

    async function loadNews() {
        try {
            loadingIndicator.classList.add('active');
            newsGrid.style.display = 'none';

            const response = await fetch('./news-data.json');
            const data = await response.json();

            if (data.articles) {
                const html = data.articles.map(article => `
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
                            <h3>${article.title}</h3>
                            <p>${article.description}</p>
                            <a href="${article.link}" 
                               target="_blank" 
                               rel="noopener noreferrer" 
                               class="read-more">
                                Read Full Article →
                            </a>
                        </div>
                    </article>
                `).join('');

                newsGrid.innerHTML = html;

                if (data.lastUpdated) {
                    document.getElementById('lastUpdated').textContent = 
                        `Last updated: ${new Date(data.lastUpdated).toLocaleString()}`;
                }
            }
        } catch (error) {
            console.error('Error:', error);
            newsGrid.innerHTML = `<p style="color: red; padding: 20px;">Error loading news: ${error.message}</p>`;
        } finally {
            loadingIndicator.classList.remove('active');
            newsGrid.style.display = 'grid';
        }
    }

    loadNews();
});
