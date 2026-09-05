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
    seller_id: {
      type: 'uuid',
      references: 'users',
      onDelete: 'CASCADE',
    },
    category: {
      type: 'varchar(100)',
    },
  });

  pgm.createIndex('products', 'seller_id');
  pgm.createIndex('products', 'category');
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
exports.down = (pgm) => {
  pgm.dropIndex('products', 'category');
  pgm.dropIndex('products', 'seller_id');
  pgm.dropColumns('products', ['seller_id', 'category']);
};
