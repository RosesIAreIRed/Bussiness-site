import { describe, expect, it } from 'vitest';
import { JOBS, QUEUES, heartbeatJobPayloadSchema } from '../src/queues.js';

describe('queue contracts', () => {
  it('експортує стабільні назви черг і job-типів', () => {
    expect(QUEUES.system).toBe('system');
    expect(QUEUES.render).toBe('render');
    expect(JOBS.systemHeartbeat).toBe('system.heartbeat');
  });

  it('heartbeat payload вимагає непорожній source', () => {
    expect(heartbeatJobPayloadSchema.parse({ source: 'worker' }).source).toBe('worker');
    expect(() => heartbeatJobPayloadSchema.parse({ source: '' })).toThrow();
    expect(() => heartbeatJobPayloadSchema.parse({})).toThrow();
    expect(() => heartbeatJobPayloadSchema.parse(null)).toThrow();
  });
});
