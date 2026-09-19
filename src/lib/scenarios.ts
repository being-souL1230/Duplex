export type SimTab = {
  tabId: number;
  title: string;
  url: string;
  secondsAgo: number;
};

export type Scenario = {
  id: string;
  name: string;
  hint: string;
  tabs: SimTab[];
};

/** Fake browser windows used by the in-app extension preview. */
export const SCENARIOS: Scenario[] = [
  {
    id: "mixed",
    name: "Mixed window",
    hint: "College work tangled with inbox and video",
    tabs: [
      { tabId: 1, title: "campus-connect · Issues", url: "https://github.com/team/campus-connect/issues", secondsAgo: 300 },
      { tabId: 2, title: "Project Report Draft", url: "https://docs.google.com/document/d/report-draft", secondsAgo: 280 },
      { tabId: 3, title: "Campus Connect UI", url: "https://figma.com/file/campus-connect-ui", secondsAgo: 240 },
      { tabId: 4, title: "localhost:3000/dashboard", url: "http://localhost:3000/dashboard", secondsAgo: 210 },
      { tabId: 5, title: "Lofi beats to study", url: "https://youtube.com/watch?v=lofi", secondsAgo: 90 },
      { tabId: 6, title: "Inbox (14)", url: "https://mail.google.com/mail/u/0/", secondsAgo: 60 },
    ],
  },
  {
    id: "client",
    name: "Client window",
    hint: "Freelance retainer resources",
    tabs: [
      { tabId: 1, title: "Northwind contract", url: "https://upwork.com/contracts/northwind", secondsAgo: 260 },
      { tabId: 2, title: "northwind-site · Pull requests", url: "https://github.com/nw/northwind-site/pulls", secondsAgo: 230 },
      { tabId: 3, title: "Landing revision v4", url: "https://figma.com/file/northwind-landing", secondsAgo: 190 },
      { tabId: 4, title: "Production deploys", url: "https://vercel.com/northwind/site/deployments", secondsAgo: 150 },
    ],
  },
  {
    id: "unknown",
    name: "Unrecognised window",
    hint: "A recurring cluster with no mode yet",
    tabs: [
      { tabId: 1, title: "Attention Is All You Need", url: "https://arxiv.org/abs/1706.03762", secondsAgo: 240 },
      { tabId: 2, title: "Transformer research notes", url: "https://notion.so/transformer-research", secondsAgo: 200 },
      { tabId: 3, title: "research citations", url: "https://scholar.google.com/citations?q=research", secondsAgo: 170 },
      { tabId: 4, title: "research summary chat", url: "https://chat.openai.com/c/research-summary", secondsAgo: 120 },
    ],
  },
  {
    id: "scattered",
    name: "Scattered window",
    hint: "Rapid jumps between unrelated contexts",
    tabs: [
      { tabId: 1, title: "campus-connect · Issues", url: "https://github.com/team/campus-connect/issues", secondsAgo: 620 },
      { tabId: 2, title: "Campus Connect UI", url: "https://figma.com/file/campus-connect-ui", secondsAgo: 540 },
      { tabId: 3, title: "Trailer breakdown", url: "https://youtube.com/watch?v=trailer", secondsAgo: 430 },
      { tabId: 4, title: "Inbox (14)", url: "https://mail.google.com/mail/u/0/", secondsAgo: 360 },
      { tabId: 5, title: "r/webdev", url: "https://reddit.com/r/webdev", secondsAgo: 250 },
      { tabId: 6, title: "Northwind contract", url: "https://upwork.com/contracts/northwind", secondsAgo: 140 },
      { tabId: 7, title: "localhost:3000/dashboard", url: "http://localhost:3000/dashboard", secondsAgo: 40 },
    ],
  },
];

export function scenarioById(id: string): Scenario {
  return SCENARIOS.find((s) => s.id === id) ?? SCENARIOS[0];
}
