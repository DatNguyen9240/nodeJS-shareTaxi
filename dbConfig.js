const sql = require('mssql');
require('dotenv').config(); // Load environment variables

// Log environment variables for debugging
console.log('Database Configuration:', {
    user: process.env.DB_USER,
    server: process.env.DB_SERVER,
    database: process.env.DB_NAME,
});

// Hàm kiểm tra thanh toán và cập nhật vào database


// Kết nối đến database
const poolPromise = async () => {
    try {
        const pool = await new sql.ConnectionPool({
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            server: process.env.DB_SERVER,
            database: process.env.DB_NAME,
            options: {
                encrypt: true, // Use for Azure
                trustServerCertificate: true, // Use if connecting to an untrusted server
            },
        }).connect();

        console.log('Database connected successfully.');
        return pool;
    } catch (error) {
        console.error('Database connection failed:', error.message);
        throw error; // Rethrow the error for further handling
    }
};

// Export a function to get the connection pool
module.exports = {
    pool: poolPromise(), // Call the function to create the pool
};
