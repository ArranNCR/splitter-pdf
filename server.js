const express = require('express');
const multer = require('multer');
const { PDFDocument } = require('pdf-lib');
const fs = require('fs');
const path = require('path');

const app = express();
const upload = multer({ dest: 'uploads/' });

// Allow public access to 'uploads' folder
app.use('/uploads', express.static('uploads'));

// Serve the frontend
app.use(express.static('public'));

// Endpoint to get total page count
app.post('/getPageCount', upload.single('pdf'), async (req, res) => {
    try {
        const inputPath = req.file.path;
        const pdfBytes = fs.readFileSync(inputPath);
        const pdfDoc = await PDFDocument.load(pdfBytes);
        const totalPages = pdfDoc.getPageCount();

        // Send back the total page count
        res.json({ totalPages });

        // Cleanup uploaded file
        fs.unlinkSync(inputPath);
    } catch (error) {
        console.error('Error loading PDF:', error);
        res.status(500).send('Failed to load PDF.');
    }
});

// Endpoint to split the PDF
app.post('/split', upload.single('pdf'), async (req, res) => {
    const { startPage, endPage } = req.body;
    const inputPath = req.file.path;
    const pdfBytes = fs.readFileSync(inputPath);
    const pdfDoc = await PDFDocument.load(pdfBytes);

    const totalPages = pdfDoc.getPageCount();

    // Validate startPage and endPage
    if (startPage < 1 || endPage > totalPages || startPage > endPage) {
        return res.status(400).send('Invalid page range');
    }

    // Create two new PDFs
    const part1Pdf = await PDFDocument.create();
    const part2Pdf = await PDFDocument.create();

    // Copy pages to part1Pdf
    try {
        for (let i = startPage - 1; i < endPage; i++) {
            const [copiedPage] = await part1Pdf.copyPages(pdfDoc, [i]);
            part1Pdf.addPage(copiedPage);
        }
    } catch (error) {
        console.error('Error copying pages for part 1:', error);
        return res.status(500).send('Failed to process selected pages.');
    }

    // Copy remaining pages to part2Pdf if any
    if (endPage < totalPages) {
        try {
            for (let i = endPage; i < totalPages; i++) {
                const [copiedPage] = await part2Pdf.copyPages(pdfDoc, [i]);
                part2Pdf.addPage(copiedPage);
            }
        } catch (error) {
            console.error('Error copying pages for part 2:', error);
            return res.status(500).send('Failed to process remaining pages.');
        }
    }

    // Save both parts to files
    const part1Path = path.join(__dirname, 'uploads', 'split_part1.pdf');
    const part2Path = path.join(__dirname, 'uploads', 'split_part2.pdf');
    fs.writeFileSync(part1Path, await part1Pdf.save());
    fs.writeFileSync(part2Path, await part2Pdf.save());

    // Send file paths to frontend
    res.json({ part1: '/uploads/split_part1.pdf', part2: '/uploads/split_part2.pdf' });

    // Clean up uploaded file
    fs.unlinkSync(inputPath);
});

app.listen(3000, () => {
    console.log('Server running on http://localhost:3000');
});
