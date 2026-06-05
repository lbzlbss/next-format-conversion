/** @typedef {'guest' | 'user' | 'pro'} QuotaTier */

/** @type {Record<QuotaTier, Record<string, number>>} */
export const DAILY_LIMITS = {
  guest: {
    chat: 20,
    imageGen: 2,
    convert: 30,
  },
  user: {
    chat: 100,
    imageGen: 20,
    convert: 200,
  },
  pro: {
    chat: 500,
    imageGen: 100,
    convert: 1000,
  },
};

/** @type {Record<string, string>} */
export const METRIC_LABELS = {
  chat: 'AI 对话',
  imageGen: '文生图',
  convert: '格式转换',
};

export const QUOTA_EXCEEDED_CODE = 'QUOTA_EXCEEDED';
