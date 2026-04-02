module.exports = {
  id: "005_follow_graph",
  async up(connection) {
    await connection.query(`
      CREATE TABLE IF NOT EXISTS user_follows (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        follower_user_id BIGINT UNSIGNED NOT NULL,
        followed_user_id BIGINT UNSIGNED NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uq_user_follows_pair (follower_user_id, followed_user_id),
        KEY idx_user_follows_follower (follower_user_id, created_at),
        KEY idx_user_follows_followed (followed_user_id, created_at),
        CONSTRAINT fk_user_follows_follower FOREIGN KEY (follower_user_id) REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT fk_user_follows_followed FOREIGN KEY (followed_user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
  },
  async down(connection) {
    await connection.query("DROP TABLE IF EXISTS user_follows");
  }
};
