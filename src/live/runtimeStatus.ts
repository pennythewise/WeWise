type Translate = (zh: string, en: string) => string;
type RuntimeHealth = {
  ai?: { configured?: boolean; model?: string; live_verified?: boolean };
  jev?: { configured?: boolean; verified_live?: boolean };
} | null | undefined;

export function aiRuntimeText(health: RuntimeHealth, t: Translate): string {
  if (!health) return t('正在读取模型状态', 'Reading model status');
  if (!health.ai?.configured) return t('模型未启用 · 使用有出处的检索摘录', 'Model disabled · sourced retrieval extracts');
  const status = health.ai.live_verified
    ? t('已记录成功 API 调用', 'Successful API call recorded')
    : t('已配置 · 尚未记录成功 API 调用', 'Configured · no successful API call recorded yet');
  return `${health.ai.model ?? t('外部模型', 'External model')} · ${status}`;
}

export function jevRuntimeText(health: RuntimeHealth, t: Translate): string {
  if (!health) return t('正在读取路由状态', 'Reading routing status');
  if (!health.jev?.configured) return t('未接通 · 使用规则路由', 'Not connected · rules routing');
  return health.jev.verified_live
    ? t('已记录成功 API 调用 · 仅提供路由建议', 'Successful API call recorded · routing advice only')
    : t('已配置 · 尚未记录成功 API 调用；规则保持权威', 'Configured · no successful API call recorded yet; rules remain authoritative');
}

export function modelDataNotice(health: RuntimeHealth, t: Translate): string {
  return health?.ai?.configured
    ? t('仅使用合成资料。问题与相关条款片段经尽量遮盖个人信息后，可能发送至外部模型；遮盖并不保证移除全部个人信息。服务不可用或答案核验未通过时，回退至有出处的检索摘录。', 'Use synthetic data only. Questions and relevant source excerpts may be sent to an external model after masking known personal information; masking may miss details. Unavailable or unverified answers fall back to sourced retrieval extracts.')
    : t('当前使用有出处的检索摘录与规则流程。模型状态以实际成功调用为准；保险公司回执、时间线与回拨仍为模拟。', 'Sourced retrieval and rule workflows are active. Model status follows recorded API calls; insurer receipts, timelines and callbacks remain simulated.');
}

export function answerEngineText(engine: string, t: Translate): string {
  if (engine === 'claude_api') return t('本次回答：Claude · 原文摘录核验通过', 'This answer: Claude · source-extract checks passed');
  if (engine === 'compatible_model_api') return t('本次回答：外部模型 · 原文摘录核验通过', 'This answer: external model · source-extract checks passed');
  if (engine === 'retrieval_only') return t('本次回答：有出处的检索摘录', 'This answer: sourced retrieval extracts');
  return t('本次回答：规则与应用工具', 'This answer: rules and application tools');
}
