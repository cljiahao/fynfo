import { GET } from '@/app/api/health/route';
import { describe, expect, it } from 'vitest';

describe('GET /api/health (health check)', () => {
  it('should return status ok with 200', async () => {
    const response = await GET(new Request('http://localhost/api/health'));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.status).toBe('ok');
    expect(data.timestamp).toBeDefined();
  });
});
