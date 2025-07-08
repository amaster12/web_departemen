import "dotenv/config";
import express from "express";
import cors from "cors";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import mysql from "mysql2/promise";

// +++ Impor rute untuk manajemen file
import fileRoutes from './backend/server.js';

const app = express();
const PORT = process.env.PORT || 3000;
const SECRET_KEY = process.env.JWT_SECRET || "default_secret_key";

// Konfigurasi Database Pool
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Middleware global
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ===================================
// RUTE OTENTIKASI PENGGUNA
// ===================================

// Middleware autentikasi JWT
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
        return res.status(401).json({ message: "Token tidak ditemukan atau salah" });
    }
    const token = authHeader.split(" ")[1];
    try {
        req.user = jwt.verify(token, SECRET_KEY);
        next();
    } catch {
        return res.status(403).json({ message: "Token tidak valid" });
    }
};

// Rute signup
app.post("/signup", async (req, res) => {
    const { fullname, nidn, username, password } = req.body;
    if (!fullname || !nidn || !username || !password) {
        return res.status(400).json({ message: "Semua field harus diisi!" });
    }
    try {
        const hashed = await bcrypt.hash(password, 10);
        const newUserId = crypto.randomUUID();
        const sql = "INSERT INTO users (id, fullname, nidn, username, password) VALUES (?, ?, ?, ?, ?)";
        await pool.execute(sql, [newUserId, fullname, nidn, username, hashed]);
        res.status(201).json({ message: "Registrasi berhasil!" });
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ message: "Username sudah digunakan!" });
        }
        console.error("Signup error:", err);
        res.status(500).json({ message: "Terjadi kesalahan server." });
    }
});

// Rute signin
app.post("/signin", async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ message: "Username dan password harus diisi!" });
    }
    try {
        const sql = "SELECT * FROM users WHERE username = ?";
        const [rows] = await pool.execute(sql, [username]);

        if (!rows.length) {
            return res.status(404).json({ message: "User tidak ditemukan!" });
        }

        const user = rows[0];
        if (!(await bcrypt.compare(password, user.password))) {
            return res.status(401).json({ message: "Password salah!" });
        }

        const token = jwt.sign(
            { id: user.id, username: user.username },
            SECRET_KEY,
            { expiresIn: "1h" }
        );
        return res.json({ message: "Login berhasil!", token });
    } catch (err) {
        console.error("Signin error:", err);
        res.status(500).json({ message: "Server error." });
    }
});


// ===================================
// RUTE MANAJEMEN FILE
// ===================================

// +++ Gunakan rute file dengan prefix /api
// Semua request ke /api/list, /api/upload, dll akan ditangani oleh fileRoutes.js
// Untuk rute yang butuh proteksi, pasang middleware authenticateToken
app.use('/api', authenticateToken, fileRoutes);


// ===================================
// KONFIGURASI SERVER
// ===================================

// Health check
app.get("/", (_req, res) => res.send("API is running"));

// Penanganan error global
app.use((err, _req, res, _next) => {
    console.error(err);
    res.status(500).json({ message: "Internal server error." });
});

// Penanganan 404
app.use((_req, res) => {
    res.status(404).json({ message: "Endpoint tidak ditemukan!" });
});

// Menjalankan server
app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
});