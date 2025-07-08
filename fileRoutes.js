import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs'; // Modul File System dari Node.js

const router = express.Router();

// Tentukan direktori dasar untuk semua upload
// process.cwd() adalah direktori kerja saat ini dari proyek Anda
const UPLOAD_DIRECTORY = path.join(process.cwd(), 'uploads');

// Pastikan direktori 'uploads' ada saat server dimulai
if (!fs.existsSync(UPLOAD_DIRECTORY)) {
    fs.mkdirSync(UPLOAD_DIRECTORY);
}

// Konfigurasi Multer untuk menangani penyimpanan file
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        // Ambil path tujuan dari body request, defaultnya adalah root upload
        const relativePath = req.body.path || '';
        const destinationPath = path.join(UPLOAD_DIRECTORY, relativePath);

        // Buat folder tujuan jika belum ada
        if (!fs.existsSync(destinationPath)) {
            fs.mkdirSync(destinationPath, { recursive: true });
        }
        cb(null, destinationPath);
    },
    filename: (req, file, cb) => {
        // Gunakan nama file asli agar tidak berubah
        cb(null, file.originalname);
    }
});

const upload = multer({ storage });

// Endpoint untuk mendapatkan daftar file & folder
// GET /api/list?path=some/folder
router.get('/list', (req, res) => {
    try {
        const relativePath = req.query.path || '';
        const currentPath = path.join(UPLOAD_DIRECTORY, relativePath);

        if (!fs.existsSync(currentPath)) {
            return res.status(404).json({ message: 'Folder not found' });
        }

        const items = fs.readdirSync(currentPath).map(name => {
            const itemPath = path.join(currentPath, name);
            const stats = fs.statSync(itemPath);
            return {
                name: name,
                type: stats.isDirectory() ? 'folder' : 'file',
            };
        });
        res.status(200).json(items);
    } catch (error) {
        res.status(500).json({ message: 'Failed to read directory', error: error.message });
    }
});

// Endpoint untuk membuat folder baru
// POST /api/folder
router.post('/folder', (req, res) => {
    try {
        const { path: relativePath, folderName } = req.body;
        if (!folderName) {
            return res.status(400).json({ message: 'Folder name is required' });
        }
        const newFolderPath = path.join(UPLOAD_DIRECTORY, relativePath || '', folderName);

        if (fs.existsSync(newFolderPath)) {
            return res.status(409).json({ message: 'Folder already exists' });
        }
        fs.mkdirSync(newFolderPath, { recursive: true });
        res.status(201).json({ message: 'Folder created successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Failed to create folder', error: error.message });
    }
});

// Endpoint untuk upload file
// POST /api/upload
router.post('/upload', upload.single('file'), (req, res) => {
    res.status(201).json({ message: `File "${req.file.originalname}" uploaded successfully` });
});

// Endpoint untuk menghapus file atau folder
// DELETE /api/delete
router.delete('/delete', (req, res) => {
    try {
        const { path: relativePath, name, type } = req.body;
        const itemPath = path.join(UPLOAD_DIRECTORY, relativePath || '', name);

        if (!fs.existsSync(itemPath)) {
            return res.status(404).json({ message: 'Item not found' });
        }

        if (type === 'folder') {
            fs.rmdirSync(itemPath, { recursive: true });
        } else {
            fs.unlinkSync(itemPath);
        }
        res.status(200).json({ message: `"${name}" deleted successfully` });
    } catch (error) {
        res.status(500).json({ message: 'Failed to delete item', error: error.message });
    }
});

export default router;