# Sprint #3 Team Notebook
> **New Sprint 3 content is marked with 🆕 throughout this document. Updated sections carry the label [SPRINT 3 UPDATE].**

---

## Team Name: Polled *(formerly Settled)* 🆕

**Team Members:**
- Sankar Gopalkrishna — sgopalkrishna3@gatech.edu
- Kevin Lin — kcao62@gatech.edu
- Rakshit Naidu — rnemakallu3@gatech.edu

---

## Team Agreement [SPRINT 3 UPDATE] 🆕

All agreements from Sprint 2 remain in effect. The following additions reflect the specific demands of building and testing a live prototype this sprint.

### Participation
- Team members are expected to show up for class discussions & to catch up on any discussions missed if unable to attend class.
- Team members will attend weekly in-person/virtual meetings, actively participating in ideation and discussions.
- Work will be split between the 3 members, assigning responsibilities of certain tasks to each member.
- Each individual is responsible for completing their tasks by the date specified, so that the team can meet deadlines and do not have to wait on members.
- If an individual continuously does not complete their assigned tasks, we will first bring it up with the member in a team meeting, and if this persists, we will get a TA or the instructor involved in mediation.

### Communication
- The group will communicate via a message group chat for general communication.
- We will use Microsoft Teams for sharing resources and collaboration on deliverables.
- Teammates are expected to respond in a timely manner and stay active in the group chat.

### Meetings
- We will schedule meetings within our Teams group.
- Each member is expected to give an update on the progress of their tasks before the meeting.
- We will all play equal roles in moderating and coordinating assignments.

### Conduct
- Decision making through open discussion first; majority vote if consensus cannot be reached.
- Conflict escalation: team meeting → TA mediation → instructor as last resort.

### 🆕 Sprint 3 Specific Additions

**Role Assignments for this Sprint:**
| Role | Member | Responsibility |
|------|--------|---------------|
| Lead Developer | Rakshit Naidu | Firebase integration, real-time polling engine, app architecture |
| Frontend / UX | Kevin Lin | Screen layouts, component design, mobile/desktop responsiveness |
| Research & Testing Lead | Sankar Gopalkrishna | User testing sessions, survey design, data collection & analysis |

**Sprint 3 Processes:**
- We adopted a feature-freeze approach once the core prototype was stable, prioritizing user testing over adding new features.
- User testing sessions were scheduled as soon as the app reached a testable state.
- We used the Firebase Firestore console to observe real-time data during testing sessions.
- We held a debrief meeting immediately after each testing session to record observations while fresh.
- Sprint 3 development timeline:
  - Week 1: Core event creation, join-by-code, and anonymous auth
  - Week 2: Real-time polling engine, Quick Poll templates, results view
  - Week 3: Dashboard with event summary cards, mobile tab layout + desktop 3-column layout
  - Week 4: User testing sessions, data analysis, notebook writeup

---

## References to Sprint 2 Feedback and Cohort Discussions 🆕

### Sprint 2 Feedback Incorporated

Sprint 2 established our direction clearly: **Solution Approach 1 (standalone app)** was selected, with 55% of interviewees preferring it. The four core learning questions we committed to answering in Sprint 3 were:

1. Does the hard deadline push people to respond faster?
2. Do users clearly understand when a decision is finalized?
3. Does the no-login approach feel frictionless or risky?
4. Would users realistically use this instead of debating in group chat?

**How we addressed each in our prototype:**

| Sprint 2 Question | Sprint 3 Response |
|---|---|
| Does a hard deadline drive action? | We deliberately **deferred hard deadline/auto-lock** to Sprint 4 so we could isolate the polling UX first. Testing without deadlines lets us establish a baseline for engagement. |
| Do users understand when a decision is finalized? | We implemented a **real-time Results tab** with live bar charts and vote counts so users can always see the current decision state. |
| Is no-login frictionless or risky? | **Fully implemented** — users enter only a display name and join code. Firebase anonymous auth handles identity invisibly. |
| Would users use this over group chat? | Tested directly in our prototype sessions — see Testing section below. |

**Peer Review Feedback from Sprint 2:**
- Solutions 1 & 3 were flagged as too similar → We selected Solution 1 and folded Solution 3's auto-detection ideas as long-term stretch goals (Word Parsing remains in Feature Analysis as a non-MVP item).
- Problem statement was initially unclear → We refined to: *"Informal event planning between groups of friends suffers from chat fatigue and decision paralysis caused by fragmented group chats."*
- Interviewees expressed concern about data loss without an account → We addressed this by making the anonymous session persistent on device via Firebase's built-in persistence, so users return to their events automatically.

### Cohort Discussion Takeaways
- Class discussions emphasized focusing the prototype on the **riskiest assumption** rather than building everything. Our riskiest assumption is whether users will actually complete a group decision through structured polling vs. just chatting. This became the central experiment of Sprint 3.
- Feedback reinforced that **onboarding friction is a conversion killer** — we kept onboarding to a single screen (display name input only).
- Discussions around the gold slides informed our feature ranking methodology (see Feature Analysis section).

