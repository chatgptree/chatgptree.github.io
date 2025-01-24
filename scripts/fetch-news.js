const fs = require('fs').promises;
const fetch = require('node-fetch');
const path = require('path');

async function extractImageFromHTML(html) {
    // Try to find the first usable image
    const imgRegex = /<img[^>]+src="([^">]+)"/g;
    const matches = [...html.matchAll(imgRegex)];
    
    for (const match of matches) {
        const url = match[1];
        if (!url.includes('avatar') && !url.includes('icon') && !url.includes('logo')) {
            return url;
        }
    }
    return null;
}

async function fetchRSS(url) {
    const response = await fetch(url);
    const text = await response.text();
    
    const getTagContent = (tag, xml) => {
        const match = xml.match(new RegExp(`<${tag}[^>]*>(.*?)<\/${tag}>`, 's'));
        return match ? match[1] : '';
    };

    const getItems = xml => {
        const items = [];
        const itemRegex = /<item>(.*?)<\/item>/gs;
        let match;
        
        while ((match = itemRegex.exec(xml)) !== null) {
            const item = match[1];
            const description = getTagContent('description', item);
            const content = getTagContent('content:encoded', item) || description;
            
            // Extract image URL
            const imageUrl = extractImageFromHTML(content) || '../images/bazzaweb2.jpg';
            
            items.push({
                title: getTagContent('title', item),
                description: description,
                link: getTagContent('link', item),
                pubDate: getTagContent('pubDate', item),
                author: getTagContent('creator', item) || getTagContent('author', item),
                image: imageUrl
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

        const RSS_URL = 'https://www.goodnewsnetwork.org/category/earth/feed/';
        const articles = await fetchRSS(RSS_URL);

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
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

fetchNews();
