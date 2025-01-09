// .github/scripts/fetch-messages.js
const { Octokit } = require('@octokit/rest');
const fs = require('fs').promises;
const path = require('path');

const octokit = new Octokit({
    auth: process.env.GITHUB_TOKEN
});

async function fetchMessages() {
    try {
        const now = new Date();
        const year = now.getFullYear();
        const month = now.toLocaleString('default', { month: 'long' }).toLowerCase();

        // Fetch messages from chatgptree-messages repository
        const { data } = await octokit.repos.getContent({
            owner: 'chatgptree',
            repo: 'chatgptree-messages',
            path: `messages/${year}/${month}.json`,
            ref: 'main'
        });

        // Decode content
        const messages = JSON.parse(Buffer.from(data.content, 'base64').toString());
        
        // Cache the messages locally
        const cachePath = path.join('messageboard', 'cache');
        const cacheFile = path.join(cachePath, `${month}.json`);

        // Ensure cache directory exists
        await fs.mkdir(cachePath, { recursive: true });

        // Write to cache file
        await fs.writeFile(cacheFile, JSON.stringify(messages, null, 2));

        console.log(`Successfully updated message cache for ${month}`);

    } catch (error) {
        console.error('Error fetching messages:', error);
        process.exit(1);
    }
}

fetchMessages();