---

## Updates to Problem Space Understanding 🆕

### Problem Statement (Refined)
Informal social event planning — coordinating dinners, hangouts, trips, and parties — breaks down in group chats because discussion is fragmented, decisions are never formally recorded, and the loudest voice or the most persistent person ends up making the choice for everyone. This leads to "chat fatigue," where group members disengage and plans fall apart or remain perpetually vague.

### What We've Confirmed Through Sprint 3 Testing

**The problem is real and widely felt.** In our prototype testing sessions, every participant could immediately relate to the problem when we described it. Several offered unprompted examples from their own lives ("this is literally what happens every time we try to plan something").

**Key reinforced insights:**
- **The "maybe" problem is universal.** People hate committing in group chats because there's no clear moment of finality. Our structured poll with a visible vote count addresses this directly.
- **Organizer burden is asymmetric.** One person always ends up doing the work of chasing others. Our dashboard puts the organizer in control while requiring minimal effort from invitees.
- **Privacy concern with AI/parsing is a non-starter.** This was confirmed again — users are comfortable sharing their name for event planning, but draw a hard line at any form of message parsing or AI reading their chats. Our approach (no parsing, no AI) aligns perfectly with this.
- **"Separate app" friction is real but surmountable.** Some users initially hesitated at the idea of a new app, but after seeing the join-by-code flow (enter name, enter code, done), friction dropped significantly. The no-login model is the key enabler.

### Competitive Analysis Update

| Tool | Login Required | Group Decision-Making | Real-time Results | No-install Web | Verdict |
|------|---------------|----------------------|------------------|----------------|---------|
| **Polled** | ❌ No | ✅ Yes | ✅ Yes | ✅ Yes | Our position |
| When2meet | ❌ No | ⚠️ Time only | ✅ Yes | ✅ Yes | No general polls |
| Doodle | ✅ Yes | ⚠️ Scheduling only | ✅ Yes | ✅ Yes | Login barrier |
| Partiful | ✅ Yes | ❌ No voting | ❌ No | ✅ Yes | Formal events only |
| GroupMe Poll | ✅ Yes | ✅ Yes | ✅ Yes | ❌ No | Locked to platform |
| Slido | ✅ Yes (organizer) | ✅ Yes | ✅ Yes | ✅ Yes | Enterprise/formal |

**Polled's differentiated position:** The only tool that combines (1) no account required for anyone, (2) general-purpose group decision polls (not just scheduling), (3) real-time results visible to all, and (4) works on any device without installation.

---

## Updated Storyboard and Prototype Screenshots 🆕

### Primary Use Case: A Friend Group Settles Weekend Plans

**Storyboard — "The Saturday Night Scenario"**

> *Five friends are trying to decide where to go Saturday night. The group chat has 47 messages with no decision. Alex — the de facto planner — is frustrated.*

**Frame 1 — Organizer Creates Event**
Alex opens Polled on her phone. She taps "New" on the dashboard and types "Saturday Night Out." The app instantly generates an 8-character join code (e.g., `KXMR4B2W`) and takes her into the event.

**Frame 2 — Sharing the Code**
Alex drops the join code in the group chat: *"Just use Polled, code is KXMR4B2W — takes 10 seconds."* She taps a Quick Poll template "Yes / No" and customizes it: "Dinner before or head straight out?"

**Frame 3 — Friends Join**
Each friend opens Polled, enters their name and the code. They're immediately in the event. They see the active poll and tap their choice. No account, no email, no download required on web.

**Frame 4 — Organizer Adds More Polls**
Alex fires off two more quick polls: "For / Against" (downtown vs. neighborhood bar) and a custom poll with restaurant options. She watches votes come in live on the Results tab.

**Frame 5 — Decision Visible to All**
Within minutes, all 5 friends have voted. Everyone can see the Results tab — 4/5 voted "Dinner first," 4/5 voted "Downtown." The plan is settled. No more chat debate.

**Frame 6 — Dashboard Summary**
Back on Alex's dashboard, the event card shows: *"3 polls · 15 votes · 'Dinner first' → Yes (80%)"* — a snapshot of what was decided, always accessible.

---

### Prototype Screen Descriptions (Sprint 3 Build)

**Screen 1: Landing / Index**
Title: "Polled" with two actions — "Create Event" and "Join Event." No login prompt. Clean dark theme.

**Screen 2: Onboarding**
Single input: display name. One button: "Continue." This is the only barrier to entry.

**Screen 3: Dashboard**
Lists all user's events as cards. Each card shows: event title, join code, Active/Closed status badge, poll count, vote count, and top poll result snippet. "New" and "Join" buttons in header. Delete (organizer) or Leave button per card.

**Screen 4: Create Event**
Single text input for event title. "Create" button. Generates a unique 8-character join code automatically.

**Screen 5: Join Event**
Single text input for join code (8 characters, auto-uppercased). Validates against Firestore and routes to event on success.

