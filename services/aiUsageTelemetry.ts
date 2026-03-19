export type AiUsageAction = 'conversation' | 'pronunciation' | 'speech' | 'generatePhrases' | 'generateWords';

export interface AiUsageBucket {
  action: AiUsageAction;
  calls: number;
  successfulCalls: number;
  failedCalls: number;
  uploadedAudioBytes: number;
  returnedAudioBytes: number;
  requestTextChars: number;
  responseTextChars: number;
  itemsReturned: number;
  warnings: number;
  errors: number;
  lastAt: number | null;
}

export interface AiUsageTelemetry {
  updatedAt: number | null;
  buckets: Record<AiUsageAction, AiUsageBucket>;
}

export interface AiUsageDelta {
  calls?: number;
  successfulCalls?: number;
  failedCalls?: number;
  uploadedAudioBytes?: number;
  returnedAudioBytes?: number;
  requestTextChars?: number;
  responseTextChars?: number;
  itemsReturned?: number;
  warnings?: number;
  errors?: number;
}

const AI_USAGE_KEY = 'fluentflow_ai_usage_v1';

const ACTIONS: AiUsageAction[] = ['conversation', 'pronunciation', 'speech', 'generatePhrases', 'generateWords'];

const createBucket = (action: AiUsageAction): AiUsageBucket => ({
  action,
  calls: 0,
  successfulCalls: 0,
  failedCalls: 0,
  uploadedAudioBytes: 0,
  returnedAudioBytes: 0,
  requestTextChars: 0,
  responseTextChars: 0,
  itemsReturned: 0,
  warnings: 0,
  errors: 0,
  lastAt: null,
});

const createEmptyTelemetry = (): AiUsageTelemetry => ({
  updatedAt: null,
  buckets: ACTIONS.reduce((acc, action) => {
    acc[action] = createBucket(action);
    return acc;
  }, {} as Record<AiUsageAction, AiUsageBucket>),
});

const isBrowser = (): boolean => typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

const clampIncrement = (value: unknown): number => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(0, numeric) : 0;
};

export const estimateBase64Bytes = (value: string): number => {
  const clean = String(value || '').trim();
  if (!clean) return 0;
  const padding = clean.endsWith('==') ? 2 : clean.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.floor((clean.length * 3) / 4) - padding);
};

const normalizeTelemetry = (raw: unknown): AiUsageTelemetry => {
  const base = createEmptyTelemetry();
  const bucketsRaw = (raw as AiUsageTelemetry | null)?.buckets;

  for (const action of ACTIONS) {
    const bucket = (bucketsRaw as Record<string, AiUsageBucket> | undefined)?.[action];
    base.buckets[action] = {
      action,
      calls: clampIncrement(bucket?.calls),
      successfulCalls: clampIncrement(bucket?.successfulCalls),
      failedCalls: clampIncrement(bucket?.failedCalls),
      uploadedAudioBytes: clampIncrement(bucket?.uploadedAudioBytes),
      returnedAudioBytes: clampIncrement(bucket?.returnedAudioBytes),
      requestTextChars: clampIncrement(bucket?.requestTextChars),
      responseTextChars: clampIncrement(bucket?.responseTextChars),
      itemsReturned: clampIncrement(bucket?.itemsReturned),
      warnings: clampIncrement(bucket?.warnings),
      errors: clampIncrement(bucket?.errors),
      lastAt: typeof bucket?.lastAt === 'number' && Number.isFinite(bucket.lastAt) ? bucket.lastAt : null,
    };
  }

  const updatedAt = (raw as AiUsageTelemetry | null)?.updatedAt;
  return {
    updatedAt: typeof updatedAt === 'number' && Number.isFinite(updatedAt) ? updatedAt : null,
    buckets: base.buckets,
  };
};

export const readAiUsageTelemetry = (): AiUsageTelemetry => {
  if (!isBrowser()) return createEmptyTelemetry();

  try {
    const stored = window.localStorage.getItem(AI_USAGE_KEY);
    if (!stored) return createEmptyTelemetry();
    return normalizeTelemetry(JSON.parse(stored));
  } catch {
    return createEmptyTelemetry();
  }
};

export const recordAiUsage = (action: AiUsageAction, delta: AiUsageDelta): AiUsageTelemetry => {
  const telemetry = readAiUsageTelemetry();
  const bucket = telemetry.buckets[action] || createBucket(action);
  const now = Date.now();

  const nextBucket: AiUsageBucket = {
    ...bucket,
    calls: bucket.calls + clampIncrement(delta.calls),
    successfulCalls: bucket.successfulCalls + clampIncrement(delta.successfulCalls),
    failedCalls: bucket.failedCalls + clampIncrement(delta.failedCalls),
    uploadedAudioBytes: bucket.uploadedAudioBytes + clampIncrement(delta.uploadedAudioBytes),
    returnedAudioBytes: bucket.returnedAudioBytes + clampIncrement(delta.returnedAudioBytes),
    requestTextChars: bucket.requestTextChars + clampIncrement(delta.requestTextChars),
    responseTextChars: bucket.responseTextChars + clampIncrement(delta.responseTextChars),
    itemsReturned: bucket.itemsReturned + clampIncrement(delta.itemsReturned),
    warnings: bucket.warnings + clampIncrement(delta.warnings),
    errors: bucket.errors + clampIncrement(delta.errors),
    lastAt: now,
  };

  const nextTelemetry: AiUsageTelemetry = {
    updatedAt: now,
    buckets: {
      ...telemetry.buckets,
      [action]: nextBucket,
    },
  };

  if (isBrowser()) {
    try {
      window.localStorage.setItem(AI_USAGE_KEY, JSON.stringify(nextTelemetry));
    } catch {
      // noop
    }
  }

  return nextTelemetry;
};
