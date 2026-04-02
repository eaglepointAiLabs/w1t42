function canCreateFollowup(publishedAt, now = new Date()) {
  if (!publishedAt) {
    return false;
  }

  const end = new Date(publishedAt);
  end.setDate(end.getDate() + 30);
  return now <= end;
}

function canAppeal(publishedAt, now = new Date()) {
  if (!publishedAt) {
    return false;
  }

  const end = new Date(publishedAt);
  end.setDate(end.getDate() + 7);
  return now <= end;
}

function shouldEscalateHighRisk(upheldViolationCount) {
  return upheldViolationCount >= 3;
}

module.exports = {
  canCreateFollowup,
  canAppeal,
  shouldEscalateHighRisk
};
