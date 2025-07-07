let darkmode = localStorage.getItem('darkmode');

const themeSwitcher = document.querySelector('#theme-switcher');
const chatBody = document.querySelector('.chat-body');
const messageInput = document.querySelector('.message-input');
const sendMessageButton = document.querySelector('#send-message');
const fileInput = document.querySelector('#file-input');
const fileUploadWrapper = document.querySelector('.file-upload-wapper');
const fileCancelButton = document.querySelector('#file-cancel');

let chatbotName = "Gwen...!";
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

const generateBotResponse = async (incomingMessageDiv) => {
    const messageElement = incomingMessageDiv.querySelector(".message-text");

    const systemPrompt = `You are ${chatbotName}, a highly sophisticated AI assistant.  Your primary function is to provide accurate and detailed information.  Address the user with respect. Respond as ${chatbotName}:`;

    const requestOptions = {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            role: "user",
            parts: [{ text: systemPrompt + '\n' + userData.message }, ...(userData.file.data ? [{inline_data: userData.file}]: [])]
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
            ? data.candidates[0].content.parts[0].text.replace(/\*\*(.*?)\*\*/g, "$1").trim()
            : "Sorry, I couldn't process your request.";

        messageElement.innerText = apiResponseText;

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

sendMessageButton.addEventListener("click", (e) => handleOutgoingMessage(e));
if(document.querySelector('#file-upload')){
    document.querySelector('#file-upload').addEventListener('click', () => fileInput.click());
}