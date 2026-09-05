import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import { QueryOrdersDto } from './dto/query-orders.dto.js';

@Injectable()
export class OrdersRepository {
  constructor(private readonly db: DatabaseService) {}

  async createOrder(
    userId: string | number,
    itemsOrBookId: Array<{ bookId: string | number; quantity: number; price?: number }> | string | number,
    quantity?: number,
    status: string = 'pending',
  ) {
    let items: Array<{ bookId: string | number; quantity: number; price?: number }> = [];

    if (Array.isArray(itemsOrBookId)) {
      items = itemsOrBookId;
    } else if (itemsOrBookId !== undefined) {
      items = [{ bookId: itemsOrBookId, quantity: quantity ?? 1 }];
    }

    const client = await this.db.getClient();
    try {
      await client.query('BEGIN');

      let totalPrice = 0;
      const preparedItems: Array<{ bookId: string | number; quantity: number; price: number }> = [];

      for (const item of items) {
        // 1. Lock the product row using SELECT ... FOR UPDATE to prevent race conditions & overselling
        const productRes = await client.query(
          `SELECT id, title, price, stock FROM products WHERE id::text = $1::text FOR UPDATE`,
          [item.bookId],
        );

        const product = productRes.rows[0];
        if (!product) {
          throw new NotFoundException(`Product with ID ${item.bookId} not found`);
        }

        // 2. Validate stock availability
        if (Number(product.stock) < item.quantity) {
          throw new BadRequestException(
            `Insufficient stock for product "${product.title}" (ID: ${item.bookId}). Available: ${product.stock}, requested: ${item.quantity}`,
          );
        }

        // 3. Decrement product stock within the transaction
        await client.query(
          `UPDATE products SET stock = stock - $1, updated_at = NOW() WHERE id::text = $2::text`,
          [item.quantity, item.bookId],
        );

        // 4. Force authoritative price from database product record (Defense-in-Depth against tampering)
        const itemPrice = Number(product.price);
        totalPrice += itemPrice * item.quantity;
        preparedItems.push({
          bookId: item.bookId,
          quantity: item.quantity,
          price: itemPrice,
        });
      }

      const orderResult = await client.query(
        `INSERT INTO orders (user_id, total_price, status)
         VALUES ($1, $2, $3)
         RETURNING id, user_id, total_price, status, created_at, updated_at`,
        [userId, totalPrice, status],
      );
      const order = orderResult.rows[0];

      const insertedItems = [];
      for (const item of preparedItems) {
        const itemResult = await client.query(
          `INSERT INTO order_items (order_id, book_id, quantity, price)
           VALUES ($1, $2, $3, $4)
           RETURNING id, order_id, book_id, quantity, price, created_at`,
          [order.id, item.bookId, item.quantity, item.price],
        );
        insertedItems.push(itemResult.rows[0]);
      }

      await client.query('COMMIT');

      return {
        ...order,
        items: insertedItems,
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async findOrdersByUser(userId: string | number, pagination?: QueryOrdersDto) {
    const page = Math.max(1, Number(pagination?.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(pagination?.limit) || 10));
    const offset = (page - 1) * limit;

    const countRes = await this.db.query(
      `SELECT COUNT(*)::int AS total FROM orders WHERE user_id::text = $1::text`,
      [userId],
    );
    const total = countRes.rows[0]?.total ?? 0;

    const result = await this.db.query(
      `SELECT 
        o.*,
        COALESCE(
          json_agg(
            json_build_object(
              'id', oi.id,
              'book_id', oi.book_id,
              'quantity', oi.quantity,
              'price', oi.price,
              'title', p.title,
              'author', p.author
            ) ORDER BY oi.created_at ASC
          ) FILTER (WHERE oi.id IS NOT NULL),
          '[]'
        ) AS items
       FROM orders o
       LEFT JOIN order_items oi ON o.id = oi.order_id
       LEFT JOIN products p ON oi.book_id = p.id
       WHERE o.user_id::text = $1::text
       GROUP BY o.id
       ORDER BY o.created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset],
    );

    return {
      data: result.rows,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOrderById(orderId: string) {
    const result = await this.db.query(
      `SELECT 
        o.*,
        COALESCE(
          json_agg(
            json_build_object(
              'id', oi.id,
              'book_id', oi.book_id,
              'quantity', oi.quantity,
              'price', oi.price,
              'title', p.title,
              'author', p.author
            ) ORDER BY oi.created_at ASC
          ) FILTER (WHERE oi.id IS NOT NULL),
          '[]'
        ) AS items
       FROM orders o
       LEFT JOIN order_items oi ON o.id = oi.order_id
       LEFT JOIN products p ON oi.book_id = p.id
       WHERE o.id::text = $1::text
       GROUP BY o.id`,
      [orderId],
    );
    return result.rows[0] ?? null;
  }

  async findAllOrders(pagination?: QueryOrdersDto) {
    const page = Math.max(1, Number(pagination?.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(pagination?.limit) || 10));
    const offset = (page - 1) * limit;

    const countRes = await this.db.query(`SELECT COUNT(*)::int AS total FROM orders`);
    const total = countRes.rows[0]?.total ?? 0;

    const result = await this.db.query(
      `SELECT 
        o.*,
        COALESCE(
          json_agg(
            json_build_object(
              'id', oi.id,
              'book_id', oi.book_id,
              'quantity', oi.quantity,
              'price', oi.price,
              'title', p.title,
              'author', p.author
            ) ORDER BY oi.created_at ASC
          ) FILTER (WHERE oi.id IS NOT NULL),
          '[]'
        ) AS items
       FROM orders o
       LEFT JOIN order_items oi ON o.id = oi.order_id
       LEFT JOIN products p ON oi.book_id = p.id
       GROUP BY o.id
       ORDER BY o.created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset],
    );

    return {
      data: result.rows,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async updateOrder(orderId: string, data: { status?: string }) {
    if (!data.status) return this.findOrderById(orderId);

    return this.db.transaction(async (client) => {
      // 1. Check current order status
      const currentRes = await client.query(
        `SELECT status FROM orders WHERE id::text = $1::text FOR UPDATE`,
        [orderId],
      );
      const current = currentRes.rows[0];
      if (!current) return null;

      // 2. If transitioning to 'cancelled' and was not cancelled before, restore stock
      if (data.status === 'cancelled' && current.status !== 'cancelled') {
        await client.query(
          `UPDATE products p
           SET stock = p.stock + oi.quantity, updated_at = NOW()
           FROM order_items oi
           WHERE oi.order_id::text = $1::text AND p.id = oi.book_id`,
          [orderId],
        );
      }

      // 3. If transitioning FROM 'cancelled' back to another active status, re-check and decrement stock
      if (current.status === 'cancelled' && data.status !== 'cancelled') {
        const itemsRes = await client.query(
          `SELECT oi.book_id, oi.quantity, p.title, p.stock
           FROM order_items oi
           JOIN products p ON oi.book_id = p.id
           WHERE oi.order_id::text = $1::text
           FOR UPDATE OF p`,
          [orderId],
        );
        for (const item of itemsRes.rows) {
          if (Number(item.stock) < item.quantity) {
            throw new BadRequestException(
              `Cannot reactivate order: insufficient stock for product "${item.title}". Available: ${item.stock}, required: ${item.quantity}`,
            );
          }
          await client.query(
            `UPDATE products SET stock = stock - $1, updated_at = NOW() WHERE id::text = $2::text`,
            [item.quantity, item.book_id],
          );
        }
      }

      const result = await client.query(
        `UPDATE orders
         SET status = $1, updated_at = NOW()
         WHERE id::text = $2::text
         RETURNING id, user_id, total_price, status, created_at, updated_at`,
        [data.status, orderId],
      );
      return result.rows[0] ?? null;
    });
  }

  async deleteOrder(orderId: string) {
    return this.db.transaction(async (client) => {
      const currentRes = await client.query(
        `SELECT status FROM orders WHERE id::text = $1::text FOR UPDATE`,
        [orderId],
      );
      const current = currentRes.rows[0];
      if (!current) return null;

      // If the order was not already cancelled, restore inventory before deletion
      if (current.status !== 'cancelled') {
        await client.query(
          `UPDATE products p
           SET stock = p.stock + oi.quantity, updated_at = NOW()
           FROM order_items oi
           WHERE oi.order_id::text = $1::text AND p.id = oi.book_id`,
          [orderId],
        );
      }

      const result = await client.query(
        `DELETE FROM orders WHERE id::text = $1::text RETURNING id`,
        [orderId],
      );
      return result.rows[0] ?? null;
    });
  }

  async hasUserPurchasedProduct(userId: string, productId: string): Promise<boolean> {
    const result = await this.db.query(
      `SELECT 1 FROM orders o
       JOIN order_items oi ON o.id = oi.order_id
       WHERE o.user_id::text = $1::text
         AND oi.book_id::text = $2::text
       LIMIT 1`,
      [userId, productId],
    );
    return (result.rowCount ?? 0) > 0;
  }
}
