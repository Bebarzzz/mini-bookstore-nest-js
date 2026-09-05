import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import { QueryProductsDto } from './dto/query-products.dto.js';

@Injectable()
export class ProductsRepository {
  constructor(private readonly db: DatabaseService) {}

  async create(
    sellerId: string,
    data: {
      title: string;
      author: string;
      price: number;
      category?: string;
      stock?: number;
      description?: string;
    },
  ) {
    const stock = data.stock ?? 0;
    const result = await this.db.query(
      `INSERT INTO products (title, author, description, price, category, stock, seller_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, title, author, description, price, category, stock, seller_id AS "sellerId", created_at AS "createdAt", updated_at AS "updatedAt"`,
      [
        data.title,
        data.author,
        data.description ?? null,
        data.price,
        data.category ?? null,
        stock,
        sellerId || null,
      ],
    );
    return result.rows[0];
  }

  async findAll(filters: QueryProductsDto) {
    const page = Math.max(1, Number(filters.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(filters.limit) || 10));
    const offset = (page - 1) * limit;

    const conditions: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    let rankSelect = '';
    let orderBy = 'ORDER BY p.created_at DESC';

    // Full-Text Search via PostgreSQL tsvector & GIN index
    if (filters.search && filters.search.trim() !== '') {
      const searchParam = filters.search.trim();
      const searchIdx = paramIndex++;
      conditions.push(`p.search_vector @@ plainto_tsquery('english', $${searchIdx})`);
      values.push(searchParam);
      rankSelect = `, ts_rank(p.search_vector, plainto_tsquery('english', $${searchIdx})) AS rank`;
      orderBy = `ORDER BY rank DESC, p.created_at DESC`;
    }

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

    const countResult = await this.db.query(
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
        p.description,
        p.price,
        p.category,
        p.stock,
        p.seller_id AS "sellerId",
        p.created_at AS "createdAt",
        p.updated_at AS "updatedAt"${rankSelect},
        json_build_object(
          'id', u.id,
          'email', u.email,
          'role', u.role
        ) AS seller
      FROM products p
      LEFT JOIN users u ON p.seller_id = u.id
      ${whereClause}
      ${orderBy}
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `;

    const dataResult = await this.db.query(dataQuery, dataValues);

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

  async findById(id: string) {
    const result = await this.db.query(
      `SELECT 
        p.id,
        p.title,
        p.author,
        p.description,
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

  async update(
    id: string,
    data: {
      title?: string;
      author?: string;
      price?: number;
      category?: string;
      stock?: number;
      description?: string;
    },
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
    if (data.description !== undefined) {
      fields.push(`description = $${i++}`);
      values.push(data.description);
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
      return this.findById(id);
    }

    fields.push(`updated_at = NOW()`);

    const queryText = `
      UPDATE products 
      SET ${fields.join(', ')}
      WHERE id::text = $1::text
      RETURNING id, title, author, description, price, category, stock, seller_id AS "sellerId", created_at AS "createdAt", updated_at AS "updatedAt"
    `;

    const result = await this.db.query(queryText, values);
    return result.rows[0] ?? null;
  }

  async delete(id: string) {
    const result = await this.db.query(
      `DELETE FROM products WHERE id::text = $1::text RETURNING id`,
      [id],
    );
    return result.rows[0] ?? null;
  }
}
