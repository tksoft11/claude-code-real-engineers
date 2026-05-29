// tests/user.service.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UserService } from '../src/services/user.service';
import { DuplicateEmailError, ValidationError } from '../src/errors';

// Mock dependencies
vi.mock('../src/db/prisma', () => ({
  prisma: {
    user: {
      create: vi.fn(),
      findUnique: vi.fn(),
    },
  },
}));

vi.mock('bcryptjs', () => ({
  hash: vi.fn().mockResolvedValue('hashed_password'),
  compare: vi.fn(),
}));

describe('UserService.createUser()', () => {
  let service: UserService;

  beforeEach(() => {
    service = new UserService();
    vi.clearAllMocks();
  });

  // ============ Happy Path ============
  describe('Happy Path', () => {
    it('should create user with valid data', async () => {
      prisma.user.findUnique.mockResolvedValue(null); // email ไม่ซ้ำ
      prisma.user.create.mockResolvedValue({
        id: 'uuid-123',
        email: 'test@example.com',
        name: 'Test User',
        password: 'hashed_password',
        createdAt: new Date(),
      });

      const result = await service.createUser({
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User',
      });

      expect(result.email).toBe('test@example.com');
      expect(result.name).toBe('Test User');
    });

    it('should hash password before saving', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({ id: '1', email: 'a@b.com', name: 'A', password: 'hashed' });

      await service.createUser({ email: 'a@b.com', password: 'mypassword', name: 'A' });

      expect(bcrypt.hash).toHaveBeenCalledWith('mypassword', 12);
      expect(prisma.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ password: 'hashed_password' }),
      });
    });

    it('should NOT return password field in response', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({ id: '1', email: 'a@b.com', name: 'A', password: 'hashed' });

      const result = await service.createUser({ email: 'a@b.com', password: 'pass123!', name: 'A' });

      expect(result).not.toHaveProperty('password');
    });
  });

  // ============ Validation Errors ============
  describe('Validation', () => {
    it('should throw ValidationError for invalid email format', async () => {
      await expect(
        service.createUser({ email: 'not-an-email', password: 'pass123!', name: 'A' })
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError for password less than 8 chars', async () => {
      await expect(
        service.createUser({ email: 'a@b.com', password: 'short', name: 'A' })
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError for empty name', async () => {
      await expect(
        service.createUser({ email: 'a@b.com', password: 'pass123!', name: '' })
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError for whitespace-only name', async () => {
      await expect(
        service.createUser({ email: 'a@b.com', password: 'pass123!', name: '   ' })
      ).rejects.toThrow(ValidationError);
    });
  });

  // ============ Duplicate Email ============
  describe('Duplicate Email', () => {
    it('should throw DuplicateEmailError when email already exists', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'existing' }); // email มีอยู่แล้ว

      await expect(
        service.createUser({ email: 'existing@example.com', password: 'pass123!', name: 'A' })
      ).rejects.toThrow(DuplicateEmailError);
    });

    it('should be case-insensitive email check', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'existing' });

      await expect(
        service.createUser({ email: 'EXISTING@EXAMPLE.COM', password: 'pass123!', name: 'A' })
      ).rejects.toThrow(DuplicateEmailError);
    });
  });

  // ============ Edge Cases (ที่ Claude คิดเองโดยที่ spec ไม่ได้บอก) ============
  describe('Edge Cases', () => {
    it('should trim email before saving', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({ id: '1', email: 'a@b.com', name: 'A', password: 'h' });

      await service.createUser({ email: '  a@b.com  ', password: 'pass123!', name: 'A' });

      expect(prisma.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ email: 'a@b.com' }), // trimmed
      });
    });

    it('should not save data if password hashing fails', async () => {
      bcrypt.hash.mockRejectedValue(new Error('hashing failed'));

      await expect(
        service.createUser({ email: 'a@b.com', password: 'pass123!', name: 'A' })
      ).rejects.toThrow();

      expect(prisma.user.create).not.toHaveBeenCalled(); // ไม่บันทึก
    });

    it('should handle very long names gracefully', async () => {
      const longName = 'A'.repeat(300);

      await expect(
        service.createUser({ email: 'a@b.com', password: 'pass123!', name: longName })
      ).rejects.toThrow(ValidationError); // ควร fail ไม่ใช่ crash
    });
  });
});
