/**
 * 释放未走完转换流程的临时 Blob（仅 asset-seq/ asset-vap/ 等前缀，无需管理员密钥）
 * @param {string | null | undefined} blobUrl
 */
export async function releaseTempBlob(blobUrl) {
  if (!blobUrl) return { deleted: false };
  const res = await fetch('/api/blob/cleanup?blobUrl=' + encodeURIComponent(blobUrl), {
    method: 'POST',
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json?.message || json?.error || `释放失败 (${res.status})`);
  }
  return json;
}
