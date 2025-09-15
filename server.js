console.log("Starting server.js...");

const http = require('http');
const fs = require('fs');
const path = require('path');
const mime = require('mime-types');
const formidable = require('formidable');
const sanitize = require('sanitize-filename');

const PUBLIC_DIR = path.join(__dirname, 'public');
const UPLOAD_DIR = path.join(__dirname, 'uploads');

if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR);

const server = http.createServer((req, res) => {
    if (req.method === 'POST' && req.url === '/upload') {
        // Handle file upload
        const form = formidable({
            multiples: false,
            maxFileSize: 5 * 1024 * 1024, // 5 MB
        });

        form.parse(req, (err, fields, files) => {
            if (err) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ error: err.message }));
            }

            const file = files.file;
            if (!file) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ error: 'No file uploaded' }));
            }

            const allowedTypes = ['image/png', 'image/jpeg', 'image/gif', 'text/plain'];
            if (!allowedTypes.includes(file.mimetype)) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ error: 'Invalid file type. Only images and text files are allowed.' }));
            }

            const safeName = sanitize(path.basename(file.originalFilename));
            const newPath = path.join(UPLOAD_DIR, safeName);

            fs.rename(file.filepath, newPath, (err) => {
                if (err) {
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    return res.end(JSON.stringify({ error: 'Error saving file' }));
                }
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, filename: safeName }));
            });
        });

    } else if (req.method === 'GET' && req.url === '/files') {
        // Return list of uploaded files
        fs.readdir(UPLOAD_DIR, (err, files) => {
            if (err) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ error: 'Error reading files' }));
            }
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(files));
        });

    } else if (req.url.startsWith('/uploads/')) {
        // Serve uploaded files safely
        const requestedFile = req.url.replace('/uploads/', '');
        const safeName = path.basename(requestedFile);
        const filePath = path.join(UPLOAD_DIR, safeName);

        if (!filePath.startsWith(UPLOAD_DIR)) {
            res.writeHead(403);
            return res.end('Forbidden');
        }

        fs.readFile(filePath, (err, content) => {
            if (err) {
                res.writeHead(404);
                return res.end('File not found');
            }
            res.writeHead(200, { 'Content-Type': mime.lookup(filePath) || 'application/octet-stream' });
            res.end(content);
        });

    } else {
        // Serve static files from public/
        let filePath = path.join(PUBLIC_DIR, req.url === '/' ? 'index.html' : req.url);

        if (!filePath.startsWith(PUBLIC_DIR)) {
            res.writeHead(403);
            return res.end('Forbidden');
        }

        fs.readFile(filePath, (err, content) => {
            if (err) {
                if (err.code === 'ENOENT') {
                    res.writeHead(404, { 'Content-Type': 'text/html' });
                    res.end('<h1>404 - File Not Found</h1>', 'utf8');
                } else {
                    res.writeHead(500);
                    res.end(`Server Error: ${err.code}`);
                }
            } else {
                res.writeHead(200, { 'Content-Type': mime.lookup(filePath) || 'text/plain' });
                res.end(content, 'utf8');
            }
        });
    }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`✅ Server running on http://localhost:${PORT}`));
