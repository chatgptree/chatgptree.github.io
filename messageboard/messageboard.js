async checkForNewMessages() {
    try {
        const now = new Date();
        const year = now.getUTCFullYear();
        const month = now.toLocaleString('default', { 
            month: 'long',
            timeZone: 'UTC'
        }).toLowerCase();
        const day = now.toISOString().split('T')[0];
            
        // Changed to use daily file
        const url = `https://raw.githubusercontent.com/chatgptree/chatgptree.github.io/main/messages/${year}/${month}/${day}.json`;
            
        const response = await fetch(url, {
            cache: 'no-store'
        });

        if (response.ok) {
            const data = await response.json();
            // Rest of the method remains exactly the same
            const hasNewMessages = data.some(message => {
                const messageTime = new Date(message.timestamp).getTime();
                return messageTime > this.lastUpdateTime;
            });

            if (hasNewMessages) {
                console.log(`[${new Date().toISOString()}] New messages found, updating...`);
                const newMessages = data.filter(message => {
                    const messageTime = new Date(message.timestamp).getTime();
                    return messageTime > this.lastUpdateTime;
                });
                this.messages = [...newMessages, ...this.messages];
                if (newMessages.length > 0) {
                    const latestMessage = newMessages.reduce((latest, msg) => {
                        const msgTime = new Date(msg.timestamp).getTime();
                        return msgTime > latest ? msgTime : latest;
                    }, 0);
                    this.lastUpdateTime = latestMessage;
                }
                this.filterAndRenderMessages();
                this.showNotification('New messages have arrived! 🌱');
            }
        }
    } catch (error) {
        console.error('Error checking for new messages:', error);
    }
}

async loadMessages() {
    try {
        if (!this.hasMoreMessages || this.isLoading) return;
        
        this.showLoadingSpinner();
        
        const date = this.lastMessageTimestamp 
            ? new Date(this.lastMessageTimestamp) 
            : new Date();
            
        const year = date.getUTCFullYear();
        const month = date.toLocaleString('default', { 
            month: 'long',
            timeZone: 'UTC'
        }).toLowerCase();
        const day = date.toISOString().split('T')[0];
        
        // Changed to use daily file
        const url = `https://raw.githubusercontent.com/chatgptree/chatgptree.github.io/main/messages/${year}/${month}/${day}.json`;
        console.log('Fetching from:', url);
        
        const response = await fetch(url, {
            cache: 'no-store'
        });
        
        if (!response.ok) {
            if (response.status === 404) {
                // If no messages for this day, try previous day
                const prevDate = new Date(date);
                prevDate.setDate(prevDate.getDate() - 1);
                this.lastMessageTimestamp = prevDate.toISOString();
                this.loadMessages();
                return;
            }
            throw new Error(`Failed to fetch messages: ${response.status}`);
        }

        // Rest of the method remains exactly the same
        const data = await response.json();
        
        let filteredData = this.lastMessageTimestamp 
            ? data.filter(msg => new Date(msg.timestamp) < new Date(this.lastMessageTimestamp))
            : data;
        
        const newMessages = filteredData.slice(0, this.pageSize);
        
        this.hasMoreMessages = filteredData.length > this.pageSize;
        
        if (newMessages.length > 0) {
            this.lastMessageTimestamp = newMessages[newMessages.length - 1].timestamp;
            this.messages = [...this.messages, ...newMessages];
            this.messages.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
            if (this.messages.length > 0) {
                const latestMessage = this.messages.reduce((latest, msg) => {
                    const msgTime = new Date(msg.timestamp).getTime();
                    return msgTime > latest ? msgTime : latest;
                }, 0);
                this.lastUpdateTime = latestMessage;
            }
        }
        
        this.isLoading = false;
        this.filterAndRenderMessages();
        
        if (this.hasMoreMessages) {
            this.setupInfiniteScroll();
        }
        
    } catch (error) {
        console.error('Error in loadMessages:', error);
        this.isLoading = false;
        this.showError('Unable to load messages. Please try again later.');
    }
}
