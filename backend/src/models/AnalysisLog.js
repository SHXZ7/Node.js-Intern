import { pool } from '../config/db.js';

class AnalysisLog {
  /**
   * Replicates AnalysisLog.create Mongoose API using parameterized MySQL query
   */
  static async create(logData) {
    try {
      const sql = `
        INSERT INTO analysis_logs (username, response_ms, cache_hit, status, error_code, ip_address) 
        VALUES (?, ?, ?, ?, ?, ?)
      `;
      const values = [
        logData.username ? logData.username.toLowerCase() : 'unknown',
        logData.response_ms || 0,
        logData.cache_hit === true ? 1 : 0,
        logData.status || 'success',
        logData.error_code || null,
        logData.ip_address || null,
      ];
      
      const [result] = await pool.query(sql, values);
      return { id: result.insertId, ...logData };
    } catch (err) {
      console.error('[AnalysisLog.create ERROR]', err.message);
      // Fail gracefully so logging errors do not crash primary profile transactions
      return logData;
    }
  }

  /**
   * Replicates standard Mongoose countDocuments if ever used in statistics
   */
  static async countDocuments(filter = {}) {
    try {
      const sql = 'SELECT COUNT(*) as count FROM analysis_logs';
      const [rows] = await pool.query(sql);
      return rows[0]?.count || 0;
    } catch (err) {
      console.error('[AnalysisLog.countDocuments ERROR]', err.message);
      return 0;
    }
  }

  /**
   * Replicates find() helper to query logs if needed in diagnostics
   */
  static async find() {
    try {
      const sql = 'SELECT * FROM analysis_logs ORDER BY requested_at DESC LIMIT 100';
      const [rows] = await pool.query(sql);
      return rows;
    } catch (err) {
      console.error('[AnalysisLog.find ERROR]', err.message);
      return [];
    }
  }
}

export default AnalysisLog;
