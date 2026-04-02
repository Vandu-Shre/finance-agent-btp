/**
 * db.service tests
 *
 * PrismaClient is mocked so no real database is required.
 */

const mockConnect = jest.fn().mockResolvedValue(undefined);
const mockDisconnect = jest.fn().mockResolvedValue(undefined);

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    $connect: mockConnect,
    $disconnect: mockDisconnect,
  })),
}));

describe('db.service', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    mockConnect.mockResolvedValue(undefined);
    process.env = { ...ORIGINAL_ENV };
    jest.resetModules();
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  // ─── initDb ─────────────────────────────────────────────────────────────────

  describe('initDb', () => {
    it('calls $connect and logs success', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      const { initDb } = await import('../../services/db.service.js');

      await initDb();

      expect(mockConnect).toHaveBeenCalledTimes(1);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Database ready'));
    });

    it('throws and logs error when $connect fails', async () => {
      mockConnect.mockRejectedValue(new Error('connection refused'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const { initDb } = await import('../../services/db.service.js');

      await expect(initDb()).rejects.toThrow('connection refused');

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to connect'),
        expect.any(Error)
      );
    });
  });

  // ─── DATABASE_URL resolution ─────────────────────────────────────────────────

  describe('DATABASE_URL resolution', () => {
    it('uses DATABASE_URL env var when set', async () => {
      process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/mydb';
      delete process.env.VCAP_SERVICES;

      await import('../../services/db.service.js');

      expect(process.env.DATABASE_URL).toBe('postgresql://user:pass@localhost:5432/mydb');
    });

    it('defaults to SQLite file when DATABASE_URL is not set', async () => {
      delete process.env.DATABASE_URL;
      delete process.env.VCAP_SERVICES;

      await import('../../services/db.service.js');

      expect(process.env.DATABASE_URL).toBe('file:./dev.db');
    });

    it('builds PostgreSQL URL from VCAP_SERVICES credentials', async () => {
      delete process.env.DATABASE_URL;
      process.env.VCAP_SERVICES = JSON.stringify({
        'postgresql-db': [{
          credentials: {
            hostname: 'db.btp.example.com',
            port: '5432',
            dbname: 'financedb',
            username: 'admin',
            password: 'secret',
          },
        }],
      });

      process.env.NODE_ENV = 'production';
      await import('../../services/db.service.js');

      expect(process.env.DATABASE_URL).toContain('postgresql://');
      expect(process.env.DATABASE_URL).toContain('db.btp.example.com');
      expect(process.env.DATABASE_URL).toContain('financedb');
    });
  });

  // ─── prisma export ───────────────────────────────────────────────────────────

  describe('prisma export', () => {
    it('exports a PrismaClient instance', async () => {
      const { prisma } = await import('../../services/db.service.js');
      expect(prisma).toBeDefined();
      expect(typeof prisma.$connect).toBe('function');
    });
  });
});
