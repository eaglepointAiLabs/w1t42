function normalizeArray(value) {
  if (!value) {
    return [];
  }
  if (Array.isArray(value)) {
    return value;
  }
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function toTimeScore(dateValue) {
  const ts = new Date(dateValue || Date.now()).getTime();
  const ageHours = Math.max(0, (Date.now() - ts) / (1000 * 60 * 60));
  return Math.max(0, 100 - ageHours);
}

function tagBoost(tags, preferredSports, browsingSignals) {
  const set = new Set((tags || []).map((t) => String(t).toLowerCase()));
  let score = 0;
  for (const sport of preferredSports || []) {
    if (set.has(String(sport).toLowerCase())) {
      score += 12;
    }
  }
  for (const signal of browsingSignals || []) {
    if (set.has(String(signal).toLowerCase())) {
      score += 5;
    }
  }
  return score;
}

function scoreFeedCandidate(candidate, context) {
  const base = toTimeScore(candidate.publishedAt);
  const typeWeight = candidate.type === "activity" ? 20 : candidate.type === "course_update" ? 15 : 10;
  const sportsBoost = tagBoost(candidate.tags, context.preferredSports, context.browsingSignals);
  const followedBoost =
    candidate.authorUserId && context.followedAuthorIdsSet && context.followedAuthorIdsSet.has(Number(candidate.authorUserId)) ? 14 : 0;

  let score = base + typeWeight + sportsBoost + followedBoost;
  if (context.coldStart && context.preferredSports.length) {
    score += sportsBoost > 0 ? 10 : 0;
  }
  return score;
}

function dedupeCandidates(candidates, seenSignals = {}) {
  const similarityKeys = seenSignals instanceof Set ? seenSignals : seenSignals.similarityKeys;
  const contentItemIds = seenSignals instanceof Set ? new Set() : seenSignals.contentItemIds;
  const seenSimilarityKeys = new Set(similarityKeys || []);
  const seenContentItemIds = new Set(contentItemIds || []);
  const result = [];

  for (const item of candidates) {
    const contentItemId = item.type === "news" ? item.id : item.contentItemId || item.payload?.contentItemId || null;

    if (item.similarityKey && seenSimilarityKeys.has(item.similarityKey)) {
      continue;
    }
    if (contentItemId && seenContentItemIds.has(Number(contentItemId))) {
      continue;
    }

    if (item.similarityKey) {
      seenSimilarityKeys.add(item.similarityKey);
    }
    if (contentItemId) {
      seenContentItemIds.add(Number(contentItemId));
    }

    result.push(item);
  }

  return result;
}

module.exports = {
  normalizeArray,
  scoreFeedCandidate,
  dedupeCandidates
};
