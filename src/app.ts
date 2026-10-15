import express, { Application, Request, Response } from 'express';
import path from 'path';
import orderRoutes from './APIs/order.api';

const app: Application = express();
const PORT = process.env.PORT || 5000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api', orderRoutes);

// Admin Pages Routes
app.get('/admin/login', (_req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, 'public', 'admin-login.html'));
});

app.get('/admin', (_req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, 'public', 'admin-orders.html'));
});

app.get('/admin/menu', (_req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, 'public', 'admin-menu.html'));
});

app.get('/admin/queries', (_req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, 'public', 'admin-queries.html'));
});

app.get('/admin/sales', (_req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, 'public', 'admin-sales.html'));
});

app.listen(PORT, () => {
  console.log(`Slurpin.pk server running at http://localhost:${PORT}`);
});

export default app;
