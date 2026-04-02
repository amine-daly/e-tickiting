export interface UserErrorRule {
  pattern: RegExp;
  message: string;
}

export function resolveUserErrorMessage(
  error: unknown,
  rules: UserErrorRule[],
  fallbackMessage: string,
): string {
  const rawMessage = extractBackendMessage(error);
  if (!rawMessage) {
    return fallbackMessage;
  }

  const matchedRule = rules.find((rule) => rule.pattern.test(rawMessage));
  return matchedRule?.message || fallbackMessage;
}

function extractBackendMessage(error: unknown): string {
  const maybeError = error as any;
  const messageCandidates = [
    maybeError?.error?.message,
    maybeError?.error?.details,
    maybeError?.message,
  ];

  const firstText = messageCandidates.find(
    (candidate) => typeof candidate === 'string' && candidate.trim().length > 0,
  );

  return typeof firstText === 'string' ? firstText : '';
}
