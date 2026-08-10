# Content document

Everything the site says, and the reason it says it. Written before any page is
laid out, because every layout decision below silently assumes the three lines
at the top.

The copy itself lives in the typed files beside this one; this document is the
editorial record — what was chosen, what was rejected, and what is still
missing. Where the two disagree, the typed files are the site and this document
is the bug.

---

## Positioning — three lines

1. **The buyer is the person who runs the game night.** Not a demographic, a
   use case, and the publisher's own words for it: *"Get it to the table as a
   warm up or wind down during your game nights, dealing people in/out as
   needed. Or enjoy it as the main event in 'best of 3 / 5' mode."*
2. **What it promises that a comparable box does not:** four genuinely
   different ways to win, all live at once, plus agents you can send into
   someone else's base — in a box that sets up in about a minute and finishes
   in about thirty. A reviewer put it better than marketing could: *"Easily a
   filler that could take over the whole night."*
3. **The objections that stop the purchase, in the order they arrive:** *"how
   is this different from the ten small-box games I already own?"* — answered by
   the four win conditions, which belong high on the page and not in a features
   list. *"Unknown publisher; will the components be cheap?"* — answered by
   named reviewers and by the fact that it funded, printed and shipped.
   *"Twenty-five for ninety cards?"* — answered by replayability and by
   portability as a use case, not by discounting.

---

## Plepic, in one sentence

> Plepic Games is a small independent publisher near Tallinn. We have published
> one game, and we took three years over it.

Source: **E8**. The register is deliberate: *small and independent*, never
*provisional*. The publisher introduction does not open with a request to buy
so that more games can exist, and there is no second game mentioned anywhere on
the site, because there is no second game.

## Lunar Base, in one sentence

> Lunar Base is a 2-6 player strategy card game where you compete to build the
> most powerful moon base. It's fast paced, medium-light weight, portable and
> easy to set up.

Verbatim official wording. Directly beneath it, the line that answers objection
one before the visitor has to scroll:

> Four ways to win, all live at once — and agents you can send into someone
> else's base to slow them down.

## Price and availability

`Lunar Base — EUR 25.00 / VAT included. Shipping calculated at checkout.`

That string never appears in a content file — the figure is **E13**, and E13's
own manifest entry records that it is delivered from configuration rather than
written down. Price in copy is a `{price}` or `{priceLine}` placeholder resolved
from the catalogue, and the homepage's *Buy for {price}* call to action resolves
the same way.

**Which of the two, and why it matters on one page.** `{priceLine}` carries the
figure *and* its qualifiers as one sentence, which is right where prose quotes
a price mid-paragraph and wrong in a display-sized slot.
`/legal/shipping`'s VAT section uses the bare `{price}` inside the operator's
own price presentation, because that section exists to say something more
careful than a flat "VAT included": no EU VAT is due on an export, so the
second qualified read (Minor 2) replaced the flat claim with *"where VAT is due
on your order, it is contained within that figure rather than added to it;
where it is not due, the price is the same"*. Interpolating `{priceLine}` above
that sentence would put the claim the sentence exists to qualify back on the
page, one line higher.

**The tax qualification is now the same everywhere — operator, 2026-08-10.**
The supplied wording is two lines, the first emphasised:

> **{price} · VAT included where applicable**
> Shipping calculated at checkout. Non-EU taxes and duties, if any, are not
> included.

