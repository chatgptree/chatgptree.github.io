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
        // Try to find featured image
        const mediaContent = item.match(/<media:content[^>]*url="([^"]*)"[^>]*type="image\/[^"]*"[^>]*>/);
        if (mediaContent) return mediaContent[1];

        // Look for og:image meta tag in content
        const ogImage = item.match(/<meta property="og:image" content="([^"]*)">/);
        if (ogImage) return ogImage[1];

        // Find first image in content:encoded
        const contentEncoded = getTagContent('content:encoded', item);
        if (contentEncoded) {
            const imgMatch = contentEncoded.match(/<img[^>]*data-orig-file="([^"]*)"[^>]*>/);
            if (imgMatch) return imgMatch[1];
        }

        // Look for image in description
        const description = getTagContent('description', item);
        const descImg = description.match(/<img[^>]*src="([^"]*)"[^>]*>/);
        if (descImg && !descImg[1].includes('avatar')) return descImg[1];

        // Default image if nothing found
        return '../images/bazzaweb2.jpg';
    };

    const getItems = xml => {
        const items = [];
        const itemRegex = /<item>(.*?)<\/item>/gs;
        let match;
        
        while ((match = itemRegex.exec(xml)) !== null) {
            const item = match[1];
            const image = getImage(item);
            console.log('Found image URL:', image);
            
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

        console.log('First article:', {
            title: newsData.articles[0].title,
            image: newsData.articles[0].image
        });

        const outputPath = path.join(newsDir, 'news-data.json');
        await fs.writeFile(outputPath, JSON.stringify(newsData, null, 2));
        console.log('News data written successfully');
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

fetchNews();
