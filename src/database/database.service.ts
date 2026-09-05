import { Injectable, Inject, BadRequestException, NotFoundException } from '@nestjs/common';
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

  async createProduct(
    sellerId: string,
    data: { title: string; author: string; price: number; category?: string; stock?: number },
  ) {
    const stock = data.stock ?? 0;
    const result = await this.pool.query(
      `INSERT INTO products (title, author, price, category, stock, seller_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, title, author, price, category, stock, seller_id AS "sellerId", created_at AS "createdAt", updated_at AS "updatedAt"`,
      [data.title, data.author, data.price, data.category ?? null, stock, sellerId || null],
    );
    return result.rows[0];
  }

  async findAllProducts(filters: {
    page?: number;
    limit?: number;
    category?: string;
    minPrice?: number;
    maxPrice?: number;
  }) {
    const page = Math.max(1, Number(filters.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(filters.limit) || 10));
    const offset = (page - 1) * limit;

    const conditions: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (filters.category) {
      conditions.push(`p.category ILIKE $${paramIndex++}`);
      values.push(`%${filters.category}%`);
    }

    if (filters.minPrice !== undefined && !isNaN(Number(filters.minPrice))) {
      conditions.push(`p.price >= $${paramIndex++}`);
      values.push(Number(filters.minPrice));
    }

    if (filters.maxPrice !== undefined && !isNaN(Number(filters.maxPrice))) {
      conditions.push(`p.price <= $${paramIndex++}`);
      values.push(Number(filters.maxPrice));
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await this.pool.query(
      `SELECT COUNT(*)::int AS total FROM products p ${whereClause}`,
      values,
    );
    const total = countResult.rows[0]?.total ?? 0;

    const dataValues = [...values, limit, offset];
    const dataQuery = `
      SELECT 
        p.id,
        p.title,
        p.author,
        p.price,
        p.category,
        p.stock,
        p.seller_id AS "sellerId",
        p.created_at AS "createdAt",
        p.updated_at AS "updatedAt",
        json_build_object(
          'id', u.id,
          'email', u.email,
          'role', u.role
        ) AS seller
      FROM products p
      LEFT JOIN users u ON p.seller_id = u.id
      ${whereClause}
      ORDER BY p.created_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `;

    const dataResult = await this.pool.query(dataQuery, dataValues);

    return {
      data: dataResult.rows,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findProductById(id: string) {
    const result = await this.pool.query(
      `SELECT 
        p.id,
        p.title,
        p.author,
        p.price,
        p.category,
        p.stock,
        p.seller_id AS "sellerId",
        p.created_at AS "createdAt",
        p.updated_at AS "updatedAt",
        json_build_object(
          'id', u.id,
          'email', u.email,
          'role', u.role
        ) AS seller
      FROM products p
      LEFT JOIN users u ON p.seller_id = u.id
      WHERE p.id::text = $1::text`,
      [id],
    );
    return result.rows[0] ?? null;
  }

  async updateProduct(
    id: string,
    data: { title?: string; author?: string; price?: number; category?: string; stock?: number },
  ) {
    const fields: string[] = [];
    const values: any[] = [id];
    let i = 2;

    if (data.title !== undefined) {
      fields.push(`title = $${i++}`);
      values.push(data.title);
    }
    if (data.author !== undefined) {
      fields.push(`author = $${i++}`);
      values.push(data.author);
    }
    if (data.price !== undefined) {
      fields.push(`price = $${i++}`);
      values.push(data.price);
    }
    if (data.category !== undefined) {
      fields.push(`category = $${i++}`);
      values.push(data.category);
    }
    if (data.stock !== undefined) {
      fields.push(`stock = $${i++}`);
      values.push(data.stock);
    }

    if (fields.length === 0) {
      return this.findProductById(id);
    }

    fields.push(`updated_at = NOW()`);

    const queryText = `
      UPDATE products 
      SET ${fields.join(', ')}
      WHERE id::text = $1::text
      RETURNING id, title, author, price, category, stock, seller_id AS "sellerId", created_at AS "createdAt", updated_at AS "updatedAt"
    `;

    const result = await this.pool.query(queryText, values);
    return result.rows[0] ?? null;
  }

  async deleteProduct(id: string) {
    const result = await this.pool.query(
      `DELETE FROM products WHERE id::text = $1::text RETURNING id`,
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

        const itemPrice = item.price !== undefined ? Number(item.price) : Number(product.price);
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