module.exports = {
  id: "004_review_governance_seed",
  async run(connection) {
    await connection.query(
      `
        INSERT INTO review_dimension_configs (key_name, label, weight, is_active)
        VALUES
          ('quality', 'Quality', 1.0, 1),
          ('coach_support', 'Coach/Support', 1.0, 1),
          ('value', 'Value', 1.0, 1)
        ON DUPLICATE KEY UPDATE
          label = VALUES(label),
          weight = VALUES(weight),
          is_active = VALUES(is_active)
      `
    );

    await connection.query(
      `
        INSERT INTO sensitive_words (word, is_active)
        VALUES ('scam', 1), ('abuse', 1)
        ON DUPLICATE KEY UPDATE is_active = VALUES(is_active)
      `
    );
  }
};
