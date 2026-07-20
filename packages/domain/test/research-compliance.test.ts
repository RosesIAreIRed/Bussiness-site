import { describe, expect, it } from 'vitest';
import { checkCompliance } from '../src/research/compliance.js';

describe('compliance guard (ТЗ §15)', () => {
  it('чистий текст → PASS', () => {
    const report = checkCompliance({
      texts: ['Портативний блендер для смузі. Зручно брати з собою.'],
    });
    expect(report.status).toBe('PASS');
    expect(report.findings).toHaveLength(0);
  });

  it('медичний claim → BLOCKED', () => {
    const report = checkCompliance({ texts: ['Цей засіб лікує біль у спині назавжди'] });
    expect(report.status).toBe('BLOCKED');
    expect(report.findings[0]).toMatchObject({ ruleId: 'medical-claim', severity: 'BLOCKER' });
  });

  it('гарантований результат → BLOCKED', () => {
    const report = checkCompliance({ texts: ['Гарантований результат за 7 днів!'] });
    expect(report.status).toBe('BLOCKED');
    expect(report.findings.some((finding) => finding.ruleId === 'guaranteed-result')).toBe(true);
  });

  it('штучний дефіцит і статистика → PASS_WITH_WARNINGS', () => {
    const report = checkCompliance({
      texts: ['Залишилось лише 3 штуки! 87% покупців задоволені.'],
    });
    expect(report.status).toBe('PASS_WITH_WARNINGS');
    const rules = report.findings.map((finding) => finding.ruleId);
    expect(rules).toContain('fake-scarcity');
    expect(rules).toContain('unsupported-statistics');
  });

  it('HIGH-claim з brief → BLOCKED, MEDIUM → WARNING', () => {
    const high = checkCompliance({
      texts: [],
      claims: [{ claim: 'знімає хронічний біль', reason: 'без доказів', severity: 'HIGH' }],
    });
    expect(high.status).toBe('BLOCKED');

    const medium = checkCompliance({
      texts: [],
      claims: [{ claim: 'найшвидший на ринку', reason: 'порівняння без даних', severity: 'MEDIUM' }],
    });
    expect(medium.status).toBe('PASS_WITH_WARNINGS');
  });

  it('заборонені терміни бренду → BLOCKED', () => {
    const report = checkCompliance({
      texts: ['Оригінальний Dyson-стайл дизайн'],
      prohibitedTerms: ['Dyson'],
    });
    expect(report.status).toBe('BLOCKED');
    expect(report.findings[0]).toMatchObject({ ruleId: 'prohibited-term' });
  });

  it('дублікати знахідок не плодяться', () => {
    const report = checkCompliance({
      texts: ['лікує все', 'лікує все', 'він лікує все швидко'],
    });
    expect(report.findings).toHaveLength(1);
  });
});
