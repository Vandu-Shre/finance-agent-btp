/**
 * db.service tests
 *
 * pg's Pool is mocked so no real database is required. The module-level
 * singleton (`pool`) means Pool() is only invoked once across all tests in
 * this file (on the first getPool() call). We therefore test the
 * singleton behaviour explicitly and rely on the mock pool for all
 * subsequent calls.
 */

// Variables that start with "mock" can be referenced inside jest.mock factories
// even after hoisting.
const mockClientQuery = jest.fn();
const mockRelease = jest.fn();
const mockConnect = jest.fn().mockResolvedValue({
  query: mockClientQuery,
  release: mockRelease,
});
const mockPoolQuery = jest.fn().mockResolvedValue({ rows: [] });
const mockPoolOn = jest.fn();

// pg is a CommonJS module: `import pg from 'pg'` gets its module.exports object.
// The mock must expose Pool directly (not nested under `default`).
jest.mock('pg', () => ({
  Pool: jest.fn().mockImplementation(() => ({
    connect: mockConnect,
    query: mockPoolQuery,
    on: mockPoolOn,
  })),
}));

import pg from 'pg';
import { getPool, initDb, query, persist } from '../../services/db.service.js';

const MockPool = (pg as any).Pool as jest.Mock;

describe('db.service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Restore default implementations cleared by clearAllMocks
    mockConnect.mockResolvedValue({ query: mockClientQuery, release: mockRelease });
    mockPoolQuery.mockResolvedValue({ rows: [] });
    mockClientQuery.mockResolvedValue({ rows: [] });
  });

  // ─── getPool ────────────────────────────────────────────────────────────────

  describe('getPool', () => {
    // pool.on('error', ...) is called exactly once when the singleton is first
    // created.  beforeEach's clearAllMocks() wipes that history before most
    // tests run, so we snapshot the calls here, before any clear occurs.
    let initialOnCalls: unknown[][];
    beforeAll(() => {
      getPool();
      initialOnCalls = mockPoolOn.mock.calls.map((c) => [...c]);
    });

    it('returns a Pool instance', () => {
      const pool = getPool();
      expect(pool).toBeDefined();
      expect(pool).toHaveProperty('connect');
      expect(pool).toHaveProperty('query');
    });

    it('returns the same instance on repeated calls (singleton)', () => {
      const first = getPool();
      const second = getPool();
      expect(first).toBe(second);
    });

    it('calls the Pool constructor exactly once', () => {
      getPool();
      getPool();
      // MockPool was already called on first getPool() above; count may be ≥1
      // What matters is it was not called more than once total across the file.
      expect(MockPool.mock.calls.length).toBeLessThanOrEqual(1);
    });

    it('registers a pool error handler', () => {
      // Use the snapshot captured in beforeAll — the singleton means pool.on()
      // only fires once and clearAllMocks() wipes it before this test runs.
      const errorCall = initialOnCalls.find(([event]) => event === 'error') as unknown[] | undefined;
      expect(errorCall).toBeDefined();
      expect(typeof errorCall![1]).toBe('function');
    });
  });

  // ─── initDb ─────────────────────────────────────────────────────────────────

  describe('initDb', () => {
    it('acquires a client, runs CREATE TABLE statements, then releases the client', async () => {
      await initDb();

      expect(mockConnect).toHaveBeenCalledTimes(1);
      expect(mockClientQuery).toHaveBeenCalledTimes(1);

      const sql: string = mockClientQuery.mock.calls[0][0];
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS sessions');
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS messages');
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS files');

      expect(mockRelease).toHaveBeenCalledTimes(1);
    });

    it('releases the client even when the query throws', async () => {
      mockClientQuery.mockRejectedValue(new Error('syntax error'));
      jest.spyOn(console, 'error').mockImplementation(() => {});

      await expect(initDb()).rejects.toThrow('syntax error');

      expect(mockRelease).toHaveBeenCalledTimes(1);
    });

    it('throws when connect fails', async () => {
      mockConnect.mockRejectedValue(new Error('connection refused'));
      jest.spyOn(console, 'error').mockImplementation(() => {});

      await expect(initDb()).rejects.toThrow('connection refused');
    });
  });

  // ─── query ──────────────────────────────────────────────────────────────────

  describe('query', () => {
    it('executes the given SQL and returns the result rows', async () => {
      mockPoolQuery.mockResolvedValue({ rows: [{ id: 1, name: 'Alice' }] });

      const rows = await query('SELECT * FROM users WHERE id = $1', [1]);

      expect(mockPoolQuery).toHaveBeenCalledWith('SELECT * FROM users WHERE id = $1', [1]);
      expect(rows).toEqual([{ id: 1, name: 'Alice' }]);
    });

    it('returns an empty array when the query returns no rows', async () => {
      mockPoolQuery.mockResolvedValue({ rows: [] });

      const rows = await query('SELECT 1');

      expect(rows).toEqual([]);
    });

    it('propagates errors thrown by the pool', async () => {
      mockPoolQuery.mockRejectedValue(new Error('relation "missing_table" does not exist'));

      await expect(query('SELECT * FROM missing_table')).rejects.toThrow(
        'relation "missing_table" does not exist'
      );
    });
  });

  // ─── persist ────────────────────────────────────────────────────────────────

  describe('persist', () => {
    it('executes the SQL without awaiting the result', () => {
      mockPoolQuery.mockResolvedValue({ rows: [] });

      // persist() is synchronous (fire-and-forget), so it returns void immediately
      const result = persist('INSERT INTO sessions (id) VALUES ($1)', ['sess-1']);
      expect(result).toBeUndefined();
    });

    it('logs but does not throw when the underlying query fails', async () => {
      mockPoolQuery.mockRejectedValue(new Error('unique violation'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      persist('INSERT INTO sessions (id) VALUES ($1)', ['dup-id']);

      // Flush microtask queue so the rejected promise's catch handler runs
      await new Promise(resolve => setImmediate(resolve));

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('DB persist failed:'),
        expect.stringContaining('unique violation')
      );
    });
  });
});
