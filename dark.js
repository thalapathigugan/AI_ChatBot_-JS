let darkmode = localStorage.getItem('darkmode');

const themeSwitcher = document.querySelector('#theme-switcher');
const chatBody = document.querySelector('.chat-body');
const messageInput = document.querySelector('.message-input');
const sendMessageButton = document.querySelector('#send-message');
const fileInput = document.querySelector('#file-input');
const fileUploadWrapper = document.querySelector('.file-upload-wapper');
const fileCancelButton = document.querySelector('#file-cancel');
const newChatButton = document.querySelector('#new-chat');

// Vector Store for Long Conversations
class VectorStore {
    constructor() {
        this.messages = [];
        this.maxContextLength = 4000; // Maximum context length in characters
        this.maxRecentMessages = 10; // Always include recent messages
        this.similarityThreshold = 0.3; // Minimum similarity score
    }

    // Simple text embedding using word frequency
    createEmbedding(text) {
        const words = text.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/);
        const embedding = {};
        words.forEach(word => {
            embedding[word] = (embedding[word] || 0) + 1;
        });
        return embedding;
    }

    // Calculate cosine similarity between two embeddings
    calculateSimilarity(embedding1, embedding2) {
        const allWords = new Set([...Object.keys(embedding1), ...Object.keys(embedding2)]);
        let dotProduct = 0;
        let magnitude1 = 0;
        let magnitude2 = 0;

        for (const word of allWords) {
            const val1 = embedding1[word] || 0;
            const val2 = embedding2[word] || 0;
            dotProduct += val1 * val2;
            magnitude1 += val1 * val1;
            magnitude2 += val2 * val2;
        }

        magnitude1 = Math.sqrt(magnitude1);
        magnitude2 = Math.sqrt(magnitude2);

        if (magnitude1 === 0 || magnitude2 === 0) return 0;
        return dotProduct / (magnitude1 * magnitude2);
    }

    // Add message to vector store
    addMessage(role, content, timestamp = Date.now()) {
        const embedding = this.createEmbedding(content);
        this.messages.push({
            role,
            content,
            timestamp,
            embedding
        });
        this.saveToStorage();
    }

    // Get relevant context for a new message
    getRelevantContext(newMessage, maxTokens = 3000) {
        if (this.messages.length === 0) return '';

        const newEmbedding = this.createEmbedding(newMessage);
        const recentMessages = this.messages.slice(-this.maxRecentMessages);
        
        // Calculate similarity scores for all messages
        const scoredMessages = this.messages.map(msg => ({
            ...msg,
            similarity: this.calculateSimilarity(newEmbedding, msg.embedding)
        }));

        // Sort by similarity and recency
        scoredMessages.sort((a, b) => {
            // Prioritize recent messages
            const recencyWeight = 0.3;
            const similarityWeight = 0.7;
            
            const recencyScore = (a.timestamp - b.timestamp) / (Date.now() - this.messages[0].timestamp);
            const similarityScore = b.similarity - a.similarity;
            
            return (similarityWeight * similarityScore) + (recencyWeight * recencyScore);
        });

        // Build context from most relevant messages
        const contextMessages = [];
        let totalLength = 0;

        // Always include recent messages first
        for (const msg of recentMessages) {
            const messageText = `${msg.role}: ${msg.content}`;
            if (totalLength + messageText.length <= maxTokens) {
                contextMessages.unshift(msg); // Add to beginning
                totalLength += messageText.length;
            }
        }

        // Add most relevant older messages
        for (const msg of scoredMessages) {
            if (contextMessages.some(m => m.timestamp === msg.timestamp)) continue;
            
            const messageText = `${msg.role}: ${msg.content}`;
            if (totalLength + messageText.length <= maxTokens && msg.similarity > this.similarityThreshold) {
                contextMessages.push(msg);
                totalLength += messageText.length;
            }
        }

        // Sort by timestamp for chronological order
        contextMessages.sort((a, b) => a.timestamp - b.timestamp);
        
        return contextMessages.map(msg => `${msg.role}: ${msg.content}`).join('\n');
    }

    // Get recent context (simple fallback)
    getRecentContext(count = 10) {
        const recent = this.messages.slice(-count);
        return recent.map(msg => `${msg.role}: ${msg.content}`).join('\n');
    }

    // Clear all messages
    clear() {
        this.messages = [];
        this.saveToStorage();
    }

    // Save to localStorage
    saveToStorage() {
        try {
            localStorage.setItem('vectorChatHistory', JSON.stringify(this.messages));
        } catch (error) {
            console.error('Error saving vector chat history:', error);
        }
    }

    // Load from localStorage
    loadFromStorage() {
        try {
            const saved = localStorage.getItem('vectorChatHistory');
            if (saved) {
                this.messages = JSON.parse(saved);
            }
        } catch (error) {
            console.error('Error loading vector chat history:', error);
            this.messages = [];
        }
    }

    // Get conversation summary for very long conversations
    getConversationSummary() {
        if (this.messages.length < 20) return null;
        
        const topics = {};
        this.messages.forEach(msg => {
            const words = msg.content.toLowerCase().split(/\s+/);
            words.forEach(word => {
                if (word.length > 3) {
                    topics[word] = (topics[word] || 0) + 1;
                }
            });
        });

        const topTopics = Object.entries(topics)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 5)
            .map(([topic]) => topic);

        return `Key topics discussed: ${topTopics.join(', ')}`;
    }
}