It is content on `/legal/shipping` (a `callout`, which is the model shape for a
disclosure whose *formatting* is part of the operator's answer) and it is the
catalogue's `priceQualifiers`, which the purchase panel, the product hero and
the shipping FAQ all render. Both halves matter: a legal page saying *"where
applicable"* over a product page saying *"VAT included"* flatly would have moved
the contradiction Minor 2 removed up one level, to the more prominent page. The
euro figure stays `{price}`, bound to the catalogue, on both.

The same answer deleted the `taxNote` placeholder. It resolved to the bare
"VAT included" alone, no copy used it, and a live resolver for a string we have
decided is misleading in a legal context is a hazard rather than an asset.

Stock is unlimited and unmanaged, so availability is the phrase **In stock** and
never a count; a number would be a fabrication and a low-stock nudge would be a
lie. The purchase panel says so outright — *"we do not run a stock counter, so
nothing on this page will ever tell you to hurry"* — because refusing the
false-scarcity pattern in public is worth more than quietly not using it.

## Player count, playtime, age

| | |
|---|---|
| Players | 2–6 (E9) |
| Playing time | about 30 minutes (E10) |
| Setup | about a minute (E11) |
| Weight | medium-light (official wording) |
| Cards | 90 (components) |
| **Age** | **not stated** |

Sourcing, one figure at a time: players **E9**, playing time **E10**, setup
**E11**, weight and the pitch sentence *official wording*, card count
*components*. The first revision attributed the playtime and setup figures to
*official wording* when the manifest carried no such entries — true figures with
nothing behind them, which is exactly the failure this model exists to prevent.
The manifest now carries E9 to E11 and the copy points at them.

**No age recommendation exists.** The rulebook prints none and the manifest says
so explicitly. A plausible "10+" would be an invention on a specification table,
which is the worst possible place for one.

## What is in the box

> A total of 90 cards — 6 Stations, 26 Agents, 8 Influences and 50 Modules —
> plus 6 Credit Counters and the rulebook.

Exact, from the rulebook's component page.

## How it plays, in three steps

These are the rulebook's three steps of a turn, in the rulebook's order — not a
marketing summary of them. A visitor who buys on the strength of this section
opens the box and finds the same three steps on page 11.

1. **Play agent cards.** At the start of your turn you may play as many as you
   can pay for — to speed your own base up, or to get in someone else's way.
2. **Perform one main action from your base.** Build a module, draft, draw,
   discard, resell, flip a station, steal a module, steal credits. One action,
   chosen from what your base can actually do — which is why what you build
   changes what you can do next turn.
3. **Check for arriving shuttles.** When the supply runs dry, everyone earns a
   credit for each completed yellow orb in their base, and new cards come down
   from Earth.

## The four victory paths

Intro, verbatim official wording:

> In order to win the space race, play to your station's strengths. Win by
> housing the most colonists, researching scientific achievements, hoarding
> lunar credits, or gaining the most influence.

Thresholds, exact from the rulebook:

- Collect 20 lunar Credits
- House 10 colonists in your Base
- Complete 5 different scientific achievements in your Base
- Reveal 4 Influence cards from your hand at the end of your turn

Two honest notes ship with them, because both are true and both sell:

- The game ends the instant somebody meets a condition. **There is no final
  scoring round.**
- The fourth path only exists once the Influence cards are shuffled in, and the
  rulebook recommends leaving them out of the first few games. Saying so is
  better than a buyer discovering it.

## Shipping regions and costs

All countries. Dispatch within 3 business days; EU delivery 3–7 business days;
rest of world 7–21. Shipping is calculated at checkout from the delivery
address and shown before payment. Duties outside the EU are buyer-borne, stated
as one line, and never calculated.

The advertised price is the same figure for every visitor in every country and
is inclusive of tax; tax is computed from the confirmed delivery address and
contained within the price rather than added to it. Shipping is the only amount
added at checkout.

## Returns and support

14 days from delivery to withdraw, by any clear statement — email is enough. 14
more days to send it back. Buyer pays return postage. Refund of the goods plus
the standard outbound delivery charge within 14 days of being told, possibly
held until the goods or proof of postage arrive. Statutory rights for faulty or
damaged goods are separate and are not routed through the withdrawal process.

Support is one page: the rulebook, the questions that actually come up at a
table, the component list, the tutorial video, and a contact form. **The
rulebook is served from this site.** Copies of the box in people's houses print
the old game domain as the place to find the current rules, so that redirect has
to land on the support page forever — which the support copy says out loud, for
the visitor who arrives that way.

---

## Proof

### The strip carries three items

| | Item | Source | The objection it answers |
|---|---|---|---|
| 1 | **Funded by over 2,000 backers** — the campaign funded, the game was printed, and the backers got their copies | E5 | *Is this publisher real?* |
| 2 | **On the shelf at Brætspilscaféen** — around 50 copies sold, a making-of talk, and a tournament the café ran itself | E6 | *Will the components be cheap? Does anyone actually play it?* |
| 3 | **"Easily a filler that could take over the whole night."** — Hairy Game Lords | E2 | *How is this different from the small boxes I own?* |

Three items, three different jobs, in the order the objections arrive. A shop
that reorders, hosts a talk and runs a tournament is a stronger signal than any
adjective we could write about component quality, which is why item two is a
retail fact rather than a photograph of card stock.

### What was verified and still left out, and why

- **E7 — around 100 copies each through retail chains in Finland and Estonia.**
  True and useful, but it does the same job as item two with less of it: the
  chains cannot be named, so the visitor is asked to take an unnamed number on
  trust. Two retail figures in a three-item strip reads as padding. It runs in
  the /about timeline, where a run of dates earns it.
- **E1 — Rodney Smith's top-10 pick at AireCon.** The biggest name in the set,
  and the only item a visitor cannot check: the video has been removed and
  cannot be linked, so it stands on our word. A headline figure has to be
  checkable. It runs as a quotation on the game page, carrying its context
  inline — *"One of his top ten picks at AireCon"* — so that what a visitor
  reads is exactly what we can support. **It is a pick in a video, not an
  award.** It is never set in a laurel, a medal, a ribbon or a badge, and the
  content model has no value that would let it be.
- **E3 — Paul Grogan, Gaming Rules!** Warm, and inward-facing; the evidence
  manifest itself records it as weak proof to a visitor who has never heard of
  the game. Secondary position on the game page.
- **E4 — Tabletop Games Blog.** The best-written quotation we have and far too
  long for a strip. It leads the reviews section instead, where it has room.
- **Player count and playing time (E9–E11).** True, but they are our own
  specification, not third-party validation. In a proof strip beside a review
  they would borrow credibility they have not earned. They sit beside the box,
  in the specification list.
- **Our commercial commitments** — the dispatch window, the delivery estimates,
  the return terms. These are not so much rejected as *ineligible*: they are
  `CommercialTermId`s, a separate union from `SourceId`, and `ProofItem` accepts
  only the latter. Nobody verified them; we are undertaking to make them true.
  Putting one in the strip is a type error rather than a judgement call.

### Two figures the plan suggested that do not ship

The plan proposes a funding percentage and a funding duration as proof-strip
candidates, and instructs that every such figure is a **candidate pending
verification** against the evidence manifest. This is that verification, and
they fail it for two different reasons — worth stating precisely, because the
difference is the whole method:

- The **percentage** is named in the manifest's exclusion list — "the percentage
  of funding goal reached" — alongside the exact funding total and any backer
  count tighter than "over 2000". It is explicitly not publishable.
- The **duration** is not excluded by name. It is simply not in the manifest at
  all, and the governing rule is that nothing may appear on the site that is not
  in it. Absence is sufficient; it does not need a prohibition.

The manifest records only *"funded on Kickstarter, 2000+ backers"*. Neither
figure appears on the site, both are in the `NOT_PUBLISHABLE` list in
`evidence.ts`, and the build fails if either is ever typed into a content
file.

### Review quotations, verbatim and attributed

1. Tabletop Games Blog (E4) — the long one, on weight, pace and six players.
2. Hairy Game Lords (E2) — *"This game has a lot of depth to it, the box is
   tiny!"*
3. Rodney Smith, Watch It Played (E1) — with its context inline.
4. Paul Grogan, Gaming Rules! (E3) — on the clarity of the card design.
5. Hairy Game Lords (E2) — on replayability and production.

Every quotation carries a required `source` in the model. A quotation with no
manifest entry cannot be written down.

---

## The team story

2017. Six of us, near Tallinn, a setting we liked and no idea yet what the game
was. Three years to find out, and most of that work was subtraction: rules that
were clever but slowed the table down, features that read well on paper and were
no fun in play. Then Kickstarter, over two thousand backers, printed, boxed and
posted. Then shops.

The paragraph that carries the register:

> We are still six people. That is not a stage we are passing through on the way
> to something larger — being this small is exactly what let us throw away three
> years of work, a piece at a time, until the game was good.

**Six, not seven.** The plan's About checkbox says "the seven-friends origin".
The evidence manifest says six (E8), and the one genuine high-resolution team
photograph shows six people. Evidence governs; the site says six. If the
operator can evidence a seventh founder who left, that is a fact worth having
and the copy changes — but not before.

**No names or roles are written.** The manifest carries a photograph and a
headcount, and no roster. Names are an operator input, listed below.

## Newsletter proposition

> We send an email when there is genuinely something worth an email: a new game,
> a reprint, or somewhere new to play Lunar Base. No countdowns, no diaries, no
> monthly filler. One click to leave, and your address goes nowhere else.

Single opt-in, so the promise has to be modest enough that no confirmation step
is needed to justify it. There is no local subscriber database, no confirmation
token and no send scheduling — the provider holds the list.

---

## Campaign-state language: what was removed and what replaced it

The distinction is **tense, not subject**. A dated past-tense fact is proof;
anything implying the campaign is still running or the product is still
forthcoming goes. The old site was written entirely in the second voice.

| Removed | Why | Replaced by |
|---|---|---|
| "Game development news & milestones" *(hero sub-heading)* | The hero of a shop announced a project in progress | The publisher sentence, then the box, then a price |
| "Be the first! Sign up to get the latest game development news" | Pre-launch scarcity for a game that shipped | "Hear from us rarely" |
| "We'll occasionally send you updates about important game development milestones on our moon journey" | Campaign voice; "our moon journey" | "…a new game, a reprint, or somewhere new to play Lunar Base" |
| "And we'll let you know when the game is ready" | States outright that the product does not exist | Deleted. The game is in stock; the page sells it |
| "Lunar Base is a brief (20-30 minutes) base-building card game…" | Playtime contradicts the official figure, and "20-30" is unevidenced | Official wording: *"fast paced, medium-light weight, portable and easy to set up"*, about 30 minutes |
| "made by gamers, for gamers, from the heart; it is made of cardboard" | Jokey, provisional, says nothing a buyer can use | The publisher sentence |
| "Portable (Fits in the pocket)" | Overclaim: the box is 12 × 12 × 4 cm | "It goes in the bag you already carry" — with the measurement |
| "Simple but not predictable (Suitable for teenagers and those not very proficient in board games…)" | An age claim with no evidence behind it | Official wording: medium-light weight. No age is stated |
| "a starting-up board game publisher" / "startup board game publisher" *(retailer letter)* | The exact provisional register the rewrite exists to remove | "a small independent publisher near Tallinn" |
| "our upcoming expansion" *(retailer letter)* | Forward-looking product claim, unevidenced | Not used anywhere |
| The print-and-play download | Discontinued by the operator | Not offered; the phrase is in `NOT_PUBLISHABLE` |

These are not removals by vigilance. `CAMPAIGN_STATE_PHRASES` in `evidence.ts`
carries the offending phrases, and `content.test.ts` fails the build if any of
them reappears in a content file — including the word *startup*.

---

## Legal pages

Five pages, and a closed list the build checks:

| Route | Carries |
|---|---|
| `/legal/imprint` | merchant identity (name, registered address, register entry, VAT number, email, **telephone**), registered address |
| `/legal/terms` | what the buyer acknowledges at checkout, **out-of-court dispute resolution and how to reach it** |
| `/legal/shipping` | delivery terms, dispatch estimate, how price is presented with respect to VAT |
| `/legal/returns` | withdrawal process, its deadline, **the model withdrawal form**, who pays return postage, the return address, **the legal guarantee of conformity** |
| `/legal/privacy` | lawful basis for analytics, every third-party processor the site loads, **lawful bases for every other operation**, **third-country transfers** |

The bold entries came from the **second qualified read of 2026-08-09**, an
independent second opinion commissioned after the first reader had accepted the
pages. Its verdict was "not yet fit to launch, but close, and nothing questions
the architecture": one blocking finding, six major, seven minor. Its structural
finding was that `LEGAL_ELEMENTS` was *"promising more than it checks"* —
legally required disclosures had no element in the list and no home on any
page — so five elements were added and coverage moved from the page to the
section. See `docs/working/.../legal-review-second-opinion.md` in the operator
inventory for the full text and the exact replacement wording, which is used
verbatim wherever it was supplied.

**One finding is recorded rather than fixed.** Newsletter single opt-in
(Minor 6) is lawful — Estonian ECA § 103¹ requires prior consent and EU law
mandates double opt-in nowhere — and the residual exposure is evidential under
Article 7(1) GDPR. It is an accepted operator deviation.

**One thing a later reviewer will want to "fix" and must not.** There is no
link to the EU ODR platform. Regulation 524/2013 was repealed by Regulation
(EU) 2024/3228 and the platform was dismantled in July 2025; its absence is
correct, and `content.test.ts` now asserts it stays absent.

**One thing a later editor will want to tidy and must not.** The
dispute-resolution section carries a `Link` to the
`consumer-disputes-committee` external target as well as its prose. The id
lives here and the address is deployment configuration
(`EXTERNAL_URL_CONSUMER_DISPUTES_COMMITTEE`), because `content/` may hold no
host. Do not delete the link, and do not write an address into this package.

**It is an enhancement, not the disclosure — operator, with the qualified
reviewer's manual verification, 2026-08-10.** Naming the Consumer Disputes
Committee without an access method satisfies Article 6(1)(t) CRD, so the
section's prose discharges the obligation on its own. The first revision put
the target in the *legally required* gap set, and an unconfigured deployment
therefore marked `/legal/terms` incomplete over a link. That was right under
the assumption the access method was mandatory and is wrong now: **an optional
enhancement must not make a legally complete page announce itself as
incomplete.** An unconfigured URL is now simply not rendered, and nothing on
the page mentions it.

**The merchant identity set keeps the opposite treatment, unchanged**, and the
line between the two is *what the missing thing is*. A merchant detail — name,
registered address, register number, VAT number, contact address, telephone,
return address — **is** the disclosure: nothing else on the page conveys it, so
it renders as `[not configured: …]` and the page announces itself incomplete.
A destination is not: the prose beside it already carries the disclosure, so
its absence costs a reader convenience rather than information.

**The withdrawal period is 14 days.** The operator first said 30, was shown the
collision with the drafted page, and decided to leave it at the statutory 14.
It is not an oversight.

The last two are not EU distance-selling elements; they come from this plan's
own consent constraint. The first revision left them out of `LEGAL_ELEMENTS`
and gave the privacy page `covers: []`, so the closed-list test protected
nothing there and the processor list could have been deleted with the build
still green. Both are elements now, and the privacy page claims them.

`content.test.ts` asserts the five pages between them cover **every** element of
`LEGAL_ELEMENTS`, and that no element is claimed twice, so each obligation has
exactly one home and a missing one fails the build rather than surfacing at
launch.

Coverage is declared **per section** and the page's own `covers` must equal the
union of its sections'. That is what turns the closed list from a promise into
a check: deleting a section fails because the page claims an obligation nothing
carries, and deleting the claim as well fails because the site no longer covers
the list. There is no edit that removes a required disclosure and leaves the
suite green.

**This settles the legal-page URL structure that Task 1's redirect map left
unresolved.** Two entries in that map carry a null target pending this
decision:

- the legacy `/returns-policy/` path → `/legal/returns`
- the legacy `/privacy-policy/` path → `/legal/privacy`

Both sit in the half of that map which is recorded but not wired into the
storefront. The source hostnames stay in the operator manifest, which is where
the two null targets can now be filled in.

All five pages are `draft-pending-operator-input`. They stay drafts until the
merchant identity arrives, and a test refuses to let a page be marked approved
while its prose still contains an unresolved placeholder.

---

## Open inputs — this content is not finished without them

| Input | Blocks | Why it is not invented |
|---|---|---|
| Registered legal name, registered address, company number, VAT number | all five legal pages, and the product page's GPSR block | **Supplied by the operator 2026-08-09.** Still configuration, not content: they reach a deployment as `MERCHANT_*` environment. Trader identity is a legal requirement; a placeholder is honest, a guess is a misrepresentation |
| Customer contact email address | legal pages, support, contact form, GPSR block | **Supplied 2026-08-09.** Account addresses come from configuration, never content |
| Telephone number | `/legal/imprint`, GPSR block | **Supplied 2026-08-09.** Mandatory since Directive (EU) 2019/2161 removed the "where available" qualifier from Article 6(1)(c) CRD. Second read, M1 |
| Return address | `/legal/returns` | **Supplied 2026-08-09** — confirmed to be the registered address |
| How long contact mail is kept | `/legal/privacy` | **Not supplied, and written as two years after the last message in the conversation.** The second read (Minor 5) required contact-mail retention to have a period at all but supplied no figure, so this one is the drafter's and the operator should confirm or change it |
| When the seven-year order-record clock starts | `/legal/privacy` | **The figure is the reader's; the starting point is not.** The second read supplied "seven years" and its authority, Accounting Act § 12. The page says *"seven years from the end of the financial year the order falls in"*, and that phrase is the drafter's reading of how the period runs, not something the reader wrote. Recorded here beside the two-year figure so both agent-chosen specifics are visible; the text is left as drafted for the operator and the qualified reader to confirm or correct |
| The web address of the Consumer Disputes Committee | `/legal/terms` | **Not supplied.** Article 6(1)(t) CRD wants the out-of-court body **and the method of reaching it**, and `content/` may carry no host, so it arrives as `EXTERNAL_URL_CONSUMER_DISPUTES_COMMITTEE`. Until a deployment sets it the page names the gap and shows the incompleteness notice — the same treatment as an unset registration number, and for the same reason |
| An Estonian-language version of the legal set | all five legal pages | **Recorded as a deviation, not acted on here.** Language Act (keeleseadus) § 16 and the Consumer Protection Act entitle a consumer in Estonia to consumer information in Estonian, and an Estonian-registered shop shipping to Estonia with English-only legal pages is exposed with the TTJA. The second read required this to be *"either satisfied or recorded as an accepted deviation"*; this is the record. Translation is a separate scheduled unit (`t2-estonian-locale`) with its own content-model work and its own operator-decided flow, and this unit is English-only by instruction — so nothing here anticipates a locale dimension. The exposure stands until that unit lands, and it is the operator's to accept or close |
| Who pays return postage — confirm buyer-pays | `/legal/returns` | Written as buyer-pays, which is the statutory default when the trader has said so; the operator should confirm rather than inherit |
| Who bears duties outside the EU — confirm | `/legal/shipping` | Written as buyer-borne per the frozen model, and recorded as a commitment rather than as evidence |
| Team names and roles | `/about` | Not in the evidence manifest; the plan wants names in HTML and they must come from the operator |
| Whether the origin was six or seven people | `/about` | Evidence says six. Contradicts the plan's phrasing; evidence wins until it does not |
| The Fontspring invoice, for the monthly pageview cap | the webfont licence | Recorded in `design/README.md` as unresolved, not as satisfied |

None of these blocks the next unit: the pages are laid out against the
placeholders, and the placeholders resolve at render time from configuration.
They block **publication**, which is what `reviewStatus` records — and, since
the second read, the render itself says so: an unconfigured legally required
value appears as `[not configured: …]` with a notice on the page, rather than
being dropped the way optional prose is.

---

## Product safety, GPSR Article 19

Regulation (EU) 2023/988 Article 19 obliges an online offer to display the
manufacturer's identity and contact plus any safety information, so the product
page carries a manufacturer block and the toy-safety test results
(`lunar-base.ts`'s `productSafety`).

**The merchant is the manufacturer, and the printer is not.** Directive
2009/48/EC Article 2(3) and GPSR Article 3(8) make the manufacturer whoever has
the product made and markets it under their own name. Longpack is named as the
contract producer and explicitly not as the manufacturer; naming the wrong
entity is itself a compliance defect. The operator decided this and no agent
may re-decide it.

The results are Intertek's, report SHAH01338706 of 14 May 2021 — `E16` in
`evidence.ts`, which also carries the document's checksum and the reasons the
2021 results describe current stock. They are presented as test results and
never as an accolade: a test certificate styled as a badge is a fabricated
award, which the plan forbids outright. The age marking itself is rendered once,
by `FeatureSpecStrip` from the catalogue, and is not repeated in the block.
