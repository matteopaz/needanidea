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

DELETE FROM comment_votes;
DELETE FROM comments;
DELETE FROM idea_votes;
DELETE FROM ideas;

INSERT INTO ideas (content, author, upvotes) VALUES ('a website for startup ideas', '@soupydev', ABS(RANDOM() % 81) + 40);
INSERT INTO ideas (content, author, upvotes) VALUES ('tinder for openclaw', '@adarsh', ABS(RANDOM() % 81) + 40);
INSERT INTO ideas (content, author, upvotes) VALUES ('devops + tooling for fleets of agents. prompts, reliability, monitoring, costs. spark-like infra for agent swarms.', '@ycombinator', ABS(RANDOM() % 81) + 40);
INSERT INTO ideas (content, author, upvotes) VALUES ('consumer software versions of accountants, tutors, trainers, lawyers. bring “rich-people services” to everyone.', '@ycombinator', ABS(RANDOM() % 81) + 40);
INSERT INTO ideas (content, author, upvotes) VALUES ('fast, AI-driven vocational schools for electricians, welders, HVAC. massive data-center buildout, not enough skilled labor. gov money + urgency.', '@ycombinator', ABS(RANDOM() % 81) + 40);
INSERT INTO ideas (content, author, upvotes) VALUES ('human-level phone agents. replace call centers, IVRs, hold music. trillion-call market.', '@ycombinator', ABS(RANDOM() % 81) + 40);
INSERT INTO ideas (content, author, upvotes) VALUES ('ML physics sim - replace physics solvers with learned models. orders-of-magnitude faster predictions.', '@ycombinator', ABS(RANDOM() % 81) + 40);
INSERT INTO ideas (content, author, upvotes) VALUES ('B2B stablecoin infra, custody, payments. regulation easing, volumes exploding.', '@ycombinator', ABS(RANDOM() % 81) + 40);
INSERT INTO ideas (content, author, upvotes) VALUES ('use reasoning models to design ASICs/FPGAs. target extremely specialized hardware.', '@ycombinator', ABS(RANDOM() % 81) + 40);
INSERT INTO ideas (content, author, upvotes) VALUES ('AI-powered CAD, EDA, CFD. design planes, chips, buildings faster with reasoning models.', '@ycombinator', ABS(RANDOM() % 81) + 40);
INSERT INTO ideas (content, author, upvotes) VALUES ('scale cheap MRI screening with AI. catch cancer early, save lives.', '@ycombinator', ABS(RANDOM() % 81) + 40);
INSERT INTO ideas (content, author, upvotes) VALUES ('for regtech, design LLMs to read regs, policies, data. continuous audits, no sampling. massive headcount replacement.', '@ycombinator', ABS(RANDOM() % 81) + 40);
INSERT INTO ideas (content, author, upvotes) VALUES ('(b2b) AI tax accountants, billers, QA testers. real workflows, real integrations, insane growth once it works.', '@ycombinator', ABS(RANDOM() % 81) + 40);
INSERT INTO ideas (content, author, upvotes) VALUES ('hyperspecialized models and rl environments for cybersecurity/whitehat. contract w/ gov, build up a cyberweaponry division around you.', '@matteopaz06', ABS(RANDOM() % 81) + 40);
INSERT INTO ideas (content, author, upvotes) VALUES ('a saas which generates a roadmap for learning skills according to the latest trends', '@resorcinolworks', ABS(RANDOM() % 81) + 40);
INSERT INTO ideas (content, author, upvotes) VALUES ('sell insurance for 80% less than what it currently costs + handle escrow. racket and a big market. seems like a straightforward >$1B company.', '@sama', ABS(RANDOM() % 81) + 40);
INSERT INTO ideas (content, author, upvotes) VALUES ('when startups raise a round, they want fixed income on the cash. existing services suck and are $$$.', '@sama', ABS(RANDOM() % 81) + 40);
INSERT INTO ideas (content, author, upvotes) VALUES ('humans will be the bottleneck for medicine discovery. engineer a fully automated wetlab in a box, sold as units. ai could validate, explore, and self-improve independently without slowdown.', '@matteopaz06', ABS(RANDOM() % 81) + 40);
INSERT INTO ideas (content, author, upvotes) VALUES ('two-sided matching market for semi-durable semi-skilled labor (bars/restaurants, retail, events, security, construction). launch w/ regional chains in select cities/verticals b/o local research, grow network.', '@willccbb', ABS(RANDOM() % 81) + 40);
