const { v4: uuidv4 } = require('uuid');
const { Octokit } = require('@octokit/rest');
const filter = require('leo-profanity');
const axios = require('axios');

class MessageService {
    constructor() {
        // Initialize GitHub API client
        this.octokit = new Octokit({
            auth: process.env.GITHUB_TOKEN
        });

        // Repository settings
        this.owner = process.env.GITHUB_USERNAME;
        this.repo = process.env.GITHUB_REPO;

        // Initialize filter immediately
        this.initializeFilter();
    }

    async initializeFilter() {
        try {
            // Load base English dictionary
            filter.loadDictionary('en');

            // Fetch word list
            const response = await axios.get('https://raw.githubusercontent.com/zacanger/profane-words/master/words.json');
            filter.add(response.data);

            // Add common evasion patterns
            const evasionPatterns = [
                'c*nt', 'c**t', 'cu*t',
                'f*ck', 'f**k', 'fu*k',
                'sh*t', 's**t', 
                'b*tch', 'b**ch'
            ];
            filter.add(evasionPatterns);

            // Set replacement method
            filter.setReplacementMethod('stars');

            console.log('Profanity filter initialized');
        } catch (error) {
            console.error('Error initializing filter:', error);
            // Fallback to basic filtering if fetch fails
            filter.add(['cunt', 'fuck', 'shit', 'bitch']);
        }
    }

    cleanMessage(text) {
        if (!text) return '';
        return filter.clean(text);
    }

    async storeMessage(messageData) {
        // Clean user-provided content
        const cleanedMessage = this.cleanMessage(messageData.comment);
        const cleanedName = this.cleanMessage(messageData.name);
        const cleanedLocation = this.cleanMessage(messageData.from);

        // Format the message
        const formattedMessage = {
            id: `msg_${Date.now()}`,
            message: cleanedMessage,
            rating: messageData.rating,
            userName: cleanedName,
            location: cleanedLocation,
            treeName: messageData.treeName,
            treeCode: messageData.treeCode,
            treeLocation: messageData.treeLocation,
            timestamp: new Date().toISOString()
        };

        // Rest of your storeMessage code...
        const date = new Date();
        const year = date.getFullYear();
        const month = date.toLocaleString('default', { month: 'long' }).toLowerCase();
        const filePath = `messages/${year}/${month}.json`;

        try {
            const { data: existingFile } = await this.octokit.rest.repos.getContent({
                owner: this.owner,
                repo: this.repo,
                path: filePath,
            });

            const content = Buffer.from(existingFile.content, 'base64').toString();
            const messages = JSON.parse(content);
            messages.unshift(formattedMessage);

            await this.octokit.rest.repos.createOrUpdateFileContents({
                owner: this.owner,
                repo: this.repo,
                path: filePath,
                message: `Add rated message from ${formattedMessage.userName}`,
                content: Buffer.from(JSON.stringify(messages, null, 2)).toString('base64'),
                sha: existingFile.sha
            });

        } catch (error) {
            if (error.status === 404) {
                await this.octokit.rest.repos.createOrUpdateFileContents({
                    owner: this.owner,
                    repo: this.repo,
                    path: filePath,
                    message: `Create ${month}.json and add first message`,
                    content: Buffer.from(JSON.stringify([formattedMessage], null, 2)).toString('base64')
                });
            } else {
                console.error('Error storing message:', error);
                throw new Error('Failed to store message');
            }
        }

        return formattedMessage;
    }

    // getMessages method remains the same...
}

module.exports = MessageService;
