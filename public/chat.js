const ws = new WebSocket(`ws://${window.location.host}`);

const messagesDiv = document.getElementById('messages');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');

messageInput.focus();

sendBtn.addEventListener('click', sendMessage);
messageInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
        sendMessage();
    }
});

function sendMessage() {
    const message = messageInput.value;
    if (message) {
        ws.send(message);
        messageInput.value = '';
        messageInput.focus();
    }
}

ws.onmessage = (event) => {
    const messageDiv = document.createElement('div');
    const messageText = document.createTextNode(event.data);
    messageDiv.appendChild(messageText);
    messageDiv.classList.add('message');
    messagesDiv.appendChild(messageDiv);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
};

ws.onclose = () => {
    const messageDiv = document.createElement('div');
    messageDiv.textContent = 'Connection closed.';
    messageDiv.classList.add('message', 'system');
    messagesDiv.appendChild(messageDiv);
};
