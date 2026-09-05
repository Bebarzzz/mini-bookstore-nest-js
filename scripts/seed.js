import pg from 'pg';
import bcrypt from 'bcrypt';
import { faker } from '@faker-js/faker';

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || undefined,
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'mini_bookstore',
  password: process.env.DB_PASSWORD || 'ana_password',
  port: Number(process.env.DB_PORT) || 5432,
});

const CATEGORIES = [
  'Science Fiction',
  'Fantasy',
  'Technology',
  'Software Engineering',
  'Mystery & Thriller',
  'History',
  'Biography',
  'Business & Finance',
  'Self-Help',
  'Philosophy',
];

async function seed() {
  const client = await pool.connect();
  console.log('🌱 Connected to database. Starting seed process...');

  try {
    await client.query('BEGIN');

    // 1. Seed Fixed Demo Users for ease of testing
    const defaultPasswordHash = await bcrypt.hash('password123', 10);

    const fixedUsers = [
      { email: 'seller@example.com', role: 'seller' },
      { email: 'buyer@example.com', role: 'buyer' },
      { email: 'seller2@example.com', role: 'seller' },
      { email: 'buyer2@example.com', role: 'buyer' },
    ];

    const sellers = [];
    const buyers = [];

    for (const u of fixedUsers) {
      const res = await client.query(
        `INSERT INTO users (email, password_hash, role)
         VALUES ($1, $2, $3)
         ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash
         RETURNING id, email, role`,
        [u.email, defaultPasswordHash, u.role],
      );
      if (u.role === 'seller') sellers.push(res.rows[0]);
      else buyers.push(res.rows[0]);
    }

    // 2. Seed Additional Realistic Sellers (3 more)
    for (let i = 0; i < 3; i++) {
      const email = faker.internet.email({ provider: 'store.com' }).toLowerCase();
      const res = await client.query(
        `INSERT INTO users (email, password_hash, role)
         VALUES ($1, $2, $3)
         ON CONFLICT (email) DO NOTHING
         RETURNING id, email, role`,
        [email, defaultPasswordHash, 'seller'],
      );
      if (res.rows[0]) sellers.push(res.rows[0]);
    }

    // 3. Seed Additional Realistic Buyers (8 more)
    for (let i = 0; i < 8; i++) {
      const email = faker.internet.email().toLowerCase();
      const res = await client.query(
        `INSERT INTO users (email, password_hash, role)
         VALUES ($1, $2, $3)
         ON CONFLICT (email) DO NOTHING
         RETURNING id, email, role`,
        [email, defaultPasswordHash, 'buyer'],
      );
      if (res.rows[0]) buyers.push(res.rows[0]);
    }

    console.log(`✅ Seeded ${sellers.length} sellers and ${buyers.length} buyers`);

    // 4. Seed 30 Realistic Products
    const products = [];
    for (let i = 0; i < 30; i++) {
      const randomSeller = faker.helpers.arrayElement(sellers);
      const category = faker.helpers.arrayElement(CATEGORIES);
      const title = `${faker.word.words({ count: { min: 2, max: 4 } }).replace(/\b\w/g, l => l.toUpperCase())}: The ${faker.word.noun()}`;
      const author = faker.person.fullName();
      const description = `${faker.lorem.paragraph()} Key themes explore ${faker.commerce.productAdjective()} concepts in ${category.toLowerCase()}.`;
      const price = parseFloat(faker.commerce.price({ min: 12.99, max: 89.99, dec: 2 }));
      const stock = faker.number.int({ min: 15, max: 120 });

      const res = await client.query(
        `INSERT INTO products (title, author, description, price, category, stock, seller_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, title, author, price, category, stock, seller_id`,
        [title, author, description, price, category, stock, randomSeller.id],
      );
      products.push(res.rows[0]);
    }
    console.log(`✅ Seeded ${products.length} products with stock and full-text search descriptions`);

    // 5. Seed 15 Realistic Orders and OrderItems
    const createdOrders = [];
    const purchasedPairs = new Set(); // To track (buyerId, productId) for review seeding

    for (let i = 0; i < 15; i++) {
      const buyer = faker.helpers.arrayElement(buyers);
      const chosenProducts = faker.helpers.arrayElements(products, { min: 1, max: 3 });

      let orderTotal = 0;
      const orderItems = [];

      for (const prod of chosenProducts) {
        const quantity = faker.number.int({ min: 1, max: 3 });
        const price = Number(prod.price);
        orderTotal += price * quantity;

        orderItems.push({
          bookId: prod.id,
          quantity,
          price,
        });

        purchasedPairs.add(`${buyer.id}::${prod.id}`);
      }

      const status = faker.helpers.arrayElement(['delivered', 'shipped', 'paid', 'pending']);

      const orderRes = await client.query(
        `INSERT INTO orders (user_id, total_price, status)
         VALUES ($1, $2, $3)
         RETURNING id, user_id, total_price, status`,
        [buyer.id, orderTotal.toFixed(2), status],
      );
      const order = orderRes.rows[0];

      for (const item of orderItems) {
        await client.query(
          `INSERT INTO order_items (order_id, book_id, quantity, price)
           VALUES ($1, $2, $3, $4)`,
          [order.id, item.bookId, item.quantity, item.price],
        );

        // Decrement product stock to simulate realistic checkout
        await client.query(
          `UPDATE products SET stock = GREATEST(0, stock - $1), updated_at = NOW() WHERE id = $2`,
          [item.quantity, item.bookId],
        );
      }

      createdOrders.push(order);
    }
    console.log(`✅ Seeded ${createdOrders.length} orders with multiple order items and decremented stock`);

    // 6. Seed Realistic Reviews for Confirmed Purchases
    let reviewCount = 0;
    for (const pair of purchasedPairs) {
      const [userId, productId] = pair.split('::');

      // 70% chance to leave a review for purchased book
      if (Math.random() < 0.7) {
        const rating = faker.number.int({ min: 3, max: 5 });
        const comment = faker.helpers.arrayElement([
          'Fantastic read, could not put it down!',
          'Extremely informative and well-structured.',
          'Great book with practical insights. Highly recommended!',
          'A bit dense in the middle, but the conclusion was totally worth it.',
          'Arrived in perfect condition and exceeded expectations.',
        ]);

        await client.query(
          `INSERT INTO reviews (user_id, product_id, rating, comment)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (user_id, product_id) DO NOTHING`,
          [userId, productId, rating, comment],
        );
        reviewCount++;
      }
    }
    console.log(`✅ Seeded ${reviewCount} authentic buyer reviews (cross-verified against orders)`);

    await client.query('COMMIT');
    console.log('\n🎉 Database seeding completed successfully!');
    console.log('----------------------------------------------------');
    console.log('📌 Test Credentials:');
    console.log('   Seller: seller@example.com / password123');
    console.log('   Buyer:  buyer@example.com  / password123');
    console.log('----------------------------------------------------');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Seeding failed, transaction rolled back:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
