function normalizeType(value) {
  const normalized = String(value || "").trim();
  return normalized || "unknown";
}

export function groupChunksByType(chunks) {
  const grouped = new Map();
  for (const chunk of Array.isArray(chunks) ? chunks : []) {
    const type = normalizeType(chunk?.chunk_type || chunk?.chunkType);
    const existing = grouped.get(type) || [];
    existing.push(chunk);
    grouped.set(type, existing);
  }

  const output = [];
  for (const [type, items] of grouped.entries()) {
    output.push({ type, count: items.length, items });
  }
  output.sort((left, right) => left.type.localeCompare(right.type));
  return output;
}

export function buildContextExportPayload(context) {
  const doc = context?.document || null;
  return {
    exportedAt: new Date().toISOString(),
    document: doc,
    captures: Array.isArray(context?.captures) ? context.captures : [],
    chunks: Array.isArray(context?.chunks) ? context.chunks : [],
    entities: Array.isArray(context?.entities) ? context.entities : [],
    edges: Array.isArray(context?.edges) ? context.edges : [],
    annotations: Array.isArray(context?.annotations) ? context.annotations : [],
    transcriptSegments: Array.isArray(context?.transcriptSegments) ? context.transcriptSegments : []
  };
}