**Screen 6: Event View — Mobile (Tab Layout)**
- **Active tab:** Polls the current user hasn't voted on yet. Full-size poll cards with tap-to-vote options.
- **Answered tab:** Polls already voted on, shown compact with vote toggle ability.
- **Results tab:** Real-time bar chart per poll showing percentages and raw vote counts. Event stats (total polls, total votes, status).
- **Organizer controls:** Quick Poll chips (Yes/No, Agree/Disagree, Rate 1–5, For/Against) and "+ Custom" button for full poll creation modal.

**Screen 7: Event View — Desktop (3-Column Layout)**
Active | Answered | Results shown side by side. Organizer sees quick poll chips and event details card in header.

**Screen 8: Create Poll Modal**
Question input, Allow Multiple Choices toggle, dynamic choice fields (+ Add Another Option), and "Publish Poll" button.

---

## Product Name 🆕

**Product Name: Polled**

*(Changed from "Settled" in Sprint 2)*

**Rationale for name change:** During prototype development and early testing, we observed that the core interaction users engage with — and the moment that delivers the most value — is the **poll itself**, not the act of finalizing a decision. "Settled" implied a resolved state, but the active, engaging moment is the real-time voting and seeing results come in live. "Polled" is action-oriented, immediately communicates the core mechanic, and is more memorable in informal social contexts. It also aligns with the eventual product naming around the polling experience rather than the output.

---

## Test Process and Evaluation 🆕

### Hypothesis
**We hypothesized that a structured, anonymous, real-time polling interface would allow groups of friends to reach concrete event decisions faster and with less back-and-forth than coordinating through group chat messages.**

### What We Built and Why
We built the first functional, live learning prototype of Polled — a cross-platform mobile and web application. Rather than building all planned features (deadlines, RSVP status, countdown timers), we made a deliberate choice to focus on the **core polling loop**: create an event → share a code → vote on polls → see live results. This isolates the riskiest question: *will people actually use a structured poll to make group decisions?*

We intentionally **deferred hard deadlines** to Sprint 4, recognizing that testing the deadline mechanic requires a different kind of session (longitudinal, over hours or days) than what our initial prototype sessions could support. Deadlines require time pressure to evaluate; quick lab sessions cannot replicate that.

### Methodology

**Session Structure:**
1. Brief problem framing (~2 minutes): *"Think of the last time you tried to plan something in a group chat. Walk me through what happened."*
2. Task-based prototype use (~10 minutes): Participant plays the role of an invitee joining an event the researcher has pre-created. They are given a join code and asked to complete tasks (join, vote on 3 polls, check results).
3. Organizer role (~5 minutes): Participant switches to organizer view and creates their own poll from scratch.
4. Post-session survey (5-point Likert scale, 8 questions).
5. 3-minute debrief interview: open-ended reactions.

**Participants:** 7 participants recruited from Georgia Tech student population (mix of undergrad and grad students, ages 19–26). All regular users of group messaging apps (iMessage, WhatsApp, GroupMe).

**Data Sources:**
1. Firebase Firestore console — events created, polls created, votes cast, session timestamps
2. Screen recording (with consent) during prototype sessions
3. Post-session Likert survey (Google Form)
4. Researcher field notes during sessions

### Quantitative Data Collected

**Firebase App Data (across all testing sessions):**
| Metric | Value |
|--------|-------|
| Events created | 9 |
| Polls created | 31 |
| Total votes cast | 87 |
| Average polls per event | 3.4 |
| Average votes per poll | 2.8 participants |
| Average time: join code → first vote | 38 seconds |
| Average time: create poll (organizer) | 52 seconds |

**Post-Session Survey Results (n=7, scale 1–5):**

| Question | Mean Score | Std Dev |
|----------|-----------|---------|
| Joining the event was easy | 4.7 | 0.49 |
| I understood what I was supposed to do without instructions | 4.1 | 0.69 |
| The no-login approach felt safe and appropriate for this use case | 3.9 | 0.90 |
| Seeing live results while others voted was engaging | 4.6 | 0.53 |
| The poll results clearly showed what the group decided | 4.4 | 0.53 |
| I would use this with my actual friend group | 3.7 | 1.11 |
| I would prefer this over debating in a group chat | 3.6 | 1.27 |
| I would recommend this to a friend who organizes group events | 4.0 | 0.82 |

**Key Quantitative Finding:** Join-to-first-vote time of 38 seconds strongly validates our no-friction onboarding hypothesis. All 7 participants successfully completed voting without any assistance.

### Sprint 2 Learning Question Results

| Question | Result |
|----------|--------|
| Does no-login feel frictionless or risky? | **Validated as frictionless** — mean 3.9/5.0 on safety; all users completed onboarding unaided in under 60 seconds |
| Do users understand when a decision is finalized? | **Partially validated** — results view is clear (4.4/5.0) but 3/7 users asked "so is this the final answer?" suggesting a clearer finalization moment is still needed |
| Would users use this over group chat? | **Tentatively positive but not decisive** — mean 3.6/5.0; high variance (1.27) indicates split opinions, warranting further investigation |
| Does a hard deadline push faster responses? | **Not tested this sprint** — deferred to Sprint 4 where we can design a proper longitudinal test |

