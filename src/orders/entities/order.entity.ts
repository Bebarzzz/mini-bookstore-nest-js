import { OrderItem } from './order-item.entity.js';

export class Order {
  id: string;
  userId: string;
  totalPrice: number;
  status: string;
  items?: OrderItem[];
  createdAt: Date;
  updatedAt: Date;
}
