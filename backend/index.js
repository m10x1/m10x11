const express = require('express');
const bodyParser = require('body-parser');
const nodemailer = require('nodemailer');
const app = express();
app.use(bodyParser.json());

// Configuration for the Email Service Provider (ESP)
const emailServiceApiKey = 'your-email-service-api-key';
const transporter = nodemailer.createTransport({
    service: 'YourEmailServiceProvider',
    auth: {
        user: 'your-email-auth-username',
        pass: 'your-email-auth-password'
    }
});

app.post('/requestVerificationCode', (req, res) => {
    const email = req.body.email;
    const service = req.body.service;

    // Generate a short-lived single-use code and save it to the database
    // along with the user's email and any other relevant information
    
    // Send the verification code via email
    sendVerificationEmail(email, service);

    res.send('Verification code sent.');
});

function sendVerificationEmail(email, service) {
    const mailOptions = {
        from: 'your-email@example.com',
        to: email,
        subject: `Your ${service} Verification Code`,
        text: `Your verification code for ${service} is: ${verificationCode}`
    };

    transporter.sendMail(mailOptions, function(error, info){
        if (error) {
            console.log(error);
        } else {
            console.log('Email sent: ' + info.response);
        }
    });
}

app.listen(3000, () => console.log('Server running on port 3000'));
