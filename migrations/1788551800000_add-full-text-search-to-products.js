/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
exports.shorthands = undefined;

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
exports.up = (pgm) => {
  pgm.addColumns('products', {
    description: {
      type: 'text',
      notNull: false,
    },
  });

  // Add tsvector generated column with weighted search fields
  pgm.sql(`
    ALTER TABLE "products"
    ADD COLUMN "search_vector" tsvector GENERATED ALWAYS AS (
      setweight(to_tsvector('english', coalesce("title", '')), 'A') ||
      setweight(to_tsvector('english', coalesce("description", '')), 'B') ||
      setweight(to_tsvector('english', coalesce("category", '')), 'C') ||
      setweight(to_tsvector('english', coalesce("author", '')), 'D')
    ) STORED;
  `);

  // Create GIN index on the generated search_vector column
  pgm.createIndex('products', 'search_vector', {
    name: 'products_search_vector_idx',
    method: 'gin',
  });
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
exports.down = (pgm) => {
  pgm.sql(`ALTER TABLE "products" DROP COLUMN IF EXISTS "search_vector";`);
  pgm.dropColumns('products', ['description']);
};
