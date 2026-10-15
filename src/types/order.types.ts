export interface IOrder {
  id?: string;
  customerName: string;
  phone: string;
  address: string;
  items: { name: string; quantity: number; price: number }[];
  totalAmount: number;
  status: 'Pending' | 'Preparing' | 'Delivered';
  createdAt?: Date;
}
