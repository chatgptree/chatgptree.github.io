const fs = require('fs').promises;
const fetch = require('node-fetch');
const path = require('path');

async function fetchRSS(url) {
    const response = await fetch(url);
    const text = await response.text();
    
    // Log first item for debugging
    console.log('Raw feed sample:', text.substring(0, 2000));
    
    const getTagContent = (tag, xml) => {
        const match = xml.match(new RegExp(`<${tag}[^>]*>(.*?)<\/${tag}>`, 's'));
        return match ? match[1] : '';
    };

    const getImage = (item) => {
        console.log('Processing item:', item.substring(0, 500));
        
        // Check for img tags in description
        const description = getTagContent('description', item);
        console.log('Description content:', description.substring(0, 200));
        
        const imgMatch = description.match(/<img[^>]*src=["']([^"']+)["']/);
        if (imgMatch) {
            console.log('Found image in description:', imgMatch[1]);
            return imgMatch[1];
        }
        
        return '../images/bazzaweb2.jpg';
    };

    const getItems = xml => {
        const items = [];
        const itemRegex = /<item>(.*?)<\/item>/gs;
        let match;
        
        while ((match = itemRegex.exec(xml)) !== null) {
            const item = match[1];
            const image = getImage(item);
            items.push({
                title: getTagContent('title', item),
                description: getTagContent('description', item),
                link: getTagContent('link', item),
                pubDate: getTagContent('pubDate', item),
                author: getTagContent('creator', item) || getTagContent('author', item),
                image: image
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
