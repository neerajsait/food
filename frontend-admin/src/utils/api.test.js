import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { api } from './api.js';

describe('API & Mock Backend', () => {
  beforeEach(() => {
    localStorage.clear();
    // Force fetch to fail so checkBackendAlive returns false
    global.fetch = vi.fn(() => Promise.reject(new Error('Network error')));
    
    // Seed mock database explicitly for testing
    localStorage.setItem('mock_users', JSON.stringify([
      { id: 1, email: 'admin@brand.com', role: 'admin', password: 'admin' },
      { id: 2, staff_code: '1001', role: 'staff', password: 'staff123' },
      { id: 3, staff_code: '2001', role: 'kitchen', password: 'kitchen123' }
    ]));
    localStorage.setItem('app_mode', 'Mock Frontend');
  });

  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('should initialize mock db and allow login with staff code', async () => {
    const result = await api.login('1001', 'staff123');
    expect(result.user).toBeDefined();
    expect(result.user.role).toBe('staff');
    expect(result.access_token).toBeDefined();
  });

  it('should initialize and allow login for kitchen user', async () => {
    const result = await api.login('2001', 'kitchen123');
    expect(result.user).toBeDefined();
    expect(result.user.role).toBe('kitchen');
  });
});