// Initialize vector store
const vectorStore = new VectorStore();
vectorStore.loadFromStorage();

let chatbotName = "Mikasa";
const CHATBOT_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="50" height="50" viewBox="0 0 1024 1024">
                <path d="M738.3 287.6H285.7c-59 0-106.8 47.8-106.8 106.8v303.1c0 59 47.8 106.8 106.8 106.8h81.5v111.1c0 .7.8 1.1 1.4.7l166.9-110.6 41.8-.8h117.4l43.6-.4c59 0 106.8-47.8 106.8-106.8V394.5c0-59-47.8-106.9-106.8-106.9zM351.7 448.2c0-29.5 23.9-53.5 53.5-53.5s53.5 23.9 53.5 53.5-23.9 53.5-53.5 53.5-53.5-23.9-53.5-53.5zm157.9 267.1c-67.8 0-123.8-47.5-132.3-109h264.6c-8.6 61.5-64.5 109-132.3 109zm110-213.7c-29.5 0-53.5-23.9-53.5-53.5s23.9-53.5 53.5-53.5 53.5 23.9 53.5 53.5-23.9 53.5-53.5 53.5zM867.2 644.5V453.1h26.5c19.4 0 35.1 15.7 35.1 35.1v121.1c0 19.4-15.7 35.1-35.1 35.1h-26.5zM95.2 609.4V488.2c0-19.4 15.7-35.1 35.1-35.1h26.5v191.3h-26.5c-19.4 0-35.1-15.7-35.1-35.1zM561.5 149.6c0 23.4-15.6 43.3-36.9 49.7v44.9h-30v-44.9c-21.4-6.5-36.9-26.3-36.9-49.7 0-28.6 23.3-51.9 51.9-51.9s51.9 23.3 51.9 51.9z"></path>
            </svg>`;


API_KEY = "AIzaSyAK3aGd6OhJdSGFXITEoO9ROR7-3ee1z9E"
API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`;




const userData = {
    message: null,
    file: {
      data: null,
      mime_type: null
    }
};

// Function to format AI responses with proper list formatting
const formatResponseWithLists = (text) => {
    // Split text into lines
    const lines = text.split('\n');
    let formattedLines = [];
    let inList = false;
    let listType = null;
    let listItems = [];
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        // Check for numbered list (1., 2., etc.)
        const numberedMatch = line.match(/^(\d+)\.\s+(.+)$/);
        // Check for bullet points (-, *, •)
        const bulletMatch = line.match(/^[-*•]\s+(.+)$/);
        
        if (numberedMatch) {
            // Start or continue numbered list
            if (!inList || listType !== 'numbered') {
                if (inList) {
                    // Close previous list
                    formattedLines.push(formatList(listItems, listType));
                    listItems = [];
                }
                inList = true;
                listType = 'numbered';
            }
            listItems.push(numberedMatch[2]);
        } else if (bulletMatch) {
            // Start or continue bullet list
            if (!inList || listType !== 'bullet') {
                if (inList) {
                    // Close previous list
                    formattedLines.push(formatList(listItems, listType));
                    listItems = [];
                }
                inList = true;
                listType = 'bullet';
            }
            listItems.push(bulletMatch[1]);
        } else {
            // Regular text line
            if (inList) {
                // Close current list
                formattedLines.push(formatList(listItems, listType));
                listItems = [];
                inList = false;
                listType = null;
            }
            // Escape HTML and preserve line breaks
            formattedLines.push(line.replace(/</g, '&lt;').replace(/>/g, '&gt;'));
        }
    }
    
    // Close any remaining list
    if (inList) {
        formattedLines.push(formatList(listItems, listType));
    }
    
    return formattedLines.join('<br>');
};

