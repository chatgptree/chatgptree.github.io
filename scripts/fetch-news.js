const fs = require('fs').promises;
const fetch = require('node-fetch');
const path = require('path');

async function fetchNews() {
    try {
        const newsDir = path.join(__dirname, '../news');
        await fs.mkdir(newsDir, { recursive: true });
        console.log('Fetching news...');

        const url = new URL('https://api.rss2json.com/v1/api.json');
        url.searchParams.append('rss_url', 'https://www.goodnewsnetwork.org/category/earth/feed/');
        url.searchParams.append('api_key', process.env.RSS2JSON_API_KEY);
        url.searchParams.append('count', '20');

        console.log('Fetching from URL:', url.toString());
        const response = await fetch(url);
        const data = await response.json();
        console.log('API Response status:', data.status);

        if (!data.items || !data.items.length) {
            throw new Error('No items in API response');
        }

        const newsData = {
            lastUpdated: new Date().toISOString(),
            articles: data.items.map(item => ({
                title: item.title,
                description: item.description
                    .replace(/<\/?[^>]+(>|$)/g, '')
                    .substring(0, 150) + '...',
                link: item.link,
                pubDate: item.pubDate,
                image: item.thumbnail || item.enclosure?.link,
                sourceName: 'Good News Network',
                author: item.author
            }))
        };

        const outputPath = path.join(newsDir, 'news-data.json');
        await fs.writeFile(outputPath, JSON.stringify(newsData, null, 2));
        console.log(`Found ${newsData.articles.length} articles`);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

fetchNews();
