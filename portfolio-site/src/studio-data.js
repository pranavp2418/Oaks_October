// Case narratives describe existing products. The accompanying study visuals are new concepts.
export const cases = {
  craftsmanai: {
    number:'01', title:'CraftsmanAI', headline:'One clear path through a custom jewelry order.',
    category:'COMMERCE / LIVE FOUNDER PRODUCT',
    intro:'A custom piece begins as an idea, then becomes a brief, a design, an estimate, an approval, and a manufacturer handoff. CraftsmanAI connects that journey.',
    role:'Founder & Lead Product Architect', scope:'Product direction, workflow, interface & full-stack implementation', status:'Live product · 2025–present',
    problem:'A jeweler needs to understand an open-ended request, turn it into something visual, explain the estimate, and keep the approved details intact through production. Each handoff creates an opportunity for missing context.',
    context:'My role spans the customer conversation and the implementation. The existing product includes structured intake, AI-assisted design, quotations, approvals, render management, and manufacturer handoff. Onboarding a first paying business and running demos provided a practical feedback loop.',
    constraint:'An AI image is a design direction, while an estimate carries assumptions. Those are different decisions. The interface needs to preserve that distinction and let the retailer review both before committing to the next step.',
    flow:['Capture the brief','Explore a direction','Review the estimate','Approve','Hand off'],
    decisions:[
      ['A structured starting point','Use a clear brief to capture the request before generating directions. In the companion concept study, material choices sit beside the piece being specified so the customer retains context.'],
      ['Keep feedback close to the object','The new approval-room concept anchors comments to a numbered point on the design. This explores how a retailer might connect a requested revision to a visible detail instead of an unstructured message thread.'],
      ['Explain the estimate','The estimate-review study separates material inputs, assumptions and a range. Its aim is to make uncertainty readable before approval; it is a design exploration, not a claim that these exact screens are already shipped.'],
      ['Connect the handoff','The implemented product connects quotations and approvals to manufacturer handoff. The design priority is to retain the approved request and make the next responsibility understandable.']
    ],
    implementation:'TypeScript/JavaScript, Python, REST APIs, relational data models, authentication and validation support the product workflow. OpenAI/Gemini integrations use prompt routing and structured-output guardrails. Engineering and interface decisions are part of the same product responsibility.',
    outcome:'CraftsmanAI is live, and the first paying business was onboarded. That supports a claim of real product ownership. This case study does not attribute revenue, conversion, usability or time savings to the new concepts.',
    next:'Test whether a first-time retailer can explain the current order stage, identify what remains unapproved, and distinguish an estimate from a committed price without help. Compare the intake and review concepts against the existing workflow before adopting them.',
    boundary:'The product and responsibilities above are existing work. The screens below are newly authored interface concepts with sample data; they are not production screenshots, customer-approved designs or completed usability research.',
    studies:['01-jewelry-brief','02-design-review','03-quote-builder','04-gemshot'],
    live:'https://craftsmanai.app', secondary:'/classic.html#craft-explorer', secondaryLabel:'Explore the original product walkthrough'
  },
  carethread: {
    number:'02', title:'CareThread', headline:'Make the next care step visible, and give it an owner.',
    category:'HEALTHCARE / INDEPENDENT DEMONSTRATION',
    intro:'An independent care-coordination demo that turns an incoming need into structured intake, document readiness, a referral packet and a reviewed handoff.',
    role:'Independent product builder', scope:'Workflow modeling, responsive interface & application implementation', status:'Live demonstration · Synthetic records',
    problem:'A care request contains needs, supporting documents, follow-up work and handoffs. A list of records alone does not explain what is missing, who should act, or what makes the packet ready for review.',
    context:'The demo models intake, a needs taxonomy, a case timeline with missing-document alerts, referral-packet preparation, supervisor review and an operational dashboard. These are demonstration workflows, not evidence of a deployed clinical service.',
    constraint:'The design must keep the person’s needs and the administrative work connected while making incomplete information visible. Demo records are synthetic. A polished screen does not establish clinical safety, regulatory compliance or improved patient outcomes.',
    flow:['Understand the need','Assign a next step','Gather evidence','Assemble a packet','Review the handoff'],
    decisions:[
      ['Ask in a useful order','The intake concept uses a staged form rather than an undifferentiated field list. Grouping the request makes the information architecture visible before adding visual polish.'],
      ['Show readiness, not just activity','The timeline concept brings the missing document and its next action into the case’s sequence. The question is whether a reviewer can distinguish recent activity from actual readiness.'],
      ['Make a handoff inspectable','The packet-assembly concept separates the available evidence, the selected packet and the review state. This explores what a coordinator needs to inspect before passing responsibility forward.'],
      ['Keep the final decision explicit','The supervisor-review concept pairs a queue with a decision panel. It keeps the chosen case visible while a reviewer considers the handoff, rather than hiding the decision behind another page.']
    ],
    implementation:'The existing portfolio records a TypeScript/React interface with a NestJS, TypeORM and PostgreSQL application stack. The live demo is opened in a separate tab so its session and access requirements remain with the application. Public source links are intentionally omitted.',
    outcome:'The working demonstration connects intake, evidence and review. No user study or operational patient outcome is claimed. The accompanying concepts make the design direction inspectable while keeping their unvalidated status visible.',
    next:'With synthetic cases, ask a coordinator to find a missing document, determine ownership, assemble a complete packet and explain whether a supervisor can approve it. Observe wrong turns before measuring task time.',
    boundary:'Independent portfolio demo, with no implied client or healthcare-provider affiliation. All study visuals are new concepts with sample data. They are not clinical records, screenshots of live customer work or validated clinical guidance.',
    studies:['05-care-intake','06-care-timeline','07-referral-packet','08-supervisor-review'],
    live:'https://carethread-pranav.vercel.app/'
  },
  reconciliation: {
    number:'03', title:'Reconciliation Engine', headline:'A match is only useful when someone can explain it.',
    category:'FINANCE / INDEPENDENT ENGINEERING DEMO',
    intro:'A working close workspace for matching book and bank records, inspecting historical prices and valuing inventory with FIFO lots. The interface makes the evidence and unresolved exceptions visible.',
    role:'Independent engineer & interface builder', scope:'Python matching core, review workflow & evidence presentation', status:'Live demonstration · Synthetic financial data',
    problem:'A suggested match can look plausible while hiding an amount difference, an account boundary or another equally good candidate. A reviewer needs to inspect the basis for the match and keep uncertainty unresolved when the evidence is not decisive.',
    context:'The implemented workflow opens a synthetic close, lets a reviewer adjust date and cent tolerances, inspect differences, assign exception ownership and record a reviewed match. Historical price lookup and FIFO inventory are connected but separately explained workflows.',
    constraint:'The actual core uses decimal strings converted to integer cents. Matching stays within account and currency boundaries, and equal-optimum alternatives are withheld for review. The interface must not turn a mathematically ambiguous result into a confident-looking approval.',
    flow:['Load records','Compute candidates','Inspect differences','Review exceptions','Export evidence'],
    decisions:[
      ['Surface the reason for a match','Pair the source record, candidate and difference. The new visual study emphasizes the evidence that must remain visible before a reviewer makes a decision.'],
      ['Leave uncertainty unresolved','The working matching algorithm detects equal optima and withholds those pairs. The interface should preserve that state instead of presenting a single candidate as definitive.'],
      ['Retain decisions as evidence','The application records review operations in a replayable journal with owner and note fields. Export and import support inspecting and restoring a workspace rather than relying on a transient screen.'],
      ['Expose the storage boundary','This is a browser-local workspace backed by a stateless Python computation path. It is not a shared, authenticated financial system; the case study describes that limit instead of implying multiuser operations.']
    ],
    implementation:'The Python core solves maximum-cardinality, minimum-weight-cost bipartite matching. An effective-date SQLite lookup prevents future-price lookahead; FIFO allocation quarantines a shortage without consuming inventory. Integer cents, one-to-one pairing, journal replay and stale-revision checks are implementation responsibilities reflected in the review experience.',
    outcome:'A runnable live workflow supports matching, exception review, historical prices, inventory and audit exports. Its source documents oracle-based matching checks and failure-path tests. No real bank integration, audited financial result or measured reviewer productivity is claimed.',
    next:'Compare the visual concept against the actual demo using seeded ambiguous and mismatched records. Ask a reviewer to explain why an exception remains unresolved and to recover a saved journal. Test comprehension before claiming faster reconciliation.',
    boundary:'The engine and workflows are implemented; the illustrated financial data is synthetic. The new interface study below is a concept, not a screenshot of the current application. This demo is not financial advice or a shared accounting system.',
    studies:['11-reconciliation'],
    live:'https://reconciliation-engine-pranav.vercel.app/', secondary:'https://github.com/pranavp2418/Oaks_October/tree/main/Oaks_October/2026-10-08-Reconciliation-Engine',secondaryLabel:'Inspect implementation & documented limits'
  }
};