// Helper function to format lists
const formatList = (items, type) => {
    if (type === 'numbered') {
        return `<ol>${items.map(item => `<li>${item.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</li>`).join('')}</ol>`;
    } else {
        return `<ul>${items.map(item => `<li>${item.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</li>`).join('')}</ul>`;
    }
};

const generateBotResponse = async (incomingMessageDiv) => {
    const messageElement = incomingMessageDiv.querySelector(".message-text");

    const systemPrompt = `
You are ${chatbotName}, a highly intelligent,  a friendly female AI assistant. Use she/her pronouns and speak in a warm, empathetic tone.
reply in English.
If the user starts the conversation in Tamil or asks to speak in Tamil, reply fully in Tamil words (written in English letters) for fun and local flavor.
Use a casual, conversational tone.
Examples of Tamil words to mix: "seri", "sapadu", "enna", "romba", "aama", "illa", "semma", "dai", "da", "machan".
Otherwise, reply in English.
If the user switches language, adapt your response accordingly.
`;

    
    // Get intelligent context using vector store
    const relevantContext = vectorStore.getRelevantContext(userData.message);
    const conversationSummary = vectorStore.getConversationSummary();
    
    let contextPrompt = userData.message;
    if (relevantContext) {
        contextPrompt = `Previous conversation context:\n${relevantContext}\n\nCurrent message: ${userData.message}`;
        if (conversationSummary) {
            contextPrompt = `${conversationSummary}\n\n${contextPrompt}`;
        }
    }

    const requestOptions = {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            role: "user",
            parts: [{ text: systemPrompt + '\n' + contextPrompt }, ...(userData.file.data ? [{inline_data: userData.file}]: [])]
          }]
        })
    };

    try {
        const response = await fetch(API_URL, requestOptions);
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error?.message);
        }

        const apiResponseText = data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts && data.candidates[0].content.parts[0] && data.candidates[0].content.parts[0].text
            ? data.candidates[0].content.parts[0].text.replace(/\*\*(.*?)\*\*/g, "$1").replace(/<[^>]*>/g, "").trim()
            : "Sorry, I couldn't process your request.";

        // Format the response for proper list display
        const formattedResponse = formatResponseWithLists(apiResponseText);
        messageElement.innerHTML = formattedResponse;
        
        // Add bot response to vector store
        vectorStore.addMessage('bot', apiResponseText);

    } catch (error) {
        console.error('Error:', error);
        messageElement.innerText = "Sorry, I encountered an error. Please try again.";
    } finally {
        userData.file = {
            data: null,
            mime_type: null
        };
        incomingMessageDiv.classList.remove("thinking");
        chatBody.scrollTo({ top: chatBody.scrollHeight, behavior: "smooth" });
    }
};

const createMessageElement = (content, ...classes) => {
    const div = document.createElement("div");
    div.classList.add("message", ...classes);
    div.innerHTML = content;
    return div;
};




const handleOutgoingMessage = (e) => {
    e?.preventDefault();
    userData.message = messageInput.value.trim();
    messageInput.value = "";

    messageInput.style.height = 'auto';

    // Add user message to vector store
    vectorStore.addMessage('user', userData.message);

    const formattedMessage = userData.message.replace(/\n/g, '<br>');
    const messageContent = `<div class="message-text">${formattedMessage}</div> ${userData.file.data ? `<img src="data:${userData.file.mime_type};base64,${userData.file.data}" class="attachment">` : ""}`;


    const outgoingMessageDiv = createMessageElement(messageContent, "user-message");
    chatBody.appendChild(outgoingMessageDiv);
    chatBody.scrollTo({ top: chatBody.scrollHeight, behavior: "smooth" });

    setTimeout(() => {
        const botMessageContent = `<div class="message bot-message">
              ${CHATBOT_ICON_SVG}
              <div class="message-text">
                <div class="thinking-indicator">
                  <div class="dot"></div>
                  <div class="dot"></div>
                  <div class="dot"></div>
                </div>
              </div>`;
        const incomingMessageDiv = createMessageElement(botMessageContent, "bot-message", "thinking");
        chatBody.appendChild(incomingMessageDiv);
        chatBody.scrollTo({ top: chatBody.scrollHeight, behavior: "smooth" });
        generateBotResponse(incomingMessageDiv);
    }, 600);
};

