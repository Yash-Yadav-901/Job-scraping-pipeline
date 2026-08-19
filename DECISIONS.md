# DECISIONS.md — Job Ingestion Pipeline

## 1. Why this ingestion strategy over the obvious alternative you rejected?

**Strategy Chosen:** 
We opted for a lightweight HTTP fetch (axios) combined with a fast HTML/XML parser (cheerio), targeting structured public RSS/JSON feeds.

**Alternative Rejected:** 
Heavy browser automation tools (like Selenium or Puppeteer).

**Why:** 
While headless browsers can render complex client-side JavaScript, they introduce massive performance overhead, require high memory, and easily trigger strict bot-detection fingerprinting (e.g., `navigator.webdriver` flags) on target platforms. The chosen lightweight approach ensures fast, reliable, and clean execution suitable for a production-grade microservice.

---

## 2. One trade-off you made under the time limit, and what you’d do with a real week.

**The Trade-Off:** 
Due to the tight campus recruitment time limit, we implemented a straightforward synchronous fetch-on-request model with basic error handling rather than a fully distributed, asynchronous background queue.

**With a Real Week:** 
We would build a robust, distributed background ingestion pipeline using a message broker (like RabbitMQ or Redis BullMQ) paired with scheduled cron workers, persistent database caching (PostgreSQL), and automated proxy rotation pools to handle massive concurrent extraction jobs at scale.

---

## 3. Where did you use AI tools, and what did you personally verify or change afterward?

**AI Usage:** 
AI models were utilized to accelerate boilerplate generation for the Express server routing, CORS configuration, and drafting initial XML parsing selectors.

**Personal Verification & Changes:** 
Every line of code was manually reviewed, tested, and modified. Specifically, we manually added safety guardrail parameters (such as strict 10-second timeout thresholds and fallback try/catch execution blocks) to prevent silent thread crashes, and we personally verified that the data source complied strictly with low-risk public data policies.
