const { Octokit } = require('@octokit/rest');

const octokit = new Octokit({
    auth: process.env.GITHUB_TOKEN
});

async function fetchMessages() {
    try {
        const now = new Date();
        const currentMonth = now.toLocaleString('default', { month: 'long' }).toLowerCase();
        
        let messages = [];
        
        try {
            // Fetch messages from your messages repository
            const response = await octokit.repos.getContent({
                owner: 'chatgptree',
                repo: 'chatgptree-messages',
                path: `messages/${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}.json`
            });

            const content = Buffer.from(response.data.content, 'base64').toString();
            messages = JSON.parse(content);
        } catch (error) {
            console.log('No messages found, creating empty array');
            messages = [];  // If no messages exist, use empty array
        }

        // Write to cache file with proper JSON structure
        const fs = require('fs');
        fs.writeFileSync(
            `messageboard/cache/${currentMonth}.json`, 
            JSON.stringify(messages, null, 2) || '[]'  // Ensure valid JSON even if empty
        );
        
        console.log(`Successfully updated ${currentMonth}.json`);
    } catch (error) {
        console.error('Error fetching messages:', error);
        // Create empty array if everything fails
        const fs = require('fs');
        fs.writeFileSync(
            `messageboard/cache/january.json`, 
            '[]'
        );
    }
}

fetchMessages();
