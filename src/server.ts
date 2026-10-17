import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

const ADMIN_RECOVERY_PHONE = process.env.ADMIN_RECOVERY_PHONE || '03032781433';
const BUSINESS_WHATSAPP_PHONE = process.env.BUSINESS_WHATSAPP_PHONE || '03366833202';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'slurpin_secure_token_abc987';

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const DATA_DIR = path.join(__dirname, '../data');
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

const ORDERS_FILE = path.join(DATA_DIR, 'orders.json');
const MENU_FILE = path.join(DATA_DIR, 'menu.json');
const QUERIES_FILE = path.join(DATA_DIR, 'queries.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');

function readJSON(file, defaultVal) {
    if (!fs.existsSync(file)) return defaultVal;
    try {
        return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch {
        return defaultVal;
    }
}

function writeJSON(file, data) {
    fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
}

if (!fs.existsSync(MENU_FILE)) {
    writeJSON(MENU_FILE, [
        { id: '1', name: 'Volcanic Steam Dumplings', price: 650, image: 'https://images.unsplash.com/photo-1541696432-82c6da8ce7bf?auto=format&fit=crop&w=800&q=80', tag: 'BESTSELLER', description: 'Juicy chicken dumplings drenched in fiery volcano chili oil.' },
        { id: '2', name: 'Sizzling Beef Hotpot Bowl', price: 1200, image: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=800&q=80', tag: 'CHEF SPECIAL', description: 'Soul-warming broth with tender beef slices, noodles, and mushrooms.' }
    ]);
}

const defaultSettings = {
    paymentTitle: 'Bank Transfer / EasyPaisa / JazzCash',
    paymentDetails: 'Account Title: Slurpin\nAccount Number: 0336-6833202\nBank: Meezan Bank',
    paymentInstruction: 'After payment done send the screenshot on WhatsApp with your order slip.'
};

if (!fs.existsSync(SETTINGS_FILE)) {
    writeJSON(SETTINGS_FILE, defaultSettings);
}

let otpStore = {};

// --- PUBLIC API ROUTES ---

app.get('/api/menu', (req, res) => {
    const menu = readJSON(MENU_FILE, []);
    res.json({ menu });
});

app.get('/api/settings', (req, res) => {
    const settings = readJSON(SETTINGS_FILE, defaultSettings);
    res.json(settings);
});

app.post('/api/orders', (req, res) => {
    const { customerName, phone, address, items, totalAmount, paymentMethod } = req.body;
    const orders = readJSON(ORDERS_FILE, []);
    
    const nextNum = 1000 + orders.length + 1;
    const fourDigitId = String(nextNum);

    const newOrder = {
        id: fourDigitId,
        customerName,
        phone,
        address,
        items,
        totalAmount,
        paymentMethod: paymentMethod || 'Online Payment',
        status: 'Pending',
        createdAt: new Date().toLocaleString('en-US', { timeZone: 'Asia/Karachi' })
    };
    orders.unshift(newOrder);
    writeJSON(ORDERS_FILE, orders);
    res.json({ success: true, order: newOrder });
});

app.post('/api/queries', (req, res) => {
    const { name, phone, message } = req.body;
    const queries = readJSON(QUERIES_FILE, []);
    const newQuery = {
        id: 'q_' + Date.now(),
        name,
        phone,
        message,
        createdAt: new Date().toLocaleString('en-US', { timeZone: 'Asia/Karachi' })
    };
    queries.unshift(newQuery);
    writeJSON(QUERIES_FILE, queries);
    res.json({ success: true });
});

// --- ADMIN AUTH & RECOVERY ---

app.post('/api/admin/login', (req, res) => {
    const { password } = req.body;
    const adminPass = process.env.ADMIN_PASSWORD || 'admin123';
    if (password === adminPass) {
        res.json({ success: true, token: ADMIN_TOKEN });
    } else {
        res.status(401).json({ success: false, message: 'Invalid admin password' });
    }
});

app.post('/api/admin/forgot-password', (req, res) => {
    const { phone } = req.body;
    if (phone !== ADMIN_RECOVERY_PHONE) {
        return res.status(400).json({ success: false, message: 'Unauthorized recovery phone number.' });
    }
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    otpStore[ADMIN_RECOVERY_PHONE] = otp;
    
    console.log(`\n========================================`);
    console.log(`🔑 ADMIN PASSWORD RECOVERY OTP: ${otp}`);
    console.log(`========================================\n`);

    const msg = `Your Slurpin Admin Password Recovery OTP is: *${otp}*`;
    const whatsappUrl = `https://wa.me/92${ADMIN_RECOVERY_PHONE.slice(1)}?text=${encodeURIComponent(msg)}`;
    
    res.json({ success: true, message: 'OTP generated', whatsappUrl });
});

app.post('/api/admin/reset-password', (req, res) => {
    const { phone, otp, newPassword } = req.body;
    if (phone !== ADMIN_RECOVERY_PHONE || otpStore[phone] !== otp) {
        return res.status(400).json({ success: false, message: 'Invalid OTP or phone number.' });
    }
    process.env.ADMIN_PASSWORD = newPassword;
    delete otpStore[phone];
    res.json({ success: true, message: 'Password successfully updated!' });
});

// --- ADMIN PROTECTED API ROUTES ---

function verifyAdmin(req, res, next) {
    const token = req.headers['x-admin-token'];
    if (token === ADMIN_TOKEN) {
        next();
    } else {
        res.status(401).json({ success: false, message: 'Unauthorized' });
    }
}

app.get('/api/admin/orders', verifyAdmin, (req, res) => {
    const orders = readJSON(ORDERS_FILE, []);
    res.json({ orders });
});

app.patch('/api/admin/orders/:id/deliver', verifyAdmin, (req, res) => {
    const orders = readJSON(ORDERS_FILE, []);
    const order = orders.find(o => o.id === req.params.id);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
    
    order.status = 'Delivered';
    writeJSON(ORDERS_FILE, orders);

    const cleanPhone = order.phone.replace(/[^0-9]/g, '');
    const custPhoneFormatted = cleanPhone.startsWith('03') ? '92' + cleanPhone.slice(1) : cleanPhone;
    
    const deliveryMsg = `Hi ${order.customerName}, your Slurpin order #${order.id} has been delivered! Thank you. 🥟`;
    const whatsappUrl = `https://wa.me/${custPhoneFormatted}?text=${encodeURIComponent(deliveryMsg)}`;

    res.json({ success: true, whatsappUrl });
});

app.delete('/api/admin/orders/:id', verifyAdmin, (req, res) => {
    let orders = readJSON(ORDERS_FILE, []);
    const orderExists = orders.some(o => o.id === req.params.id);
    if (!orderExists) {
        return res.status(404).json({ success: false, message: 'Order not found' });
    }
    orders = orders.filter(o => o.id !== req.params.id);
    writeJSON(ORDERS_FILE, orders);
    res.json({ success: true, message: 'Order deleted successfully' });
});

app.get('/api/admin/queries', verifyAdmin, (req, res) => {
    const queries = readJSON(QUERIES_FILE, []);
    res.json({ queries });
});

app.delete('/api/admin/queries/:id', verifyAdmin, (req, res) => {
    let queries = readJSON(QUERIES_FILE, []);
    const exists = queries.some(q => q.id === req.params.id);
    if (!exists) {
        return res.status(404).json({ success: false, message: 'Query not found' });
    }
    queries = queries.filter(q => q.id !== req.params.id);
    writeJSON(QUERIES_FILE, queries);
    res.json({ success: true, message: 'Query deleted successfully' });
});

app.get('/api/admin/sales-report', verifyAdmin, (req, res) => {
    const orders = readJSON(ORDERS_FILE, []);
    const deliveredOrders = orders.filter(o => o.status === 'Delivered');
    
    let overallRevenue = deliveredOrders.reduce((sum, o) => sum + o.totalAmount, 0);
    
    let monthlyMap = {};
    deliveredOrders.forEach(o => {
        const month = new Date(o.createdAt).toLocaleString('en-US', { month: 'long', year: 'numeric' });
        if (!monthlyMap[month]) {
            monthlyMap[month] = { month, totalOrders: 0, totalRevenue: 0 };
        }
        monthlyMap[month].totalOrders += 1;
        monthlyMap[month].totalRevenue += o.totalAmount;
    });

    res.json({
        overallRevenue,
        overallDeliveredOrders: deliveredOrders.length,
        monthlyReport: Object.values(monthlyMap),
        deliveredOrdersList: deliveredOrders
    });
});

app.get('/api/admin/settings', verifyAdmin, (req, res) => {
    const settings = readJSON(SETTINGS_FILE, defaultSettings);
    res.json(settings);
});

app.post('/api/admin/settings', verifyAdmin, (req, res) => {
    const { paymentTitle, paymentDetails, paymentInstruction } = req.body;
    const settings = { paymentTitle, paymentDetails, paymentInstruction };
    writeJSON(SETTINGS_FILE, settings);
    res.json({ success: true, settings });
});

app.post('/api/admin/menu', verifyAdmin, (req, res) => {
    const { name, price, image, tag, description } = req.body;
    const menu = readJSON(MENU_FILE, []);
    const newItem = { id: 'm_' + Date.now(), name, price: Number(price), image, tag, description };
    menu.push(newItem);
    writeJSON(MENU_FILE, menu);
    res.json({ success: true, item: newItem });
});

app.patch('/api/admin/menu/:id', verifyAdmin, (req, res) => {
    const { name, price, image, tag, description } = req.body;
    let menu = readJSON(MENU_FILE, []);
    const itemIndex = menu.findIndex(i => i.id === req.params.id);
    if (itemIndex === -1) {
        return res.status(404).json({ success: false, message: 'Menu item not found' });
    }
    menu[itemIndex] = {
        ...menu[itemIndex],
        name: name || menu[itemIndex].name,
        price: price ? Number(price) : menu[itemIndex].price,
        image: image || menu[itemIndex].image,
        tag: tag !== undefined ? tag : menu[itemIndex].tag,
        description: description || menu[itemIndex].description
    };
    writeJSON(MENU_FILE, menu);
    res.json({ success: true, item: menu[itemIndex] });
});

app.delete('/api/admin/menu/:id', verifyAdmin, (req, res) => {
    let menu = readJSON(MENU_FILE, []);
    menu = menu.filter(i => i.id !== req.params.id);
    writeJSON(MENU_FILE, menu);
    res.json({ success: true });
});

app.get('/admin/login', (req, res) => res.sendFile(path.join(__dirname, 'public/admin-login.html')));
app.get('/admin/menu', (req, res) => res.sendFile(path.join(__dirname, 'public/admin-menu.html')));
app.get('/admin/queries', (req, res) => res.sendFile(path.join(__dirname, 'public/admin-queries.html')));
app.get('/admin/sales', (req, res) => res.sendFile(path.join(__dirname, 'public/admin-sales.html')));
app.get('/admin/settings', (req, res) => res.sendFile(path.join(__dirname, 'public/admin-settings.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public/admin-orders.html')));

app.listen(PORT, () => {
    console.log(`Slurpin server running on http://localhost:${PORT}`);
});
