import { Injectable, Inject } from '@nestjs/common';
import { Pool } from 'pg';


@Injectable()
export class DatabaseService {
  constructor(@Inject('PG_CONNECTION') private pool: Pool) { }

  // A reusable method to execute queries
  async query(text: string, params?: any[]) {
    return this.pool.query(text, params);
  }


  async createUser(email: string, passwordHash: string, role: 'buyer' | 'seller') {
    const result = await this.pool.query(
      `INSERT INTO users (email, password_hash, role)
     VALUES ($1, $2, $3)
     RETURNING id, email, role, created_at`,
      [email, passwordHash, role],
    );
    return result.rows[0];
  }

  async findUserByEmail(email: string) {
    const result = await this.pool.query(
      `SELECT * FROM users WHERE email = $1`,
      [email],
    );
    return result.rows[0] ?? null;
  }

  async createBook(title: string, author: string, price: number) {
    const result = await this.pool.query(
      `INSERT INTO books (title, author, price) VALUES ($1, $2, $3) RETURNING id, title, author, price, created_at`,
      [title, author, price],
    );
    return result.rows[0];
  }

  async findAllBooks() {
    const result = await this.pool.query(
      `SELECT * FROM books ORDER BY created_at DESC`,
    );
    return result.rows;
  }

  async findBookById(id: number) {
    const result = await this.pool.query(
      `SELECT * FROM books WHERE id = $1`,
      [id],
    );
    return result.rows[0] ?? null;
  }

  async updateBook(id: number, title?: string, author?: string, price?: number) {

    const fields: string[] = [];
    const values: (number | string)[] = [id];
    let i = 2;

    if (title !== undefined) { fields.push(`title = $${i++}`); values.push(title); }
    if (author !== undefined) { fields.push(`author = $${i++}`); values.push(author); }
    if (price !== undefined) { fields.push(`price = $${i++}`); values.push(price); }
    if (fields.length === 0) {
      return this.findBookById(id);
    }
    const queryText = `
    UPDATE books 
    SET ${fields.join(', ')}
    WHERE id = $1
    RETURNING id, title, author, price, created_at
  `;

    const result = await this.pool.query(queryText, values);
    return result.rows[0] ?? null;

  }

  async deleteBook(id: number) {
    const result = await this.pool.query(
      `DELETE FROM books WHERE id = $1 RETURNING id`,
      [id],
    );
    return result.rows[0] ?? null;
  }
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

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      let totalPrice = 0;
      const preparedItems: Array<{ bookId: string | number; quantity: number; price: number }> = [];

      for (const item of items) {
        let price = item.price;
        if (price === undefined) {
          const productRes = await client.query(
            `SELECT price FROM products WHERE id::text = $1::text LIMIT 1`,
            [item.bookId],
          );
          if (productRes.rows[0]) {
            price = Number(productRes.rows[0].price);
          } else {
            price = 0;
          }
        }
        const itemPrice = Number(price);
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

  async findOrdersByUser(userId: string | number) {
    const result = await this.pool.query(
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
       ORDER BY o.created_at DESC`,
      [userId],
    );
    return result.rows;
  }

  async findOrderById(orderId: string) {
    const result = await this.pool.query(
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

  async findAllOrders() {
    const result = await this.pool.query(
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
       ORDER BY o.created_at DESC`,
    );
    return result.rows;
  }

  async updateOrder(orderId: string, data: { status?: string }) {
    if (!data.status) return this.findOrderById(orderId);

    const result = await this.pool.query(
      `UPDATE orders
       SET status = $1, updated_at = NOW()
       WHERE id::text = $2::text
       RETURNING id, user_id, total_price, status, created_at, updated_at`,
      [data.status, orderId],
    );
    return result.rows[0] ?? null;
  }

  async deleteOrder(orderId: string) {
    const result = await this.pool.query(
      `DELETE FROM orders WHERE id::text = $1::text RETURNING id`,
      [orderId],
    );
    return result.rows[0] ?? null;
  }

  async createReview(userId: number, bookId: number, rating: number, comment: string) {
    const result = await this.pool.query(
      `INSERT INTO reviews (user_id, book_id, rating, comment) VALUES ($1, $2, $3, $4) RETURNING id, user_id, book_id, rating, comment, created_at`,
      [userId, bookId, rating, comment],
    );
    return result.rows[0];
  }

  async findReviewsByBook(bookId: number) {
    const result = await this.pool.query(
      `SELECT r.*, u.email FROM reviews r JOIN users u ON r.user_id = u.id WHERE r.book_id = $1 ORDER BY r.created_at DESC`,
      [bookId],
    );
    return result.rows;
  }

}