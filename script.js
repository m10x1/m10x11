// Add JavaScript functionality here
document.addEventListener('DOMContentLoaded', function() {
    const verificationForm = document.getElementById('verification-form');
    const netflixRequestForm = document.getElementById('netflix-request-form');

    verificationForm.addEventListener('submit', function(event) {
        event.preventDefault();
        
        // Make an AJAX request to your Node.js backend for requesting the code
        fetch('/requestVerificationCode', {
            method: 'POST',
            body: JSON.stringify({
                email: document.getElementById('email').value
            }),
        })
        .then(response => response.text())
        .then(data => {
            const statusMessage = document.getElementById('status-message');
            statusMessage.textContent = data;
        });
    });

    netflixRequestForm.addEventListener('submit', function(event) {
        event.preventDefault();
        
        // Make an AJAX request to your Node.js backend for requesting the code
        fetch('/requestVerificationCode', {
            method: 'POST',
            body: JSON.stringify({
                email: document.getElementById('email-netflix').value,
                service: 'netflix'
            }),
        })
        .then(response => response.text())
        .then(data => {
            const statusMessage = document.getElementById('netflix-status-message');
            statusMessage.textContent = data;
        });
    });
});
