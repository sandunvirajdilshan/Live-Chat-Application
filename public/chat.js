const ws = new WebSocket(`ws://${window.location.host}`);

const userDetailsBtn = document.getElementById('userDetailsBtn');
const logoutBtn = document.getElementById('logoutBtn');

const messagesDiv = document.getElementById('messages');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');

messageInput.focus();

// Modal
const userDetailsModal = document.createElement('div');
userDetailsModal.id = 'userDetailsModal';
userDetailsModal.className = 'modal';
userDetailsModal.style.display = 'none';

const modalContent = document.createElement('div');
modalContent.className = 'modal-content';

const closeBtn = document.createElement('span');
closeBtn.className = 'close';
closeBtn.innerHTML = '&times;';
modalContent.appendChild(closeBtn);

const modalHeader = document.createElement('h3');
modalHeader.textContent = 'User Details';
modalContent.appendChild(modalHeader);

const userDetailsContent = document.createElement('div');
userDetailsContent.id = 'userDetailsContent';
modalContent.appendChild(userDetailsContent);

userDetailsModal.appendChild(modalContent);
document.body.appendChild(userDetailsModal);


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

// User Details
userDetailsBtn.addEventListener('click', async () => {
    console.log('User Details Button clicked');
    const response = await fetch('/api/user-details', {
        method: 'GET',
        credentials: 'same-origin',
    });

    if (response.ok) {
        const userDetails = await response.json();
        userDetailsContent.innerHTML = `
            <div class="user-details">
                <p>First Name:</p>
                <p>${userDetails.firstName}</p>
                <p>Last Name:</p>
                <p>${userDetails.lastName}</p>
                <p>Email:</p>
                <p>${userDetails.email}</p>
            </div>
        `;
        userDetailsModal.style.display = 'grid';
    } else {
        const errorMessage = await response.text();
        alert(errorMessage);
    }
});

closeBtn.addEventListener('click', () => {
    userDetailsModal.style.display = 'none';
});

window.addEventListener('click', (event) => {
    if (event.target === userDetailsModal) {
        userDetailsModal.style.display = 'none';
    }
});

// Logout
logoutBtn.addEventListener('click', async () => {
    const response = await fetch('/api/logout', {
        method: 'POST',
        credentials: 'same-origin'
    });

    if (response.redirected) {
        window.location.href = response.url;
    } else {
        const errorMessage = await response.text();
        alert(errorMessage);
    }
});