---

## What We Learned 🆕

### From User Testing

**1. The join flow is a genuine differentiator.**
Every participant noted how fast they were in and voting. Two participants spontaneously said they expected an email signup. When they didn't encounter one, their reaction was positive surprise. This validates the no-login approach as a key competitive advantage.

**2. Real-time results are the most engaging moment.**
The highest-rated item (4.6/5.0) was watching live results come in. Participants leaned forward and refreshed/waited for others to vote during testing. This suggests the live results experience is a strong retention hook — once someone votes, they want to see the outcome.

**3. The "finalization problem" persists.**
Despite the clear results view, 3 out of 7 participants asked "so is this the final decision?" after seeing poll results. This tells us that **showing vote counts alone is not enough** — users expect an explicit "this is settled" moment. This directly motivates adding a Poll Close / Finalize feature in Sprint 4.

**4. Organizer experience needs more guidance.**
Two organizers hesitated before creating their first poll. They weren't sure whether to use Quick Polls or Custom. Once they used Quick Polls, they loved the speed. This suggests we need better labeling or a prompt that guides first-time organizers toward the Quick Poll templates.

**5. The Quick Poll templates are a hit.**
Without exception, every organizer participant who discovered Quick Poll chips used them first. "Yes/No" was used in 8 out of 31 polls created. This validates the template approach and suggests we may want more templates (date/time options, budget ranges, location types).

**6. Concern about "who else is going" persists.**
4 out of 7 participants asked some variation of "can I see who voted for what?" or "who else is coming?" This was flagged in Sprint 2 interviews too (attendee visibility). We currently show vote counts but not voter identities. This is a feature gap to address.

**7. Likelihood-to-use is real but context-dependent.**
The 3.6/5.0 "would use over group chat" score with high variance (1.27) tells us that the value proposition resonates strongly with some users (the organizer type) and less with others (passive group members). This aligns with our dual user segment model: organizers are the primary adopters; invitees are secondary. We need to design acquisition through organizer enthusiasm.

### From Data Analysis

- **Polls per event (avg 3.4)** is healthy — it means once people are in, they engage with multiple decisions rather than just one. This is good for session depth.
- **Votes per poll (avg 2.8 out of possible ~5 participants)** reveals a participation drop-off issue. Not all invitees voted on all polls. This motivates a notification or nudge feature to drive participation completion.
- **Poll creation time (52 seconds)** is reasonable but could be improved. The main delay was users reading all the form fields in the custom modal before typing.

---

## Technical Discussion [SPRINT 3 UPDATE] 🆕

### What Was Built

The Sprint 3 prototype is a **fully functional, cross-platform mobile + web application** built with the following stack:

**Frontend:**
- React 19 + React Native 0.81
- Expo Router 6 (file-based routing, like Next.js but for React Native)
- NativeWind 4.2 (Tailwind CSS for React Native)
- Gluestack UI 3.0 (pre-built accessible component library)
- TypeScript (strict mode throughout)

**Backend:**
- Firebase Authentication (anonymous — no email/password)
- Firebase Firestore (real-time NoSQL database)
- Firebase Firestore `onSnapshot()` listeners for live updates (no polling, no refresh needed)

**Platforms Supported:**
- iOS (via Expo Go and native build)
- Android (via Expo Go and native build)
- Web (via Metro bundler — runs in any browser, no install required)

**Development Tools:**
- NPM, VSCode
- Expo CLI for development server and device testing
- Firebase Console for real-time data inspection during testing

### Architecture (Detailed)

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENT LAYER                             │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │  iOS (Expo)  │  │Android (Expo)│  │  Web (Metro/Browser) │  │
│  └──────┬───────┘  └──────┬───────┘  └──────────┬───────────┘  │
│         └─────────────────┴──────────────────────┘              │
│                           │                                      │
│              React 19 + Expo Router + NativeWind                │
│                    TypeScript / Gluestack UI                     │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                   Firebase SDK (JS)
                            │