const autoResizeInput = () => {
    messageInput.style.height = 'auto';
    const newHeight = Math.min(messageInput.scrollHeight, 160);
    messageInput.style.height = newHeight + 'px';
};

messageInput.addEventListener("keydown", (e) => {
    const userMessage = e.target.value.trim();

    if (e.key === "Enter") {
        if (e.shiftKey) {
            return;
        } else if (userMessage) {
            e.preventDefault();
            handleOutgoingMessage(e);
        }
    }
});

messageInput.addEventListener("input", autoResizeInput);

if(fileInput){
    fileInput.addEventListener("change", () => {
      const file = fileInput.files[0];
      if(!file) return;

      const reader = new FileReader();
      reader.onload = (e) => {
        const img = fileUploadWrapper.querySelector('img');
        if (img) {
          img.src = e.target.result;
        }
        fileUploadWrapper.classList.add("file-uploaded");
        const base64String = e.target.result.split(",")[1];

        userData.file = {
          data: base64String,
          mime_type: file.type
        }

        fileInput.value = "";
      }

      reader.readAsDataURL(file);
    });
}


if(fileCancelButton){
    fileCancelButton.addEventListener('click', () => {
      userData.file = { data: null, mime_type: null };
      fileUploadWrapper.classList.remove("file-uploaded");
    });
}

const enableDarkMode = () => {
  document.body.classList.add('dark-mode');
  localStorage.setItem('darkmode', 'enabled');
}
const disableDarkMode = () => {
  document.body.classList.remove('dark-mode');
  localStorage.setItem('darkmode', 'disabled');
}

// Ensure theme is set on page load
if(darkmode === 'enabled'){
  enableDarkMode();
} else {
  disableDarkMode();
}

if (themeSwitcher) {
  themeSwitcher.addEventListener('click', (e) => {
    // Always get the latest value from localStorage
    const currentMode = localStorage.getItem('darkmode');
    if(currentMode !== 'enabled'){
        enableDarkMode();
    }else{
        disableDarkMode();
    }
  });
}

// Display conversation history from vector store
const displayConversationHistory = () => {
    if (vectorStore.messages.length > 0) {
        vectorStore.messages.forEach(msg => {
            if (msg.role === 'user') {
                const formattedMessage = msg.content.replace(/\n/g, '<br>');
                const messageContent = `<div class="message-text">${formattedMessage}</div>`;
                const userMessageDiv = createMessageElement(messageContent, "user-message");
                chatBody.appendChild(userMessageDiv);
            } else if (msg.role === 'bot') {
                const formattedBotMessage = formatResponseWithLists(msg.content);
                const botMessageContent = `<div class="message bot-message">
                    ${CHATBOT_ICON_SVG}
                    <div class="message-text">${formattedBotMessage}</div>`;
                const botMessageDiv = createMessageElement(botMessageContent, "bot-message");
                chatBody.appendChild(botMessageDiv);
            }
        });
        chatBody.scrollTo({ top: chatBody.scrollHeight, behavior: "smooth" });
    }
};

// Display conversation history when page loads
displayConversationHistory();

// Clear conversation button event listener
const clearConversationButton = document.querySelector('#clear-conversation');
if (clearConversationButton) {
    clearConversationButton.addEventListener('click', () => {
        if (confirm('Are you sure you want to clear the conversation history?')) {
            vectorStore.clear();
            chatBody.innerHTML = '';
        }
    });
}

sendMessageButton.addEventListener("click", (e) => handleOutgoingMessage(e));
if(document.querySelector('#file-upload')){
    document.querySelector('#file-upload').addEventListener('click', () => fileInput.click());
}

if (newChatButton) {
    newChatButton.addEventListener('click', () => {
        chatBody.innerHTML = '';
        // Optionally, add a welcome or new chat message
        const newChatMsg = document.createElement('div');
        newChatMsg.className = 'message bot-message';
        newChatMsg.innerHTML = `
            ${CHATBOT_ICON_SVG}
            <div class="message-text">New chat started. How can I help you?</div>
        `;
        chatBody.appendChild(newChatMsg);
        chatBody.scrollTo({ top: chatBody.scrollHeight, behavior: "smooth" });
    });
}