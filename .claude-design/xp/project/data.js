// Mock graph for XP prototype.
window.XP_DATA = (() => {
  const nodes = {};
  const N = (id, type, title, mainParent, extra = {}) => {
    nodes[id] = { id, type, title, mainParent, ...extra };
    return id;
  };

  // DOMAINS
  N("d.work", "DOMAIN", "Work", null, { description: "Career, dev work, freelance." });
  N("d.dev", "DOMAIN", "Dev", "d.work");
  N("d.finance", "DOMAIN", "Finance", "d.work");
  N("d.personal", "DOMAIN", "Personal", null);
  N("d.learning", "DOMAIN", "Learning", null);
  N("d.health", "DOMAIN", "Health", null);

  // SKILLS
  N("s.swe", "SKILL", "SWE", "d.dev", { level: 3, xp: 340, xpToNext: 500, weekGain: 45, sparkline: [12, 18, 8, 22, 30, 15, 25] });
  N("s.data", "SKILL", "Data Engineering", "d.dev", { level: 2, xp: 200, xpToNext: 500, weekGain: 20, sparkline: [5, 8, 0, 12, 6, 4, 9] });
  N("s.devops", "SKILL", "DevOps", "d.dev", { level: 1, xp: 100, xpToNext: 500, weekGain: 10, sparkline: [0, 3, 5, 2, 0, 8, 4] });
  N("s.writing", "SKILL", "Writing", "d.personal", { level: 2, xp: 180, xpToNext: 500, weekGain: 8, sparkline: [4, 0, 2, 6, 0, 1, 3] });
  N("s.guitar", "SKILL", "Guitar", "d.personal", { level: 1, xp: 60, xpToNext: 500, weekGain: 6, sparkline: [2, 0, 4, 1, 3, 0, 2] });

  // PROJECTS
  N("p.xp", "PROJECT", "Project XP", "d.dev", { status: "IN_PROGRESS", progress: 60, start: "2026-04-12", end: "2026-06-15" });
  N("p.aura", "PROJECT", "Project Aura", "d.dev", { status: "IN_PROGRESS", progress: 30, start: "2026-03-01", end: "2026-07-30" });
  N("p.gateway", "PROJECT", "Skooldio Gateway", "d.dev", { status: "DONE", progress: 100, start: "2026-01-10", end: "2026-04-02" });
  N("p.taxes", "PROJECT", "2025 Tax Filing", "d.finance", { status: "IN_PROGRESS", progress: 45 });

  // TASKS
  N("t.deploy", "TASK", "Deploy production hotfix", "p.xp", {
    status: "TODO", priority: "high", due: "2026-05-17", tags: ["urgent", "deploy"],
    description: "Roll out the auth fix to production after QA signs off. Coordinate with ops to schedule the rollout window.",
    overdue: true,
    extraParents: ["per.alice"],
  });
  N("t.replyAlice", "TASK", "Reply to Alice", "d.personal", {
    status: "TODO", priority: "medium", due: "2026-05-18", tags: ["email"],
    overdue: true, extraParents: ["per.alice"],
  });
  N("t.kanban", "TASK", "Build Kanban UI", "p.xp", {
    status: "IN_PROGRESS", priority: "medium", due: "2026-06-01", tags: ["ui"], progress: 55,
  });
  N("t.docs", "TASK", "Write docs", "p.xp", {
    status: "TODO", priority: "low", due: "2026-06-08", tags: ["docs"],
  });
  N("t.ci", "TASK", "Fix CI", "p.aura", {
    status: "IN_PROGRESS", priority: "high", due: "2026-05-22", tags: ["devops"],
  });
  N("t.graph", "TASK", "Wire graph view", "p.xp", {
    status: "IN_PROGRESS", priority: "medium", due: "2026-06-05", tags: ["ui"],
  });
  N("t.authBug", "TASK", "Fix auth bug", "p.xp", { status: "DONE", xpAwarded: 25, completedAt: "2h ago", tags: ["urgent"] });
  N("t.tests", "TASK", "Write tests", "p.xp", { status: "DONE", xpAwarded: 15, completedAt: "yesterday", tags: ["quality"] });
  N("t.review", "TASK", "Review PR", "p.aura", { status: "DONE", xpAwarded: 10, completedAt: "yesterday" });
  N("t.linter", "TASK", "Setup linter", "p.aura", { status: "DONE", xpAwarded: 10, completedAt: "3d ago" });
  N("t.smoke", "TASK", "Run smoke tests", "t.deploy", { status: "TODO", priority: "high" });
  N("t.rollback", "TASK", "Write rollback plan", "t.deploy", { status: "DONE", xpAwarded: 8 });

  // ROUTINES (cadence: daily / weekly / monthly)
  // history is an array of 30 days [oldest..today]: 1 = done, 0 = missed, null = N/A (not scheduled)
  const rand30 = (seed) => {
    let s = seed; const out = [];
    for (let i = 0; i < 30; i++) { s = (s * 9301 + 49297) % 233280; out.push((s / 233280) > 0.18 ? 1 : 0); }
    return out;
  };
  const sparse30 = (seed, density = 0.7) => {
    let s = seed; const out = [];
    for (let i = 0; i < 30; i++) { s = (s * 9301 + 49297) % 233280; out.push((s / 233280) < density ? 1 : 0); }
    return out;
  };

  N("r.workout", "ROUTINE", "Morning workout", "d.health", {
    cadence: "daily", group: "Health", streak: 14, target: "7/wk",
    history: rand30(7), thisWeek: 6, weekTarget: 7,
    description: "20-min calisthenics + 10-min mobility.",
  });
  N("r.meditate", "ROUTINE", "Meditate", "d.health", {
    cadence: "daily", group: "Health", streak: 8, target: "7/wk",
    history: rand30(3), thisWeek: 5, weekTarget: 7,
  });
  N("r.read", "ROUTINE", "Read 30 min", "d.learning", {
    cadence: "daily", group: "Learning", streak: 22, target: "7/wk",
    history: rand30(11), thisWeek: 7, weekTarget: 7,
  });
  N("r.journal", "ROUTINE", "Journal", "d.personal", {
    cadence: "daily", group: "Mind", streak: 3, target: "7/wk",
    history: sparse30(5, 0.55), thisWeek: 4, weekTarget: 7,
  });
  N("r.deepWork", "ROUTINE", "2h deep work", "d.dev", {
    cadence: "daily", group: "Work", streak: 11, target: "5/wk",
    history: sparse30(17, 0.72), thisWeek: 4, weekTarget: 5,
  });
  N("r.review", "ROUTINE", "Weekly review", "d.personal", {
    cadence: "weekly", group: "Mind", streak: 9, target: "1/wk",
    history: sparse30(19, 0.85), thisWeek: 0, weekTarget: 1, weekly: [1,1,1,0,1,1,1,1,1,0,1,1],
    dueThisWeek: true,
  });
  N("r.gym", "ROUTINE", "Strength training", "d.health", {
    cadence: "weekly", group: "Health", streak: 4, target: "3/wk",
    history: sparse30(23, 0.45), thisWeek: 2, weekTarget: 3, weekly: [3,3,2,3,3,2,3,3,1,3,2,3],
  });
  N("r.parents", "ROUTINE", "Call parents", "d.personal", {
    cadence: "weekly", group: "Relationships", streak: 6, target: "1/wk",
    history: sparse30(29, 0.7), thisWeek: 1, weekTarget: 1, weekly: [1,1,0,1,1,1,1,0,1,1,1,1],
  });
  N("r.budget", "ROUTINE", "Budget review", "d.finance", {
    cadence: "monthly", group: "Finance", streak: 5, target: "1/mo",
    history: sparse30(31, 0.95), thisMonthDone: true, monthly: [1,1,1,0,1,1],
  });
  N("r.haircut", "ROUTINE", "Haircut", "d.personal", {
    cadence: "monthly", group: "Personal", streak: 0, target: "1/mo",
    history: sparse30(37, 0.7), thisMonthDone: false, monthly: [1,0,1,1,0,0], dueThisMonth: true,
  });

  // PEOPLE (with a circle/group)
  N("per.alice", "PERSON", "Alice Sutton", "d.personal", {
    initials: "AS", email: "alice@studio.co", phone: "089-123-4421",
    role: "Designer", circle: "Close Friends",
    nextCatchup: "2026-05-21", catchupState: "upcoming", relativeDate: "in 2 days",
  });
  N("per.hana", "PERSON", "Hana Pham", "d.personal", {
    initials: "HP", email: "hana.p@gmail.com", phone: "081-554-1100",
    role: "PM", circle: "Close Friends",
    nextCatchup: "2026-05-26", catchupState: "upcoming", relativeDate: "in 7 days",
  });
  N("per.maya", "PERSON", "Maya Lin", "d.personal", {
    initials: "ML", email: "maya@studio.co", phone: "080-225-8810",
    role: "Architect", circle: "Close Friends",
    nextCatchup: null, catchupState: "none",
  });

  N("per.eve", "PERSON", "Eve Patel", "d.personal", {
    initials: "EP", email: "eve@gmail.com", phone: "099-228-7711",
    role: "Sister", circle: "Family",
    nextCatchup: "2026-05-26", catchupState: "upcoming", relativeDate: "in 7 days",
  });
  N("per.ivy", "PERSON", "Ivy Patel", "d.personal", {
    initials: "IP", email: "ivy@gmail.com", phone: "099-228-9912",
    role: "Mom", circle: "Family",
    nextCatchup: "2026-05-22", catchupState: "upcoming", relativeDate: "in 3 days",
  });
  N("per.raj", "PERSON", "Raj Patel", "d.personal", {
    initials: "RP", email: "raj@gmail.com", phone: "099-228-3344",
    role: "Dad", circle: "Family",
    nextCatchup: "2026-05-15", catchupState: "overdue", relativeDate: "4 days overdue",
  });

  N("per.bob", "PERSON", "Bob Karuna", "d.dev", {
    initials: "BK", email: "bob@aura.dev", phone: "082-771-9020",
    role: "Tech lead", circle: "Aura Team",
    nextCatchup: null, catchupState: "none",
  });
  N("per.dara", "PERSON", "Dara Wong", "d.dev", {
    initials: "DW", email: "dara@aura.dev", phone: "086-410-2289",
    role: "Backend eng", circle: "Aura Team",
    nextCatchup: "2026-05-24", catchupState: "upcoming", relativeDate: "in 5 days",
  });
  N("per.jin", "PERSON", "Jin Park", "d.dev", {
    initials: "JP", email: "jin@aura.dev", phone: "086-410-7711",
    role: "Frontend eng", circle: "Aura Team",
    nextCatchup: "2026-05-20", catchupState: "upcoming", relativeDate: "tomorrow",
  });

  N("per.charlie", "PERSON", "Charlie T.", "d.work", {
    initials: "CT", email: "charlie@xp.io", phone: "081-554-2210",
    role: "Eng manager", circle: "Core Team",
    nextCatchup: "2026-05-16", catchupState: "overdue", relativeDate: "3 days overdue",
  });
  N("per.nina", "PERSON", "Nina Asano", "d.work", {
    initials: "NA", email: "nina@xp.io", phone: "081-554-6611",
    role: "Designer", circle: "Core Team",
    nextCatchup: "2026-05-28", catchupState: "upcoming", relativeDate: "in 9 days",
  });

  N("per.finn", "PERSON", "Finn O'Hara", "d.learning", {
    initials: "FO", email: "finn@mentor.org", phone: "081-002-6611",
    role: "CTO mentor", circle: "Mentors",
    nextCatchup: "2026-06-01", catchupState: "upcoming", relativeDate: "in 13 days",
  });
  N("per.greg", "PERSON", "Greg Holm", "d.learning", {
    initials: "GH", email: "greg@spark.vc", phone: "087-008-1133",
    role: "Career mentor", circle: "Mentors",
    nextCatchup: null, catchupState: "none",
  });

  N("per.kira", "PERSON", "Kira Sato", "d.work", {
    initials: "KS", email: "kira@indie.co", phone: "081-110-2200",
    role: "Founder", circle: "Network",
    nextCatchup: "2026-05-13", catchupState: "overdue", relativeDate: "6 days overdue",
  });
  N("per.leo", "PERSON", "Leo Marquez", "d.work", {
    initials: "LM", email: "leo@gh.io", phone: "081-110-7711",
    role: "Recruiter", circle: "Network",
    nextCatchup: null, catchupState: "none",
  });

  // TAGS
  N("tag.urgent", "TAG", "urgent", null);
  N("tag.deploy", "TAG", "deploy", null);
  N("tag.ui", "TAG", "ui", null);
  N("tag.docs", "TAG", "docs", null);
  N("tag.devops", "TAG", "devops", null);
  N("tag.quality", "TAG", "quality", null);
  N("tag.email", "TAG", "email", null);

  // helpers
  const breadcrumb = (id) => {
    const out = [];
    let cur = nodes[id];
    while (cur && cur.mainParent) {
      cur = nodes[cur.mainParent];
      if (cur) out.unshift(cur);
    }
    return out;
  };
  const children = (id) => Object.values(nodes).filter((n) => n.mainParent === id);

  return { nodes, breadcrumb, children };
})();
