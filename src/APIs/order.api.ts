import { Router, Request, Response, NextFunction } from 'express';

const router = Router();

export let ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const ADMIN_TOKEN = process.env.ADMIN_SESSION_TOKEN || 'slurpin-admin-secret-token';
const ADMIN_AUTHORIZED_PHONE = '03032781433';

let activeRecoveryOtp: { code: string; expiresAt: number } | null = null;

export let menuItems = [
  {
    id: '1',
    name: 'Volcanic Steam Momos (8 Pcs)',
    price: 500,
    description: 'Juicy chicken filled dumplings served with our secret fiery garlic dip and hot chili oil.',
    image: 'https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?auto=format&fit=crop&w=800&q=80',
    tag: 'POPULAR'
  },
  {
    id: '2',
    name: 'Signature Spicy Hotpot Bowl',
    price: 1000,
    description: 'Rich broth loaded with noodles, mushrooms, tender chicken chunks, and aromatic oriental spices.',
    image: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=800&q=80',
    tag: 'NEW ARRIVAL'
  }
];

let orders: any[] = [];
let queries: any[] = [];

const verifyAdminAuth = (req: Request, res: Response, next: NextFunction) => {
  const token = req.headers['x-admin-token'];
  if (token === ADMIN_TOKEN) {
    next();
  } else {
    res.status(401).json({ success: false, message: 'Unauthorized: Invalid Admin Token' });
  }
};

router.post('/admin/login', (req: Request, res: Response) => {
  const { password } = req.body;
  if (password === ADMIN_PASSWORD) {
    res.json({ success: true, token: ADMIN_TOKEN, message: 'Login successful!' });
  } else {
    res.status(401).json({ success: false, message: 'Galat Password! Dubara koshish karein.' });
  }
});

router.post('/admin/forgot-password', (req: Request, res: Response) => {
  const { phone } = req.body;
  const cleanInputPhone = phone.replace(/[^0-9]/g, '');
  const cleanTargetPhone = ADMIN_AUTHORIZED_PHONE.replace(/[^0-9]/g, '');

  if (cleanInputPhone === cleanTargetPhone || cleanInputPhone.endsWith(cleanTargetPhone.slice(-10))) {
    const generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();
    activeRecoveryOtp = {
      code: generatedOtp,
      expiresAt: Date.now() + 5 * 60 * 1000
    };

    console.log(`\n========================================`);
    console.log(`📱 SLURPIN.PK ADMIN OTP CODE: ${generatedOtp}`);
    console.log(`========================================\n`);

    res.json({ 
      success: true, 
      message: `OTP Code generated: ${generatedOtp}`,
      debugOtp: generatedOtp
    });
  } else {
    res.status(403).json({ success: false, message: 'Ye number authorized admin ka nahi hai!' });
  }
});

router.post('/admin/verify-otp', (req: Request, res: Response) => {
  const { otp } = req.body;
  if (!activeRecoveryOtp) {
    res.status(400).json({ success: false, message: 'Pehle recovery request generate karein.' });
    return;
  }
  if (Date.now() > activeRecoveryOtp.expiresAt) {
    res.status(400).json({ success: false, message: 'OTP expire ho chuka hai.' });
    return;
  }
  if (otp === activeRecoveryOtp.code) {
    res.json({ success: true, resetToken: 'slurpin_reset_authorized_token_99' });
  } else {
    res.status(400).json({ success: false, message: 'Galat verification code!' });
  }
});

router.post('/admin/reset-password', (req: Request, res: Response) => {
  const { resetToken, newPassword } = req.body;
  if (resetToken !== 'slurpin_reset_authorized_token_99') {
    res.status(401).json({ success: false, message: 'Unauthorized reset attempt.' });
    return;
  }
  if (!newPassword || newPassword.length < 4) {
    res.status(400).json({ success: false, message: 'Password kam az kam 4 characters ka ho.' });
    return;
  }
  ADMIN_PASSWORD = newPassword;
  activeRecoveryOtp = null;
  res.json({ success: true, message: 'Password successfully updated!' });
});

