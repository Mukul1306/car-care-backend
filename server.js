const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');
require('dotenv').config();

const app = express();

app.use(cors({
  origin: ["https://carcare.netlify.app", "http://localhost:3000"]
}));
app.use(express.json());

// 1. Cloudinary Configuration
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// 2. Setup Cloudinary Storage
const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: async (req, file) => {
        return {
            folder: 'auto_pro_care',
            allowed_formats: ['jpg', 'png', 'jpeg'],
            public_id: Date.now() + '-' + file.originalname.split('.')[0],
        };
    },
});
const upload = multer({ storage: storage });

// 3. MongoDB Connection
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log("✅ Database & Cloudinary Ready"))
    .catch(err => console.error("❌ Connection Error:", err));

// 4. Enhanced Data Schema
const carSchema = new mongoose.Schema({
    customerName: String,
    phoneNumber: String,
    carName: String,
    carModel: String,
    price: Number,
    description: String,
    images: [String], 
    // isAdminEntry: true means YOU added it for the Home Page
    // isAdminEntry: false means a CUSTOMER sent an inquiry
    isAdminEntry: { type: Boolean, default: false }, 
    date: { type: Date, default: Date.now }
});
const Car = mongoose.model('Car', carSchema);

// 5. API ROUTES (Full Control)

// A. ADMIN: Add a car to the Home Page
// ... (Your imports remain the same)

app.post('/api/admin/add-inventory', upload.array('images', 5), async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ success: false, message: "No images uploaded" });
        }

        const imageURLs = req.files.map(file => file.path);
        
        const newCar = new Car({
            customerName: req.body.customerName || "Admin Entry",
            phoneNumber: req.body.phoneNumber || "N/A",
            carName: req.body.carName,
            carModel: req.body.carModel,
            price: Number(req.body.price) || 0, // Prevent NaN crash
            description: req.body.description,
            images: imageURLs,
            isAdminEntry: req.body.isAdminEntry === 'true'
        });

        await newCar.save();
        res.status(201).json({ success: true, message: "Car added successfully!" });
    } catch (error) {
        console.error("SAVE ERROR:", error);
        res.status(500).json({ success: false, message: error.message });
    }
});
app.post('/api/contact', async (req, res) => {
    try {
        const newContact = new Car({
            customerName: req.body.name,
            phoneNumber: req.body.phone,
            description: req.body.message, // Message field ko description mein dalenge
            isAdminEntry: false,
        });
        await newContact.save();
        res.json({ success: true, message: "Hum aapse jaldi baat karenge!" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// B. PUBLIC: Get all inventory for Home Page
app.get('/api/cars/inventory', async (req, res) => {
    try {
        const inventory = await Car.find({ isAdminEntry: true }).sort({ date: -1 });
        res.json(inventory);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// C. ADMIN: Get all Customer Inquiries
app.get('/api/admin/inquiries', async (req, res) => {
    try {
        const inquiries = await Car.find({ isAdminEntry: false }).sort({ date: -1 });
        res.json(inquiries);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// D. ADMIN: Delete any car (Inventory or Inquiry)
app.delete('/api/admin/delete/:id', async (req, res) => {
    try {
        const car = await Car.findById(req.params.id);
        // Optional: Add logic here to delete images from Cloudinary too
        await Car.findByIdAndDelete(req.params.id);
        res.json({ success: true, message: "Deleted successfully" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// E. ADMIN: Update car details
app.put('/api/admin/update/:id', async (req, res) => {
    try {
        const updatedCar = await Car.findByIdAndUpdate(req.params.id, req.body, { new: true });
        res.json({ success: true, car: updatedCar });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Add this at the bottom of server.js
app.use((err, req, res, next) => {
    console.error("DETAILED ERROR:", err);
    res.status(500).json({ success: false, message: err.message });
});

const PORT = 5000;
app.listen(PORT, () => console.log(`🚀 Master Server running on port ${PORT}`));

const jwt = require('jsonwebtoken');

app.post('/api/admin/login', (req, res) => {
    const { username, password } = req.body;

    if (username === process.env.ADMIN_USERNAME && password === process.env.ADMIN_PASSWORD) {
        const token = jwt.sign({ role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '1d' });
        return res.json({ success: true, token });
    }
    res.status(401).json({ success: false, message: "Invalid Credentials" });
});
// Add this at the top level of your routes
app.get('/', (req, res) => {
  res.send('Express Car Care Backend is Live and Running!');
});