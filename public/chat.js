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
const changePasswordBtn = document.getElementById('changePasswordBtn');

messageInput.focus();

document.addEventListener('click', (event) => {
    const ignoreFocusElements = ['userDetailsBtn', 'logoutBtn', 'sendBtn', 'userDetailsModal', 'close', 'deleteAccountBtn', 'changePasswordBtn'];

    if (document.activeElement && document.activeElement.tagName === 'INPUT' && !document.activeElement.readOnly) {
        return;
    }

    if (!ignoreFocusElements.some(id => event.target.id === id || event.target.closest(`#${id}`))) {
        messageInput.focus();
    }
});

sendBtn.addEventListener('click', sendMessage);
messageInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
        sendMessage();
    }
});


sendBtn.addEventListener('click', sendMessage);
messageInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
        sendMessage();
    }
});


function sendMessage() {
    const message = messageInput.value;
    if (message) {
        displayMessage('You', message, 'sentMessage');

        ws.send(message);
        messageInput.value = '';
        messageInput.focus();
    }
}


function displayMessage(name, text, type) {
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('message', type);

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
}


ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    const { name, text } = data;
    displayMessage(name, text, 'receivedMessage');
};


ws.onclose = () => {
    const messageDiv = document.createElement('div');
    messageDiv.textContent = 'Connection closed.';
    messageDiv.classList.add('message', 'system');
    messagesDiv.appendChild(messageDiv);

    document.getElementById('messageInput').disabled = true;
    document.getElementById('sendBtn').disabled = true;
};


userDetailsBtn.addEventListener('click', async () => {
    const response = await fetch('/api/user-details', {
        method: 'GET',
        credentials: 'same-origin',
    });

    if (response.ok) {
        const userDetails = await response.json();

        document.getElementById('firstName').value = userDetails.firstName || 'N/A';
        document.getElementById('lastName').value = userDetails.lastName || 'N/A';
        document.getElementById('email').value = userDetails.email || 'N/A';

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


document.querySelectorAll('.edit-btn').forEach(btn => {
    btn.addEventListener('click', (event) => {
        const fieldId = event.target.getAttribute('data-field');
        const inputField = document.getElementById(fieldId);

        if (inputField.readOnly) {
            inputField.readOnly = false;
            inputField.classList.add('editable');
            event.target.textContent = 'Save';
        } else {
            inputField.readOnly = true;
            inputField.classList.remove('editable');
            event.target.textContent = 'Edit';

            const updatedValue = inputField.value;
            updateUserDetails(fieldId, updatedValue);
        }
    });
});


async function updateUserDetails(field, value) {
    const data = {
        field: field,
        value: value
    };

    console.log(data);

    const response = await fetch('/api/update-user-details', {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(data),
        credentials: 'same-origin',
    });

    if (response.ok) {
        const message = await response.text();
        alert(message);
    } else {
        const errorMessage = await response.text();
        alert(errorMessage);
    }
}


changePasswordBtn.addEventListener('click', async () => {
    const currentPassword = document.getElementById('currentPassword').value;
    const newPassword = document.getElementById('newPassword').value;
    const confirmNewPassword = document.getElementById('confirmNewPassword').value;

    if (newPassword !== confirmNewPassword) {
        alert('New passwords do not match');
        return;
    }

    const response = await fetch('/api/change-password', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            currentPassword: currentPassword,
            newPassword: newPassword,
            confirmNewPassword: confirmNewPassword
        }),
        credentials: 'same-origin',
    });

    if (response.ok) {
        document.getElementById('currentPassword').value = '';
        document.getElementById('newPassword').value = '';
        document.getElementById('confirmNewPassword').value = '';
        const message = await response.text();
        alert(message)
    } else {
        const errorMessage = await response.text();
        alert(errorMessage);
    }
});


deleteAccountBtn.addEventListener('click', async () => {
    if (confirm('Are you sure you want to delete your account? This action cannot be undone.')) {
        const response = await fetch('/api/delete-account', {
            method: 'DELETE',
            credentials: 'same-origin',
        });

        if (response.ok) {
            window.location.href = '/logout';
        } else {
            const errorMessage = await response.text();
            alert(errorMessage);
        }
    }
});


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
