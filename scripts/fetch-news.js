const fs = require('fs').promises;
const fetch = require('node-fetch');
const path = require('path');

async function fetchRSS(url) {
    const response = await fetch(url);
    const text = await response.text();
    
    const getTagContent = (tag, xml) => {
        const match = xml.match(new RegExp(`<${tag}[^>]*>(.*?)<\/${tag}>`, 's'));
        return match ? match[1] : '';
    };

    const getImage = (item) => {
        // Try to find image in media:content tag
        const mediaMatch = item.match(/<media:content[^>]*url="([^"]*)"[^>]*>/);
        if (mediaMatch) return mediaMatch[1];

        // Try to find image in enclosure tag
        const enclosureMatch = item.match(/<enclosure[^>]*url="([^"]*)"[^>]*>/);
        if (enclosureMatch) return enclosureMatch[1];

        // Try to find first image in content
        const imgMatch = item.match(/<img[^>]*src="([^"]*)"[^>]*>/);
        if (imgMatch) return imgMatch[1];

        return null;
    };

    const getItems = xml => {
        const items = [];
        const itemRegex = /<item>(.*?)<\/item>/gs;
        let match;
        while ((match = itemRegex.exec(xml)) !== null) {
            const item = match[1];
            items.push({
                title: getTagContent('title', item),
                description: getTagContent('description', item),
                link: getTagContent('link', item),
                pubDate: getTagContent('pubDate', item),
                author: getTagContent('creator', item) || getTagContent('author', item),
                image: getImage(item)
            });
        }
        return items;
    };

    return getItems(text);
}

async function fetchNews() {
    try {
        const newsDir = path.join(__dirname, '../news');
        await fs.mkdir(newsDir, { recursive: true });
        console.log('Fetching news...');

        const RSS_URL = 'https://www.goodnewsnetwork.org/category/earth/feed/';
        const articles = await fetchRSS(RSS_URL);
        console.log(`Found ${articles.length} articles`);

        const newsData = {
            lastUpdated: new Date().toISOString(),
            articles: articles.slice(0, 20).map(item => ({
                title: item.title.trim(),
                description: item.description
                    .replace(/<\/?[^>]+(>|$)/g, '')
                    .replace(/&#8230;/g, '...')
                    .replace(/&#8217;/g, "'")
                    .substring(0, 150) + '...',
                link: item.link,
                pubDate: item.pubDate,
                sourceName: 'Good News Network',
                author: item.author,
                image: item.image
            }))
        };

        const outputPath = path.join(newsDir, 'news-data.json');
        await fs.writeFile(outputPath, JSON.stringify(newsData, null, 2));
        console.log('News data written successfully');
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

fetchNews();