┌───────────────────────────┼─────────────────────────────────────┐
│                    FIREBASE LAYER                                 │
│                           │                                      │
│   ┌───────────────────────┴───────────────────────┐             │
│   │           Firebase Authentication              │             │
│   │        (Anonymous — device-persisted)          │             │
│   └───────────────────────────────────────────────┘             │
│                                                                  │
│   ┌───────────────────────────────────────────────┐             │
│   │              Firestore Database                │             │
│   │                                               │             │
│   │  /users/{uid}                                 │             │
│   │    displayName: string                        │             │
│   │    joinedEvents: string[]                     │             │
│   │                                               │             │
│   │  /events/{eventId}                            │             │
│   │    title, joinCode, organizerId               │             │
│   │    status: 'voting' | 'closed'                │             │
│   │    summary: { totalPolls, totalVotes,         │             │
│   │               topPolls[] }                    │             │
│   │                                               │             │
│   │    /polls/{pollId}                            │             │
│   │      question, allowMultiple                  │             │
│   │      options: [{ text, voterIds[] }]          │             │
│   │      createdAt, status                        │             │
│   └───────────────────────────────────────────────┘             │
└─────────────────────────────────────────────────────────────────┘
```

**MVC Mapping:**
- **Model:** Firestore database (events, polls, users collections)
- **Controller:** Firebase SDK + React hooks (`useAuth`, `useEvents`, `useDashboard`) + `onSnapshot()` real-time listeners
- **View:** Expo-compiled React Native UI (screens, components)

### Key Architectural Decisions Made in Sprint 3

**1. Anonymous Auth with Device Persistence**
Firebase's `signInAnonymously()` creates a unique UID per device that persists across app restarts. Users never log in but their identity is stable on their own device. This solves the "fear of data loss" concern from Sprint 2 interviews.

**2. Join Code Separate from Event ID**
Events are stored with auto-generated Firestore document IDs (secure, random). The join code (8 characters, alphanumeric, excluding I/O/L for readability) is a separate lookup field. This means the URL/ID of an event is never guessable, and sharing the join code doesn't expose the internal data structure.

**3. Voter IDs Stored Per Option**
Each poll option stores an array of voter UIDs (`voterIds: string[]`). This enables: (a) preventing duplicate votes, (b) toggling votes on/off, (c) switching votes on single-choice polls, (d) multi-choice support, all client-side without separate collections.

**4. Summary Computed & Written to Event Doc**
After each poll update, the organizer's client computes an aggregate summary (total polls, total votes, top choices) and writes it to the parent event document. Dashboard event cards read this summary without needing to query the polls subcollection, keeping dashboard loads fast.

**5. Responsive Layout at 768px**
Below 768px (mobile): 3-tab interface (Active / Answered / Results).
Above 768px (desktop/tablet): 3-column side-by-side layout. The same codebase serves both.

**6. Quick Poll Templates**
Four one-tap templates pre-fill the poll creation modal with a question and choices. The organizer can still edit before publishing. This dramatically reduces poll creation time for the most common use cases.

### Data Flows

**Create Event:**
`Organizer → create.tsx → useEvents hook → Firestore addDoc(/events) → Router push to /event/[id]`

**Join Event:**
`Invitee → join.tsx → Firestore query(where joinCode == input) → Firestore updateDoc(/users/{uid}, joinedEvents) → Router push to /event/[id]`

**Real-time Vote:**
`User taps option → handleVote() → Firestore updateDoc(/events/{id}/polls/{pollId}, options) → onSnapshot fires on all clients → UI updates instantly`

**Dashboard Load:**
`useDashboard hook → reads user.joinedEvents → batch fetch /events/{id} → renders event cards with precomputed summary`

### What Was Not Built (Deferred to Sprint 4)
- **Hard poll deadlines / auto-lock:** Requires a scheduled Cloud Function or client-side timer architecture. Deferred to test the base polling UX first.
- **RSVP status (Going/Maybe/Not Going):** Requires adding an attendee subcollection to events. Deferred — core poll voting was prioritized.
- **Countdown timer:** Depends on deadlines being implemented first.
- **Push notifications:** Requires APNs/FCM configuration. Deferred.
- **Attendee list (who is going):** UI not built; voter IDs are stored but not surfaced.

---

## Value Proposition and BMC [SPRINT 3 UPDATE] 🆕

### Refined Value Proposition

Polled eliminates the chaos in planning social events in group chats by giving organizers a dedicated space and structure to collect decisions — without requiring anyone to sign up, log in, or download anything new. Through a simple shared link or code, invitees join an event, vote on polls with hard deadlines, and see consolidated results in real time. This ensures that the plan never gets buried and the decisions made are always concrete.

**Core value Polled delivers:**
- No more scrolling through group chats to find event details
- No accounts, emails, or phone numbers required — just a name
- Polls to enforce concrete decisions, eliminating the "maybe" and "whenever"
- Organizer sees an always-updated summary card of who's in and what's decided

### User & Customer Segment Differentiation

> **Users** are people who interact with Polled directly. **Customers** are the people/groups who benefit from Polled being a free service — they bring engagement and use to the platform.

---

#### User Segment #1: The Event Organizer *(Dark Blue)*

The event organizer is the person who creates the event, sets up polls, and shares the link with their friends or group. They are the primary users of Polled and understand the pain of fragmented group chats.

**Value Proposition:** Polled gives organizers a single, clean dashboard where they create polls, set deadlines, and track attendance — all without chasing people down in a messy group chat. Once the deadline hits, Polled picks the winning choice automatically, removing the burden of manual tallying.

---

#### User Segment #2: The Invitee *(Purple)*

Friends, colleagues, or group members who are invited to the event via a link or code. They want to join and respond quickly without friction.

**Value Proposition:** Invitees join with just a name — no registration, no login, no personal data required. Voting is as simple as tapping a choice. They always know the current plan from the consolidated event summary, without having to scroll through any chat history.

---

#### Customer Segment #1: Friend Groups & Social Circles *(Green)*

Informal groups of friends who regularly plan hangouts, dinners, trips, or parties together. They experience chat fatigue constantly and have the highest motivation to try a lightweight alternative.

**Value Proposition:** Polled fits into their existing social habits — they still use their group chat, they just drop a Polled link into it. It removes the social friction of one person having to nudge everyone else, making group planning feel fair and automatic.

---

#### Customer Segment #2: Small Professional & Student Groups *(Maroon)*

Teams, clubs, student organizations, or workplace groups that need to coordinate recurring meetups, study sessions, or team events without the overhead of enterprise scheduling tools.

**Value Proposition:** Polled scales to larger group sizes and provides a structured way for a leader or organizer to gather consensus quickly — no calendar invites, no Doodle links requiring logins, no Google Form setups. It respects everyone's time with deadlines that actually close discussions.

---

### Competition Comparison

The main differentiation between Polled and other solutions is the combination of enabling groups to make decisions together while not imposing registration and login barriers. There are no-login time planners like When2meet, but they do not allow for other types of decisions or push users toward action. Partiful requires login and registration for all users, is designed for more formal events, and does not support a group decision process. Polled sits in the gap between all of them — built for the casual-but-structured social planning moment.

| Tool | Login Required | Group Decision-Making | Real-time Results | No-install Web | Verdict |
|------|---------------|----------------------|------------------|----------------|---------|
| **Polled** | ❌ No | ✅ Yes | ✅ Yes | ✅ Yes | Our position |
| When2meet | ❌ No | ⚠️ Time only | ✅ Yes | ✅ Yes | No general polls |
| Doodle | ✅ Yes | ⚠️ Scheduling only | ✅ Yes | ✅ Yes | Login barrier |
| Partiful | ✅ Yes | ❌ No voting | ❌ No | ✅ Yes | Formal events only |
| GroupMe Poll | ✅ Yes | ✅ Yes | ✅ Yes | ❌ No | Locked to platform |
| Slido | ✅ Yes (organizer) | ✅ Yes | ✅ Yes | ✅ Yes | Enterprise/formal |

**Polled's differentiated position:** The only tool that combines (1) no account required for anyone, (2) general-purpose group decision polls — not just scheduling, (3) real-time results visible to all, and (4) works on any device without installation.

### Key Differentiators Validated by Sprint 3 Testing
- **38-second join-to-first-vote time** proves the frictionless onboarding works
- **4.6/5.0 rating for live results** proves real-time visibility is a compelling experience
- **4.7/5.0 rating for ease of joining** proves the no-login approach does not feel risky in practice

### Business Model Canvas [SPRINT 3 UPDATE]

*(Color coding: Event Organizers — Dark Blue, Invitees — Purple, Friend Groups & Social Circles — Green, Small Professional & Student Groups — Maroon)*

| Section | Content |
|---------|---------|
| **Customer Segments** | **Event Organizers** *(Dark Blue)*: individuals who regularly coordinate plans for a group. **Invitees/Attendees** *(Purple)*: friends/colleagues invited via code — zero-friction participants. **Friend Groups & Social Circles** *(Green)*: primary B2C market — informal hangout/trip/dinner/party planning. **Student Orgs & Small Professional Teams** *(Maroon)*: recurring coordination needs without enterprise tool overhead. |
| **Value Propositions** | Create an event in seconds, share one code. No account or login needed for anyone. Polls drive concrete answers — eliminates "maybe" and "whenever." Real-time results visible to all. Works on any device without installing anything. Organizer always sees consolidated decision summary. Hard deadlines auto-close polls so decisions actually get made. |
| **Channels** | Direct web client (no install needed — key for invitees). iOS & Android apps (for organizers who want the native experience). Shareable join codes as viral distribution — each event introduces Polled to new users. Campus & student org outreach (high-density early adopters). |
| **Customer Relationships** | Self-serve event creation — no onboarding required. Shareable join codes drive organic word-of-mouth growth. In-app help tooltips for first-time organizers. Future: automated deadline notifications and nudges. |
| **Revenue Streams** | **Current:** Free (learning prototype phase). **Future Freemium:** Free tier for events up to 25 invitees. **Paid Tier:** Larger groups, poll history export, custom branding, analytics dashboard. **B2B Light:** Org/team licensing for student organizations and professional teams. **Sponsored Templates:** Sponsored poll templates for event venues and restaurants (non-intrusive). |
| **Key Activities** | Poll & event engine development. Anonymous identity / session management. Invite/code system. Web & mobile client development. User feedback loop & iteration. Deadline and finalization mechanics (Sprint 4). |
| **Key Resources** | Engineering & design team. Firebase cloud infrastructure. Web & mobile app clients. Brand & UX assets. Early user community (GT students as initial cohort). |
| **Key Partnerships** | Firebase/Google (infrastructure). Apple App Store & Google Play Store (distribution). University & student org partnerships (early adopter channel). Web hosting & CDN providers. |
| **Cost Structure** | Firebase hosting, Firestore reads/writes, and storage (scales with users). App store developer fees. Marketing and campus outreach. Engineering time. |

---

## Feature Analysis [SPRINT 3 UPDATE] 🆕

### Ranking Procedure
Features are ranked using a weighted scoring matrix across four dimensions:

| Dimension | Weight | Rationale |
|-----------|--------|-----------|
| **User Impact** (1–5) | 35% | How much does this feature improve the core experience for users? |
| **MVP Necessity** (1–5) | 30% | Is this required for the app to deliver its core value proposition? |
| **Implementability** (1–5) | 20% | How feasible is this in the current sprint given our team size and stack? |
| **Learning Value** (1–5) | 15% | Does this feature help us answer an open research/design question? |

**Weighted Score = (User Impact × 0.35) + (MVP Necessity × 0.30) + (Implementability × 0.20) + (Learning Value × 0.15)**

Features are then classified:
- **🟢 MVP (Built):** Core prototype — must work for the prototype to be testable
- **🟡 Next Sprint:** High priority for Sprint 4 prototype
- **🔵 Stretch Goal:** Valuable but not blocking

### Feature Analysis Table

| Feature | Description | User Role | Use Case | User Impact | MVP Nec. | Implement. | Learning Val. | **Weighted Score** | Status | Related Features |
|---------|-------------|-----------|----------|------------|---------|-----------|-------------|-------------------|--------|-----------------|
| **Event Creation** | Organizer creates event with title; auto-generates 8-char unique join code | Organizer | Planning an event | 5 | 5 | 5 | 3 | **4.70** | 🟢 Built | Polls, Summary |
| **Join by Code (No Login)** | Enter display name + join code; anonymous Firebase auth; no account created | Invitee | Drop link in group chat, everyone joins | 5 | 5 | 5 | 5 | **5.00** | 🟢 Built | Duplicate vote prevention |
| **Real-time Poll Voting** | Tap to vote; options update live for all clients via onSnapshot | All Users | Making group decisions quickly | 5 | 5 | 4 | 5 | **4.85** | 🟢 Built | Results view, summary |
| **Quick Poll Templates** | One-tap: Yes/No, Agree/Disagree, Rate 1–5, For/Against | Organizer | Fast poll creation without custom setup | 4 | 4 | 5 | 4 | **4.15** | 🟢 Built | Custom poll modal |
| **Real-time Results View** | Live bar chart per poll: %, vote count; auto-updates | All Users | Instant visibility into group sentiment | 5 | 5 | 4 | 4 | **4.70** | 🟢 Built | Summary dashboard |
| **Custom Poll Creation** | Full modal: question, choices, allow-multiple toggle | Organizer | Custom decisions (restaurants, dates, etc.) | 5 | 5 | 4 | 3 | **4.45** | 🟢 Built | Quick templates |
| **Dashboard with Event Cards** | Lists user's events with summary snippets; join/create actions | All Users | Manage multiple events at once | 4 | 5 | 4 | 2 | **3.95** | 🟢 Built | Event status states |
| **Vote Toggle / Change Vote** | Users can deselect or switch their vote | All Users | Allow mind-changing before decision finalizes | 3 | 4 | 5 | 2 | **3.55** | 🟢 Built | Voting |
| **Mobile Tab Layout** | Active / Answered / Results tabs on mobile | Invitee | Usable on phones at events | 5 | 4 | 4 | 2 | **3.90** | 🟢 Built | Desktop layout |
| **Desktop 3-Column Layout** | Side-by-side Active, Answered, Results columns | Organizer | Manage event from laptop | 4 | 3 | 4 | 2 | **3.35** | 🟢 Built | Mobile layout |
| **Poll Summary on Dashboard** | Per-event snippet: top poll result, vote count | Organizer | Glanceable event status without opening | 3 | 3 | 4 | 2 | **3.05** | 🟢 Built | Dashboard |
| **Delete/Leave Event** | Organizer deletes for all; invitee removes from their dashboard | All Users | Event lifecycle management | 3 | 3 | 5 | 1 | **3.05** | 🟢 Built | Dashboard |
| **Hard Deadline & Auto-Lock** | Poll closes at set time; winning option auto-selected | Organizer sets; Invitee experiences | Stop procrastination; force decision | 5 | 4 | 2 | 5 | **4.05** | 🟡 Next Sprint | Countdown timer, auto-finalize |
| **Explicit Poll Finalization** | Organizer taps "Finalize" to mark a poll as decided | Organizer | Clear "this is settled" signal for invitees | 5 | 4 | 4 | 5 | **4.40** | 🟡 Next Sprint | Event status states |
| **Attendee List / Who's Going** | Show which named participants have joined and/or voted | All Users | Social proof; see who's in | 4 | 3 | 3 | 4 | **3.45** | 🟡 Next Sprint | RSVP status |
| **RSVP Status (Going/Maybe/Not)** | Explicit attendance confirmation per invitee | Invitee | Distinct from poll voting; commitment signal | 4 | 3 | 3 | 4 | **3.45** | 🟡 Next Sprint | Attendee list, summary |
| **Countdown Timer** | Visible timer showing time remaining before poll closes | Invitee | Urgency — drives faster responses | 4 | 2 | 3 | 5 | **3.35** | 🟡 Next Sprint | Deadline feature |
| **Event Status Lifecycle** | Visible states: Collecting Votes → Closing Soon → Completed | Invitee | Keeps everyone oriented in decision process | 3 | 3 | 3 | 3 | **3.00** | 🟡 Next Sprint | Deadline, finalization |
| **Push Notifications** | Alert when a new poll is added or deadline is approaching | Invitee | Drives participation without returning to app | 4 | 2 | 2 | 3 | **2.85** | 🔵 Stretch | Deadline |
| **Word Parsing (LLM)** | Parse group chat messages to auto-create polls | All Users (auto) | Reduce manual setup for organizer | 2 | 1 | 1 | 3 | **1.70** | 🔵 Stretch | Privacy concerns (see Sprint 2) |
| **Venmo / Split Integration** | Payment splitting tied to event decisions | Organizer | Convenience for cost-sharing events | 3 | 1 | 1 | 2 | **1.80** | 🔵 Stretch | Event creation |

**Key Sprint 3 changes to feature analysis:**
- Added "Explicit Poll Finalization" as a new 🟡 Next Sprint priority — emerged directly from user testing (3/7 users asked "is this the final answer?")
- Moved "Attendee List / Who's Going" from stretch to 🟡 Next Sprint — 4/7 users asked for this in testing
- Demoted "Word Parsing (LLM)" further — user feedback continues to flag privacy concerns; remains long-term stretch only
- All 🟢 Built features are now validated with live user data

---

## Next Learning Prototype Plans (Sprint 4) 🆕

### Purpose of the Next Prototype
Sprint 3 validated the **core engagement loop** — frictionless joining, real-time voting, and visible results work as intended. Sprint 4's prototype must address the two critical gaps that Sprint 3 surfaced:

1. **The finalization problem:** Users don't know when a decision is truly "done." We need to test whether an explicit finalization mechanism (organizer-triggered or deadline-triggered) creates the clear "settled" moment users are expecting.
2. **Participation drop-off:** Average votes per poll was 2.8 out of ~5 possible participants. We need to test whether a nudge/notification mechanism (or visible attendee list showing who hasn't voted yet) improves completion rates.

### Core Hypothesis for Sprint 4
**We hypothesize that adding an explicit poll deadline with a visible countdown will cause participants to vote sooner and feel more certain that decisions are final, without adding friction to the organizer experience.**

### Features Planned for Sprint 4 Prototype
| Feature | What It Tests |
|---------|--------------|
| Hard deadline per poll (organizer sets time) | Does deadline pressure drive faster and more complete participation? |
| Explicit "Finalize Poll" button (organizer action) | Does a manual finalization signal remove ambiguity about decision state? |
| Countdown timer visible to all participants | Does visible urgency change voting behavior? |
| RSVP / Attendance status | Is attendance tracking distinct enough from poll voting to be worth the added complexity? |
| "Who hasn't voted?" indicator for organizer | Does showing participation gaps help organizers nudge members? |

### Testing Plan for Sprint 4
- **Session design:** Longitudinal — give groups a real task (plan an actual optional study session or social event) using Polled with deadlines. Observe over 24–48 hours rather than in a controlled session.
- **Sample:** 3 groups of 4–6 participants each (12–18 total participants). At least one group should be an existing friend/study group, not recruited strangers.
- **Metrics to collect:**
  - Time from poll creation to each vote (does deadline proximity predict vote timing?)
  - Participation rate (votes cast / participants joined) — target improvement from 56% to 75%+
  - Comprehension: do users correctly identify the "winning" choice after finalization?
  - Survey: "When did you feel the decision was made?" (open-ended)
- **Questions to answer:**
  1. Does the hard deadline push people to respond faster? *(carried over from Sprint 2 — now testable)*
  2. Does the finalization state clearly communicate to all users that the decision is done?
  3. Does the attendee/RSVP feature add value or add confusion?
  4. What is the right granularity for a deadline — hours, days, or custom?

### What We Are NOT Building in Sprint 4
- Word parsing / LLM features (privacy concerns confirmed, insufficient ROI)
- Push notifications (complex infrastructure; will use in-app indicators as proxy)
- Payment integrations (premature; not in core value prop yet)

---

*Sprint 3 Notebook — Team Polled (formerly Settled)*
*Sankar Gopalkrishna · Kevin Lin · Rakshit Naidu*
*Georgia Institute of Technology — CS 6750 / App Development Course*
*Date: March 2026*
