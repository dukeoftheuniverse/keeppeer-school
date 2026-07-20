import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

export const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'keeppeer_school',
  waitForConnections: true,
  connectionLimit: 10,
};

export const pool = mysql.createPool(dbConfig);