const fs = require('fs').promises;
const fetch = require('node-fetch');
const path = require('path');

async function fetchRSS(url) {
    const response = await fetch(url);
    const text = await response.text();
    console.log(`Fetching from ${url}`);

    const getTagContent = (tag, xml) => {
        const match = xml.match(new RegExp(`<${tag}[^>]*>(.*?)<\/${tag}>`, 's'));
        return match ? match[1].replace(/<!\[CDATA\[|\]\]>/g, '') : '';
    };

    const getImage = (item) => {
        // Try to find image in media:content tag
        const mediaMatch = item.match(/<media:content[^>]*url="([^"]+)"/);
        if (mediaMatch) {
            console.log('Found media image:', mediaMatch[1]);
            return mediaMatch[1];
        }

        // Try to find image in content:encoded tag
        const content = getTagContent('content:encoded', item);
        const contentImgMatch = content.match(/<img.+?src=["'](.+?)["']/);
        if (contentImgMatch) {
            console.log('Found content image:', contentImgMatch[1]);
            return contentImgMatch[1];
        }

        // Try to find image in description
        const description = getTagContent('description', item);
        const descImgMatch = description.match(/<img.+?src=["'](.+?)["']/);
        if (descImgMatch) {
            console.log('Found description image:', descImgMatch[1]);
            return descImgMatch[1];
        }

        return '../images/header2.jpg';
    };

    const getItems = xml => {
        const items = [];
        const itemRegex = /<item>(.*?)<\/item>/gs;
        let match;
        
        while ((match = itemRegex.exec(xml)) !== null) {
            const item = match[1];
            const image = getImage(item);
            const sourceDomain = new URL(url).hostname;
            
            items.push({
                title: getTagContent('title', item),
                description: getTagContent('description', item),
                link: getTagContent('link', item),
                pubDate: getTagContent('pubDate', item),
                author: getTagContent('creator', item) || getTagContent('author', item),
                image: image,
                sourceName: sourceDomain.replace('www.', '')
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

const RSS_FEEDS = [
    // Global Environmental News
    'https://insideclimatenews.org/feed/',
    'https://www.theguardian.com/environment/rss',
    'https://grist.org/feed/',
    'http://feeds.bbci.co.uk/news/science_and_environment/rss.xml',

    // Australia-Based Environmental News
    'https://econews.com.au/feed/',
    'https://www.acf.org.au/blog.rss',
    'https://blog.csiro.au/category/environment/feed/'
];

        let allArticles = [];
        for (const feed of RSS_FEEDS) {
            try {
                const articles = await fetchRSS(feed);
                allArticles = allArticles.concat(articles);
            } catch (error) {
                console.error(`Error fetching ${feed}:`, error);
            }
        }

        console.log(`Found ${allArticles.length} total articles`);

        if (allArticles.length === 0) {
            throw new Error('No articles found from any feeds');
        }

        const newsData = {
            lastUpdated: new Date().toISOString(),
            articles: allArticles
                .sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate))
                .slice(0, 20)
                .map(item => ({
                    title: item.title.trim(),
                    description: item.description
                        .replace(/<\/?[^>]+(>|$)/g, '')
                        .replace(/&#8230;/g, '...')
                        .replace(/&#8217;/g, "'")
                        .substring(0, 150) + '...',
                    link: item.link,
                    pubDate: item.pubDate,
                    sourceName: item.sourceName,
                    author: item.author,
                    image: item.image
                }))
        };

        console.log('First article:', newsData.articles[0]);
        const outputPath = path.join(newsDir, 'news-data.json');
        await fs.writeFile(outputPath, JSON.stringify(newsData, null, 2));
        console.log('News data written successfully');
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

fetchNews();
