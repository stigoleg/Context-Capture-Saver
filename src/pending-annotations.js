function buildAnnotationId() {
  return globalThis.crypto?.randomUUID
    ? globalThis.crypto.randomUUID()
    : `annotation-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

function normalizeAnnotationRecord(annotation) {
  return {
    id: annotation?.id || buildAnnotationId(),
    selectedText: annotation?.selectedText ?? "",
    comment: annotation?.comment ?? null,
    createdAt: annotation?.createdAt || new Date().toISOString()
  };
}

export function createPendingAnnotationsStore() {
  const pendingAnnotationsByTab = new Map();

  return {
    add(tabId, annotation) {
      const existing = pendingAnnotationsByTab.get(tabId) || [];
      const entry = normalizeAnnotationRecord(annotation);
      existing.push(entry);
      pendingAnnotationsByTab.set(tabId, existing);
      return {
        count: existing.length,
        annotation: entry
      };
    },

    remove(tabId, annotationId) {
      const existing = pendingAnnotationsByTab.get(tabId) || [];
      if (!annotationId) {
        return {
          count: existing.length,
          removed: false
        };
      }

      const next = existing.filter((annotation) => annotation?.id !== annotationId);
      const removed = next.length !== existing.length;
      if (next.length > 0) {
        pendingAnnotationsByTab.set(tabId, next);
      } else {
        pendingAnnotationsByTab.delete(tabId);
      }

      return {
        count: next.length,
        removed
      };
    },

    clear(tabId) {
      pendingAnnotationsByTab.delete(tabId);
    },

    snapshot(tabId) {
      const existing = pendingAnnotationsByTab.get(tabId) || [];
      return existing.map(normalizeAnnotationRecord);
    },

    take(tabId) {
      const existing = pendingAnnotationsByTab.get(tabId);
      if (!existing || existing.length === 0) {
        return [];
      }
      pendingAnnotationsByTab.delete(tabId);
      return existing.map(normalizeAnnotationRecord);
    }
  };
}
