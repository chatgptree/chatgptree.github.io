const fs = require('fs').promises;
const fetch = require('node-fetch');
const path = require('path');

async function ensureDirectoryExists(dirPath) {
    try {
        await fs.access(dirPath);
    } catch {
        await fs.mkdir(dirPath, { recursive: true });
        console.log(`Created directory: ${dirPath}`);
    }
}

async function fetchNews() {
    try {
        const newsDir = path.join(__dirname, '../news');
        await ensureDirectoryExists(newsDir);
        console.log('Fetching news...');

        const response = await fetch('https://api.rss2json.com/v1/api.json', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                rss_url: 'https://www.goodnewsnetwork.org/category/earth/feed/',
                api_key: process.env.RSS2JSON_API_KEY,
                count: 20
            })
        });

        const data = await response.json();
        console.log('API Response:', JSON.stringify(data, null, 2));

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
        console.log(`News data written to ${outputPath}`);
        console.log(`Found ${newsData.articles.length} articles`);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

fetchNews();
