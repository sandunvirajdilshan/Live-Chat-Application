const ws = new WebSocket(`ws://${window.location.host}`);

const userDetailsBtn = document.getElementById('userDetailsBtn');
const logoutBtn = document.getElementById('logoutBtn');

const messagesDiv = document.getElementById('messages');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');

const userDetailsModal = document.getElementById('userDetailsModal');
const userDetailsContent = document.getElementById('userDetailsContent');
const closeBtn = document.querySelector('.close');
const deleteAccountBtn = document.getElementById('deleteAccountBtn');

messageInput.focus();

document.addEventListener('click', (event) => {
    const ignoreFocusElements = ['userDetailsBtn', 'logoutBtn', 'sendBtn', 'userDetailsModal', 'close', 'deleteAccountBtn'];

    if (!ignoreFocusElements.some(id => event.target.id === id || event.target.closest(`#${id}`))) {
        messageInput.focus();
    }
    messageInput.focus();
});

sendBtn.addEventListener('click', sendMessage);
messageInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
        sendMessage();
    }
});

// Send Message function
function sendMessage() {
    const message = messageInput.value;
    if (message) {
        ws.send(message);
        messageInput.value = '';
        messageInput.focus();
    }
}

ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    const { name, text } = data;

    const messageDiv = document.createElement('div');
    messageDiv.classList.add('message');

    const nameDiv = document.createElement('div');
    nameDiv.classList.add('message-name');
    nameDiv.textContent = name;
    messageDiv.appendChild(nameDiv);

    const textDiv = document.createElement('div');
    textDiv.classList.add('message-text');
    textDiv.textContent = text;
    messageDiv.appendChild(textDiv);

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
    const response = await fetch('/api/user-details', {
        method: 'GET',
        credentials: 'same-origin',
    });

    if (response.ok) {
        const userDetails = await response.json();

        const userDetailsContent = document.getElementById('userDetailsContent');
        const userDetailFields = userDetailsContent.querySelectorAll('p:nth-child(2n)');
        userDetailFields[0].textContent = userDetails.firstName || 'N/A';
        userDetailFields[1].textContent = userDetails.lastName || 'N/A';
        userDetailFields[2].textContent = userDetails.email || 'N/A';

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

// Delete Account
deleteAccountBtn.addEventListener('click', async () => {
    const confirmDelete = confirm('Are you sure you want to delete your account? This action cannot be undone.');
    if (confirmDelete) {
        const response = await fetch('/api/delete-account', {
            method: 'DELETE',
            credentials: 'same-origin',
        });

        if (response.redirected) {
            window.location.href = response.url;
        } else {
            const errorMessage = await response.text();
            alert(errorMessage);
        }
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
