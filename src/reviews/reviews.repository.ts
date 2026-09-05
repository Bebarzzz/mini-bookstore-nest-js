import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import { QueryReviewsDto } from './dto/query-reviews.dto.js';

@Injectable()
export class ReviewsRepository {
  constructor(private readonly db: DatabaseService) {}

  async create(userId: string, productId: string, rating: number, comment?: string) {
    const result = await this.db.query(
      `INSERT INTO reviews (user_id, product_id, rating, comment)
       VALUES ($1, $2, $3, $4)
       RETURNING id, user_id AS "userId", product_id AS "productId", rating, comment, created_at AS "createdAt", updated_at AS "updatedAt"`,
      [userId, productId, rating, comment ?? null],
    );
    return result.rows[0];
  }

  async findByUserAndProduct(userId: string, productId: string) {
    const result = await this.db.query(
      `SELECT id, user_id AS "userId", product_id AS "productId", rating, comment, created_at AS "createdAt", updated_at AS "updatedAt"
       FROM reviews
       WHERE user_id::text = $1::text AND product_id::text = $2::text`,
      [userId, productId],
    );
    return result.rows[0] ?? null;
  }

  async findByProduct(productId: string, pagination?: QueryReviewsDto) {
    const page = Math.max(1, Number(pagination?.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(pagination?.limit) || 10));
    const offset = (page - 1) * limit;

    const countRes = await this.db.query(
      `SELECT COUNT(*)::int AS total FROM reviews WHERE product_id::text = $1::text`,
      [productId],
    );
    const total = countRes.rows[0]?.total ?? 0;

    const result = await this.db.query(
      `SELECT 
        r.id,
        r.user_id AS "userId",
        r.product_id AS "productId",
        r.rating,
        r.comment,
        r.created_at AS "createdAt",
        r.updated_at AS "updatedAt",
        json_build_object('id', u.id, 'email', u.email) AS user
       FROM reviews r
       JOIN users u ON r.user_id = u.id
       WHERE r.product_id::text = $1::text
       ORDER BY r.created_at DESC
       LIMIT $2 OFFSET $3`,
      [productId, limit, offset],
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

  async findAll(pagination?: QueryReviewsDto) {
    const page = Math.max(1, Number(pagination?.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(pagination?.limit) || 10));
    const offset = (page - 1) * limit;

    const countRes = await this.db.query(`SELECT COUNT(*)::int AS total FROM reviews`);
    const total = countRes.rows[0]?.total ?? 0;

    const result = await this.db.query(
      `SELECT 
        r.id,
        r.user_id AS "userId",
        r.product_id AS "productId",
        r.rating,
        r.comment,
        r.created_at AS "createdAt",
        r.updated_at AS "updatedAt",
        json_build_object('id', u.id, 'email', u.email) AS user,
        json_build_object('id', p.id, 'title', p.title) AS product
       FROM reviews r
       JOIN users u ON r.user_id = u.id
       JOIN products p ON r.product_id = p.id
       ORDER BY r.created_at DESC
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

  async findById(id: string) {
    const result = await this.db.query(
      `SELECT 
        r.id,
        r.user_id AS "userId",
        r.product_id AS "productId",
        r.rating,
        r.comment,
        r.created_at AS "createdAt",
        r.updated_at AS "updatedAt",
        json_build_object('id', u.id, 'email', u.email) AS user,
        json_build_object('id', p.id, 'title', p.title) AS product
       FROM reviews r
       JOIN users u ON r.user_id = u.id
       JOIN products p ON r.product_id = p.id
       WHERE r.id::text = $1::text`,
      [id],
    );
    return result.rows[0] ?? null;
  }

  async update(id: string, data: { rating?: number; comment?: string }) {
    const fields: string[] = [];
    const values: any[] = [id];
    let i = 2;

    if (data.rating !== undefined) {
      fields.push(`rating = $${i++}`);
      values.push(data.rating);
    }
    if (data.comment !== undefined) {
      fields.push(`comment = $${i++}`);
      values.push(data.comment);
    }

    if (fields.length === 0) {
      return this.findById(id);
    }

    fields.push(`updated_at = NOW()`);

    const queryText = `
      UPDATE reviews 
      SET ${fields.join(', ')}
      WHERE id::text = $1::text
      RETURNING id, user_id AS "userId", product_id AS "productId", rating, comment, created_at AS "createdAt", updated_at AS "updatedAt"
    `;
    const result = await this.db.query(queryText, values);
    return result.rows[0] ?? null;
  }

  async delete(id: string) {
    const result = await this.db.query(
      `DELETE FROM reviews WHERE id::text = $1::text RETURNING id`,
      [id],
    );
    return result.rows[0] ?? null;
  }
}
