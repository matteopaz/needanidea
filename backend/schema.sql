CREATE TABLE IF NOT EXISTS ideas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  content TEXT NOT NULL,
  author TEXT NOT NULL,
  upvotes INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS idea_votes (
  idea_id INTEGER NOT NULL,
  voter TEXT NOT NULL,
  delta INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (idea_id, voter)
);

CREATE TABLE IF NOT EXISTS oauth_states (
  state TEXT PRIMARY KEY,
  code_verifier TEXT NOT NULL,
  return_to TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  handle TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  idea_id INTEGER NOT NULL,
  author TEXT NOT NULL,
  content TEXT NOT NULL,
  upvotes INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS comments_idea_id ON comments(idea_id);

CREATE TABLE IF NOT EXISTS comment_votes (
  comment_id INTEGER NOT NULL,
  voter TEXT NOT NULL,
  delta INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (comment_id, voter)
);

INSERT INTO ideas (content, author, upvotes)
SELECT 'a website for startup ideas', '@soupydev', 99
WHERE NOT EXISTS (
  SELECT 1 FROM ideas WHERE content = 'a website for startup ideas' AND author = '@soupydev'
);

INSERT INTO ideas (content, author, upvotes)
SELECT 'tinder for openclaw', '@adarsh', 99
WHERE NOT EXISTS (
  SELECT 1 FROM ideas WHERE content = 'tinder for openclaw' AND author = '@adarsh'
);

INSERT INTO ideas (content, author, upvotes)
SELECT 'devops + tooling for fleets of agents. prompts, reliability, monitoring, costs. spark-like infra for agent swarms.', '@ycombinator', 99
WHERE NOT EXISTS (
  SELECT 1 FROM ideas WHERE content = 'devops + tooling for fleets of agents. prompts, reliability, monitoring, costs. spark-like infra for agent swarms.' AND author = '@ycombinator'
);

INSERT INTO ideas (content, author, upvotes)
SELECT 'consumer software versions of accountants, tutors, trainers, lawyers. bring “rich-people services” to everyone.', '@ycombinator', 99
WHERE NOT EXISTS (
  SELECT 1 FROM ideas WHERE content = 'consumer software versions of accountants, tutors, trainers, lawyers. bring “rich-people services” to everyone.' AND author = '@ycombinator'
);

INSERT INTO ideas (content, author, upvotes)
SELECT 'fast, AI-driven vocational schools for electricians, welders, HVAC. massive data-center buildout, not enough skilled labor. gov money + urgency.', '@ycombinator', 99
WHERE NOT EXISTS (
  SELECT 1 FROM ideas WHERE content = 'fast, AI-driven vocational schools for electricians, welders, HVAC. massive data-center buildout, not enough skilled labor. gov money + urgency.' AND author = '@ycombinator'
);

INSERT INTO ideas (content, author, upvotes)
SELECT 'human-level phone agents. replace call centers, IVRs, hold music. trillion-call market.', '@ycombinator', 99
WHERE NOT EXISTS (
  SELECT 1 FROM ideas WHERE content = 'human-level phone agents. replace call centers, IVRs, hold music. trillion-call market.' AND author = '@ycombinator'
);

INSERT INTO ideas (content, author, upvotes)
SELECT 'ML physics sim - replace physics solvers with learned models. orders-of-magnitude faster predictions.', '@ycombinator', 99
WHERE NOT EXISTS (
  SELECT 1 FROM ideas WHERE content = 'ML physics sim - replace physics solvers with learned models. orders-of-magnitude faster predictions.' AND author = '@ycombinator'
);

INSERT INTO ideas (content, author, upvotes)
SELECT 'B2B stablecoin infra, custody, payments. regulation easing, volumes exploding.', '@ycombinator', 99
WHERE NOT EXISTS (
  SELECT 1 FROM ideas WHERE content = 'B2B stablecoin infra, custody, payments. regulation easing, volumes exploding.' AND author = '@ycombinator'
);

INSERT INTO ideas (content, author, upvotes)
SELECT 'use reasoning models to design ASICs/FPGAs. target extremely specialized hardware.', '@ycombinator', 99
WHERE NOT EXISTS (
  SELECT 1 FROM ideas WHERE content = 'use reasoning models to design ASICs/FPGAs. target extremely specialized hardware.' AND author = '@ycombinator'
);

INSERT INTO ideas (content, author, upvotes)
SELECT 'AI-powered CAD, EDA, CFD. design planes, chips, buildings faster with reasoning models.', '@ycombinator', 99
WHERE NOT EXISTS (
  SELECT 1 FROM ideas WHERE content = 'AI-powered CAD, EDA, CFD. design planes, chips, buildings faster with reasoning models.' AND author = '@ycombinator'
);

INSERT INTO ideas (content, author, upvotes)
SELECT 'scale cheap MRI screening with AI. catch cancer early, save lives.', '@ycombinator', 99
WHERE NOT EXISTS (
  SELECT 1 FROM ideas WHERE content = 'scale cheap MRI screening with AI. catch cancer early, save lives.' AND author = '@ycombinator'
);

INSERT INTO ideas (content, author, upvotes)
SELECT 'for regtech, design LLMs to read regs, policies, data. continuous audits, no sampling. massive headcount replacement.', '@ycombinator', 99
WHERE NOT EXISTS (
  SELECT 1 FROM ideas WHERE content = 'for regtech, design LLMs to read regs, policies, data. continuous audits, no sampling. massive headcount replacement.' AND author = '@ycombinator'
);

INSERT INTO ideas (content, author, upvotes)
SELECT '(b2b) AI tax accountants, billers, QA testers. real workflows, real integrations, insane growth once it works.', '@ycombinator', 99
WHERE NOT EXISTS (
  SELECT 1 FROM ideas WHERE content = '(b2b) AI tax accountants, billers, QA testers. real workflows, real integrations, insane growth once it works.' AND author = '@ycombinator'
);

INSERT INTO ideas (content, author, upvotes)
SELECT 'hyperspecialized models and rl environments for cybersecurity/whitehat. contract w/ gov, build up a cyberweaponry division around you.', '@matteopaz06', 99
WHERE NOT EXISTS (
  SELECT 1 FROM ideas WHERE content = 'hyperspecialized models and rl environments for cybersecurity/whitehat. contract w/ gov, build up a cyberweaponry division around you.' AND author = '@matteopaz06'
);
