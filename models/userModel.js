const sql = require('mssql');
const { pool } = require('../dbConfig');

async function createUser(name, email, phone, password, birthday) {
    try {
        const poolInstance = await pool; 
        const result = await poolInstance.request()
            .input('Name', sql.NVarChar, name)
            .input('Email', sql.NVarChar, email)
            .input('Phone', sql.NVarChar, phone)
            .input('Password', sql.NVarChar, password) 
            .input('Birthday', sql.Date, birthday)
            .query(`
                INSERT INTO [dbo].[User] ([Name], [Email], [PhoneNumber], [Password], [DateOfBirth], [CreatedAt], [Role]) 
                VALUES (@Name, @Email, @Phone, @Password, @Birthday, GETDATE(), 'user')
            `);
        return result.rowsAffected[0] > 0; 
    } catch (error) {
        console.error('Error creating user:', error); // Log the error for debugging
        return false; 
    }
}

module.exports = { createUser };
