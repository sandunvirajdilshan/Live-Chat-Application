window.onload = () => {
    const urlParams = new URLSearchParams(window.location.search);
    const message = urlParams.get('message');
    if (message) {
        const messageElement = document.getElementById('eMessage');
        messageElement.textContent = message;
    }

    const inputs = document.querySelectorAll('#email, #password');
    inputs.forEach(input => {
        input.addEventListener('input', () => {
            document.getElementById('eMessage').textContent = '';
        });
    });
};

document.getElementById('signinBtn').addEventListener('click', async () => {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    const response = await fetch('/api/signin', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        },
        body: JSON.stringify({
            email,
            password
        })
    });

    if (response.redirected) {
        window.location.href = response.url;
    } else {
        const errorMessage = await response.text();
        alert(errorMessage);
    }

    document.getElementById('email').value = '';
    document.getElementById('password').value = '';
});
