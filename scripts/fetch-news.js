const fs = require('fs').promises;
const fetch = require('node-fetch');
const path = require('path');

const RSS_FEEDS = [
    'https://www.goodnewsnetwork.org/category/earth/feed/',
    'https://www.positive.news/environment/feed/',
    'https://www.treehugger.com/feed',
    'https://forestsnews.cifor.org/feed',
    'https://www.nature.org/en-us/feed/news/',
    'https://www.conservation.org/blog/feed',
    'https://www.rainforest-alliance.org/feed/',
    'https://www.worldwildlife.org/feed',
    'https://news.mongabay.com/feed/',
    'https://www.sciencedaily.com/rss/earth_climate/trees.xml',
    'https://www.ecowatch.com/feeds/latest.rss',
    'https://grist.org/feed/'
];

const RSS_SOURCES = {
    'goodnewsnetwork.org': 'Good News Network',
    'positive.news': 'Positive News',
    'treehugger.com': 'Treehugger',
    'forestsnews.cifor.org': 'CIFOR Forest News',
    'nature.org': 'The Nature Conservancy',
    'conservation.org': 'Conservation International',
    'rainforest-alliance.org': 'Rainforest Alliance',
    'worldwildlife.org': 'World Wildlife Fund',
    'mongabay.com': 'Mongabay News',
    'sciencedaily.com': 'ScienceDaily',
    'ecowatch.com': 'EcoWatch',
    'grist.org': 'Grist'
};

const TREE_KEYWORDS = [
    'tree', 'forest', 'woodland', 'rainforest',
    'reforestation', 'afforestation', 'planting',
    'conservation', 'biodiversity', 'ecosystem'
];

function getSourceName(url) {
    try {
        const domain = new URL(url).hostname.replace('www.', '');
        return RSS_SOURCES[domain] || domain;
    } catch {
        return 'Environmental News';
    }
}

async function fetchNews() {
    try {
        const allNewsPromises = RSS_FEEDS.map(async feed => {
            try {
                const url = new URL('https://api.rss2json.com/v1/api.json');
                url.searchParams.append('rss_url', feed);
                url.searchParams.append('api_key', process.env.RSS2JSON_API_KEY);
                url.searchParams.append('count', '20');

                const response = await fetch(url.toString());
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                const data = await response.json();
                
                if (data.status === 'ok' && data.items?.length > 0) {
                    return data.items.map(item => ({
                        ...item,
                        sourceName: getSourceName(feed)
                    }));
                }
            } catch (e) {
                console.error(`Error fetching feed ${feed}:`, e);
            }
            return [];
        });

        const allResults = await Promise.all(allNewsPromises);
        let allNews = allResults.flat();

        const threeMonthsAgo = new Date();
        threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

        const filteredNews = allNews
            .filter(item => {
                const pubDate = new Date(item.pubDate);
                if (pubDate < threeMonthsAgo) return false;

                const text = `${item.title} ${item.description}`.toLowerCase();
                return TREE_KEYWORDS.some(keyword => 
                    text.includes(keyword.toLowerCase())
                );
            })
            .map(item => ({
                title: item.title,
                description: (item.description || item.content || '')
                    .replace(/<\/?[^>]+(>|$)/g, '')
                    .replace(/&nbsp;/g, ' ')
                    .replace(/\s+/g, ' ')
                    .trim()
                    .substring(0, 150) + '...',
                link: item.link.replace(/\?.*$/, ''),
                pubDate: item.pubDate,
                image: item.thumbnail || item.enclosure?.link || null,
                sourceName: item.sourceName,
                author: item.author
            }))
            .sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate))
            .slice(0, 12);

        const newsData = {
            lastUpdated: new Date().toISOString(),
            articles: filteredNews
        };

        await fs.writeFile(
            path.join(__dirname, '../news/news-data.json'),
            JSON.stringify(newsData, null, 2)
        );

        console.log(`Generated news data with ${filteredNews.length} articles`);
    } catch (error) {
        console.error('Error generating news:', error);
        process.exit(1);
    }
}

fetchNews();
