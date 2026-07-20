import { MockTextGenerationProvider, type MockResponder } from './mock-text-provider.js';
import type { TextGenerationProvider } from './providers.js';

/** Простий детермінований хеш для стабільних, але різних між товарами оцінок. */
function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function extractTitle(userPrompt: string): string {
  const match = userPrompt.match(/Назва товару: (.+)/);
  const title = match?.[1]?.trim();
  return title && title !== '—' ? title : 'Товар';
}

/** Оцінка 0.60..0.89, стабільна для (title, index). */
function rating(seed: number, index: number): number {
  return Math.round((0.6 + ((seed + index * 37) % 30) / 100) * 100) / 100;
}

/** Ризик 0.00..0.15, стабільний для (title, index). */
function penalty(seed: number, index: number): number {
  return Math.round((((seed + index * 53) % 16) / 100) * 100) / 100;
}

function buildBrief(title: string): unknown {
  return {
    summary: `${title}: практичний товар для щоденного використання з потенціалом візуальної демонстрації.`,
    targetPersonas: [
      {
        name: 'Зайнята міська аудиторія 25–40',
        pains: ['брак часу', 'незручні побутові рішення'],
        desires: ['економія часу', 'простота у використанні'],
        objections: ['чи вартий своєї ціни?', 'чи довго прослужить?'],
      },
      {
        name: 'Подарунковий сегмент',
        pains: ['складно обрати практичний подарунок'],
        desires: ['подарунок, яким реально користуються'],
        objections: ['чи виглядає достатньо преміально?'],
      },
    ],
    benefits: [
      { benefit: 'Помітна економія часу в побуті', evidence: null, confidence: 0.7 },
      { benefit: 'Компактний і простий у використанні', evidence: null, confidence: 0.75 },
      { benefit: 'Ефект помітний одразу під час демонстрації', evidence: null, confidence: 0.65 },
    ],
    angles: [
      {
        name: 'Problem → Solution',
        rationale: 'Звичний спосіб повільний і незручний — товар розвʼязує це за секунди.',
        hooks: [
          `Досі робите це вручну? ${title} впорається за 30 секунд`,
          'Проблема, про яку ви забудете вже сьогодні',
          'Ось чому старий спосіб більше не потрібен',
          'Секунда — і готово',
        ],
      },
      {
        name: 'Product Demonstration',
        rationale: 'Сильний visual demo potential — показ у дії продає сам.',
        hooks: [
          `Дивіться, як ${title} працює наживо`,
          'Ніяких обіцянок — просто дивіться',
          'Зняли одним дублем, без монтажу',
          'Демонстрація, після якої все зрозуміло',
        ],
      },
      {
        name: 'Gift angle',
        rationale: 'Практичний подарунок із вау-ефектом під сезонні кампанії.',
        hooks: [
          'Подарунок, яким користуватимуться щодня',
          `${title} — коли не знаєте, що подарувати`,
          'Краще за ще одну свічку',
          'Подарунок, про який говоритимуть',
        ],
      },
    ],
    riskyClaims: [],
  };
}

function buildAssessment(title: string): unknown {
  const seed = hashString(title);
  return {
    whyItCanSell: [
      'зрозуміла демонстрація цінності у відео',
      'широка аудиторія без вузької ніші',
      'простий офер із бандлом',
    ],
    whyItCanFail: [
      'конкуренти з нижчою ціною',
      'можлива втома аудиторії від схожих товарів',
    ],
    recommendedOffer: '2 за ціною 1 + безкоштовна доставка',
    missingMaterials: [
      'реальні відео товару від постачальника',
      'відгуки з дозволом на використання',
    ],
    ratings: {
      visualDemoPotential: rating(seed, 1),
      landingPageQuality: rating(seed, 2),
      offerStrength: rating(seed, 3),
      fulfillmentQuality: rating(seed, 4),
      trustAndReviews: rating(seed, 5),
      differentiation: rating(seed, 6),
    },
    penalties: {
      policyRisk: penalty(seed, 1),
      copyrightRisk: penalty(seed, 2),
      fragileOrExpensiveShipping: penalty(seed, 3),
      unrealisticClaims: penalty(seed, 4),
      weakSupplierReliability: penalty(seed, 5),
      saturatedCommodity: penalty(seed, 6),
    },
  };
}

export function createResearchMockResponders(): MockResponder[] {
  return [
    {
      matches: ({ systemPrompt }) => systemPrompt.includes('[prompt:product-brief@'),
      build: ({ userPrompt }) => buildBrief(extractTitle(userPrompt)),
    },
    {
      matches: ({ systemPrompt }) => systemPrompt.includes('[prompt:candidate-assessment@'),
      build: ({ userPrompt }) => buildAssessment(extractTitle(userPrompt)),
    },
  ];
}

/**
 * Фабрика TextGenerationProvider за конфігурацією (ТЗ §3.2: провайдер обирається
 * в конфігурації). Реальні провайдери підключаються окремими adapter-ами.
 */
export function createTextGenerationProvider(config: {
  provider?: string;
}): TextGenerationProvider {
  const name = config.provider ?? 'mock';
  if (name === 'mock') {
    return new MockTextGenerationProvider(createResearchMockResponders());
  }
  throw new Error(
    `TEXT_AI_PROVIDER "${name}" не підтримується: реалізовано лише "mock" (реальні adapters — окремим milestone)`,
  );
}