router.get('/menu', (_req: Request, res: Response) => {
  res.json({ success: true, menu: menuItems });
});

router.post('/orders', (req: Request, res: Response) => {
  const newOrder = { 
    id: Date.now().toString(), 
    ...req.body, 
    status: 'Pending', 
    createdAt: new Date() 
  };
  orders.push(newOrder);
  res.status(201).json({ success: true, message: 'Order placed successfully!', order: newOrder });
});

// Save Customer Query from Website
router.post('/queries', (req: Request, res: Response) => {
  const newQuery = {
    id: Date.now().toString(),
    ...req.body,
    createdAt: new Date()
  };
  queries.push(newQuery);
  res.status(201).json({ success: true, message: 'Query submitted successfully!', query: newQuery });
});

// Admin Get Queries
router.get('/admin/queries', verifyAdminAuth, (_req: Request, res: Response) => {
  res.json({ success: true, queries });
});

router.post('/admin/menu', verifyAdminAuth, (req: Request, res: Response) => {
  const { name, price, description, image, tag } = req.body;
  const newItem = {
    id: Date.now().toString(),
    name,
    price: Number(price),
    description,
    image,
    tag: tag || 'NEW ARRIVAL'
  };
  menuItems.push(newItem);
  res.status(201).json({ success: true, message: 'New menu item launched!', item: newItem });
});

router.put('/admin/menu/:id', verifyAdminAuth, (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, price, description, image, tag } = req.body;
  const itemIndex = menuItems.findIndex(item => item.id === id);
  if (itemIndex === -1) {
    res.status(404).json({ success: false, message: 'Menu item not found' });
    return;
  }
  menuItems[itemIndex] = {
    id,
    name: name || menuItems[itemIndex].name,
    price: price !== undefined ? Number(price) : menuItems[itemIndex].price,
    description: description || menuItems[itemIndex].description,
    image: image || menuItems[itemIndex].image,
    tag: tag || menuItems[itemIndex].tag
  };
  res.json({ success: true, message: 'Menu item updated!', item: menuItems[itemIndex] });
});

router.delete('/admin/menu/:id', verifyAdminAuth, (req: Request, res: Response) => {
  const { id } = req.params;
  menuItems = menuItems.filter(item => item.id !== id);
  res.json({ success: true, message: 'Menu item deleted!' });
});

router.get('/admin/orders', verifyAdminAuth, (_req: Request, res: Response) => {
  res.json({ success: true, orders });
});

router.patch('/admin/orders/:id/deliver', verifyAdminAuth, (req: Request, res: Response) => {
  const { id } = req.params;
  const order = orders.find(o => o.id === id);
  if (!order) {
    res.status(404).json({ success: false, message: 'Order not found' });
    return;
  }
  order.status = 'Delivered';
  const whatsappMsg = `Assalam-o-Alaikum *${order.customerName}*! 🎉\n\nAapka *Slurpin.pk* ka order delivered ho gaya hai. Total Bill: Rs. ${order.totalAmount}`;
  const cleanPhone = order.phone.replace(/[^0-9]/g, '');
  const formattedPhone = cleanPhone.startsWith('03') ? '92' + cleanPhone.slice(1) : cleanPhone;
  const whatsappUrl = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(whatsappMsg)}`;

  res.json({ success: true, message: 'Order delivered!', whatsappUrl, order });
});

router.get('/admin/sales-report', verifyAdminAuth, (_req: Request, res: Response) => {
  const deliveredOrders = orders.filter(o => o.status === 'Delivered');
  res.json({
    success: true,
    overallRevenue: deliveredOrders.reduce((sum, o) => sum + Number(o.totalAmount || 0), 0),
    overallDeliveredOrders: deliveredOrders.length,
    monthlyReport: []
  });
});

export default router;
