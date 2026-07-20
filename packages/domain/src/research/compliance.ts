import type {
  ComplianceFinding,
  ComplianceReport,
  ComplianceSeverity,
} from './types.js';

interface ComplianceRule {
  id: string;
  severity: ComplianceSeverity;
  message: string;
  pattern: RegExp;
}

/**
 * Базові правила Compliance Guard (ТЗ §15, M2-підмножина текстових перевірок).
 * BLOCKED неможливо approve без admin override (реалізується в UI approvals M3+).
 */
export const COMPLIANCE_RULES: readonly ComplianceRule[] = [
  {
    id: 'medical-claim',
    severity: 'BLOCKER',
    message: 'Медичні claims заборонені без доказів (ТЗ §2.1, §15)',
    pattern:
      /(лікує|зцілює|виліковує|позбавляє (болю|хвороб)|схуднете на \d+|скинете \d+ ?кг|cures?\b|heals?\b|treats \w+ disease)/iu,
  },
  {
    id: 'guaranteed-result',
    severity: 'BLOCKER',
    message: 'Гарантії результату заборонені (guaranteed results)',
    pattern:
      /(гарантован(ий|о|уємо) (результат|прибуток|схуднення)|100\s?%\s?(результат|гаранті)|guaranteed results?)/iu,
  },
  {
    id: 'fake-scarcity',
    severity: 'WARNING',
    message: 'Штучний дефіцит — ризик policy violation',
    pattern: /(залишилось (лише|тільки) \d+|тільки сьогодні|last chance|only \d+ left)/iu,
  },
  {
    id: 'unsupported-statistics',
    severity: 'WARNING',
    message: 'Статистика потребує підтвердження джерелом',
    pattern: /\b\d{2,3}\s?%/u,
  },
  {
    id: 'before-after',
    severity: 'WARNING',
    message: 'Before/After без доказів може вводити в оману',
    pattern: /(до\s*\/\s*після|before\s*\/?\s*after)/iu,
  },
];

export interface ComplianceInput {
  texts: string[];
  /** Ризикові твердження з Product Brief (ТЗ §14 riskyClaims). */
  claims?: Array<{ claim: string; reason: string; severity: 'LOW' | 'MEDIUM' | 'HIGH' }>;
  /** Заборонені слова бренду (ТЗ §2.1 «Заборонені слова та твердження»). */
  prohibitedTerms?: string[];
}

/** Перевірка текстів і claims; повертає PASS / PASS_WITH_WARNINGS / BLOCKED (ТЗ §15). */
export function checkCompliance(input: ComplianceInput): ComplianceReport {
  const findings: ComplianceFinding[] = [];
  const seen = new Set<string>();

  const push = (finding: ComplianceFinding): void => {
    const dedupeKey = `${finding.ruleId}:${finding.match.toLowerCase()}`;
    if (!seen.has(dedupeKey)) {
      seen.add(dedupeKey);
      findings.push(finding);
    }
  };

  for (const text of input.texts) {
    for (const rule of COMPLIANCE_RULES) {
      const match = text.match(rule.pattern);
      if (match) {
        push({ ruleId: rule.id, severity: rule.severity, message: rule.message, match: match[0] });
      }
    }

    for (const term of input.prohibitedTerms ?? []) {
      if (term.trim() !== '' && text.toLowerCase().includes(term.toLowerCase())) {
        push({
          ruleId: 'prohibited-term',
          severity: 'BLOCKER',
          message: `Заборонений термін бренду: "${term}"`,
          match: term,
        });
      }
    }
  }

  for (const claim of input.claims ?? []) {
    push({
      ruleId: 'risky-claim',
      severity: claim.severity === 'HIGH' ? 'BLOCKER' : 'WARNING',
      message: `Ризикове твердження: ${claim.reason}`,
      match: claim.claim,
    });
  }

  const hasBlocker = findings.some((finding) => finding.severity === 'BLOCKER');
  const hasWarning = findings.some((finding) => finding.severity === 'WARNING');

  return {
    status: hasBlocker ? 'BLOCKED' : hasWarning ? 'PASS_WITH_WARNINGS' : 'PASS',
    findings,
  };
}
