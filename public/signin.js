document.getElementById('signinBtn').addEventListener('click', async function() {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    if (!email || !password) {
        alert('Please enter both email and password.');
        return;
    }

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
