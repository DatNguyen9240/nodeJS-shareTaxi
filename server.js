const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/auth');
require('dotenv').config();
const app = express();
const axios = require("axios");
const PayOS = require('@payos/node');

const payos = new PayOS(
    '01fc3460-78aa-43a9-88b4-cf2832b6b7d0', 
    'f8a93f7b-fffc-4a5f-a5da-85541496bf07', 
    '82c1440314c7520efb610a8d987e4ce4cbdcbc402fae2062ad3c519306f0b01c'
);

app.use(cors());
app.use(express.static('public'));
app.use(express.json());

// Payment link endpoint
app.post("/create-payment-link", async (req, res) => {
    const orderCode = Date.now() % 1000000000;
    const { userId, amount, description } = req.body;
    console.log(userId, amount, description);
    const order = {
        amount: amount || 10000, // Use the requested amount or default to 10,000
        description: description,
        orderCode: orderCode,
        returnUrl: `http://localhost:5173/wallet`,
        cancelUrl: `http://localhost:5173/wallet`
    };

    try {
        const paymentLink = await payos.createPaymentLink(order);
        res.json({ paymentLink: paymentLink.checkoutUrl }); // Send back checkoutUrl in JSON format
    } catch (error) {
        console.error('Error creating payment link:', error);
        res.status(500).json({ message: 'Failed to create payment link.' });
    }
});

app.post("/receive-hook", async (req, res) => {
    // Extract data from the request body
    const amount = req.body.data?.amount;
    const description = req.body.data?.description;
    const userId = description ? description.split('wallet ')[1] : null; // Extract userId if present

    // Check if amount and userId are valid
    if (!amount || !userId) {
        console.error('Invalid hook data:', req.body);
        return res.json({ message: 'Invalid hook data.' });
    }

    try {
        // Attempt to call the external deposit API
        const depositResponse = await axios.post(
            `http://sharetaxi.somee.com/api/Wallet/Deposit?userId=${userId}&amount=${amount}&method=vnpay`
        );

        // Check if the deposit API returned a success status
        if (depositResponse.status === 200) {
            return res.json();
        } else {
            console.error('Deposit API returned an unsuccessful status:', depositResponse.status);
            return res.json({ message: 'Failed to process deposit due to API error.' });
        }
    } catch (error) {
        // Log the error for debugging and return a failure message
        console.error('Error processing deposit:', error.message || error);
        return res.json({ message: 'Failed to process the hook. Please try again later.' });
    }
});



app.use('/api', authRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server đang chạy trên cổng ${PORT}`);
});
