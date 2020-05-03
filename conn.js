const mysql2 = require('mysql2/promise');

module.exports = async function conn () {
    const connection = await mysql2.createConnection({
        host: 'localhost',
        user: 'root',
        password: 'DJJ1522474',
        database: 'db_test'
    });
    return connection;
}