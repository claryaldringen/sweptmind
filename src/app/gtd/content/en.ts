/** The reference shape — other locales are typed by it. */
export const en = {
  page: {
    backHome: "Back to homepage",
    title: "Getting Things Done",
    subtitle: "A complete guide to David Allen's GTD methodology",
    introTitle: "What is GTD?",
    intro: `Getting Things Done (GTD) is a personal productivity methodology developed by David Allen and described in his book "Getting Things Done: The Art of Stress-Free Productivity" (2001). The fundamental idea is simple: your mind is meant for having ideas, not for holding them. When you move all your commitments, tasks, and ideas from your head into a trusted external system, you free up mental capacity for creative thinking and focusing on the work at hand.

GTD is not just another to-do list. It's a complete system for processing all inputs that come your way — emails, ideas, tasks from colleagues, personal commitments — and transforming them into concrete next actions.`,

    principlesTitle: "The 5 core steps of GTD",

    captureTitle: "1. Capture",
    captureContent: `The first and most important step: capture absolutely everything that requires your attention. Every thought, task, idea, commitment, or piece of information running through your mind goes into one place — your "inbox."

Your inbox can be physical (a paper tray) or digital (an app like SweptMind). The key principles:
- Capture immediately when something comes up
- Don't evaluate or sort during capture
- Have your inbox always at hand (a mobile app is ideal)
- Rule: if you're thinking about something for more than 2 minutes, write it down

Typical inputs to capture:
- "I need to call the dentist"
- "Idea for a new project"
- "Buy a birthday gift"
- "Reply to the boss's email"
- "Fix the leaky faucet"`,

    clarifyTitle: "2. Clarify",
    clarifyContent: `Go through each captured input and ask the key question: "Is this actionable? Can I do something about it?"

If NO:
- Delete it (not needed)
- Archive as reference material (might be useful later)
- Move to "Someday/Maybe" list (not current, but you don't want to lose it)

If YES, next question: "What's the very next physical action?"
- If it takes less than 2 minutes → do it immediately (the 2-minute rule)
- If it requires multiple steps → create a project
- If someone else needs to do it → delegate and track in "Waiting For" list
- If it has a specific deadline → schedule it in your calendar

Important: every task must be formulated as a concrete physical step. Not "Mom's birthday," but "Buy cake at Madame Gateaux" or "Reserve restaurant for Saturday."`,

    organizeTitle: "3. Organize",
    organizeContent: `Place sorted tasks into the right lists and categories. GTD recommends the following structure:

Next Actions:
Concrete physical tasks you can do right now. This is your main working list. Each task should start with a verb: "Call...", "Write...", "Buy...", "Fix...".

Projects:
Anything that requires more than one step to complete. "Organize a birthday party" is a project with steps like order cake, invite guests, decorate. Every project must have at least one defined next action.

Waiting For:
Tasks you've delegated or are waiting for a response on. Note the delegation date and who you're waiting for.

Someday/Maybe:
Ideas and projects you don't want to do now but don't want to lose. "Learn Spanish," "Write a blog," "Visit Iceland." Review regularly.

Calendar:
Only items with a fixed date and time. GTD strictly distinguishes between "must do on March 15" and "would like to do soon." Only the former goes on the calendar.

Reference Material:
Information that doesn't require action but might be useful — numbers, meeting notes, manuals.

Context Lists:
Contexts are the heart of GTD. Instead of thinking "what should I do?", you look at the context you're currently in, and it tells you what you can do. Group tasks by context:
- Computer — "Send invoices", "Book flights", "Write a blog post"
- Phone — "Call the dentist", "Book a doctor's appointment", "Set up a meeting with Peter"
- Home — "Vacuum the living room", "Fix the leaky faucet", "Clean out the garage"
- Errands — "Buy milk and bread", "Pick up package at the post office", "Buy a gift for mom"
- Office — "Print the contract", "Talk to the boss about the project", "Refill printer paper"
- Out — "Drop off clothes at the dry cleaner", "Pick up keys from the landlord", "Go for a run in the park"

How to do this in SweptMind:
SweptMind gives you two ways to set up contexts. The first is device context — assign each list or tag to either computer or phone. The app automatically detects which device you're using and highlights relevant lists in yellow. The second is location — assign a specific place to a list or tag (like "Home", "Office", "Walmart on 5th Ave"). SweptMind tracks your location and highlights nearby lists in green.

Tip: You can assign contexts to tags too, not just lists. A "Shopping" tag with a "Walmart" location will highlight all shopping-tagged tasks when you're near the store.`,

    engageTitle: "4. Engage",
    engageContent: `Now that everything is organized, you can focus on execution. GTD suggests 4 criteria for choosing your next task:

1. Context: Where are you? What do you have available? If you're at a computer, look at the Computer list. If you're out, check Errands. SweptMind automates this through the "Here & Now" feature.

2. Available time: Do you have 5 minutes or an hour? Choose tasks that fit your available time slot.

3. Available energy: Are you fresh and focused, or tired? Save demanding tasks for when you have the most energy.

4. Priority: From the remaining tasks (filtered by context, time, and energy), pick the most important one.

Key principle: don't make decisions about WHAT to do at the moment of execution. That decision was made in steps 2 and 3. Now you just select and work.

SweptMind takes this even further — tasks you can't do right now are hidden entirely. Future tasks (with a due date in the future) are automatically invisible and only appear when they become current. Your mind isn't burdened by things you can't act on anyway. You see only what's up next — exactly as GTD intends.`,

    reviewTitle: "5. Review",
    reviewContent: `Regular review is the engine of GTD. Without it, the system falls apart. David Allen recommends:

Daily review:
- Morning: check your calendar and next actions list
- Evening: capture anything that came up during the day

Weekly review (the most important GTD ritual):
Every week (ideally Friday afternoon or on the weekend) go through your ENTIRE system:
1. Empty all inboxes (email, notes, physical inbox)
2. Review your next actions list — is it current?
3. Review all projects — does each have a defined next action?
4. Review "Waiting For" — do you need to follow up?
5. Review "Someday/Maybe" — has anything become current?
6. Review your calendar (past and upcoming week)
7. Add any missing tasks

A weekly review typically takes 30-60 minutes. It's an investment that pays back many times over in peace of mind and clarity.`,

    horizonsTitle: "The 6 Horizons of Focus",
    horizonsContent: `GTD defines 6 levels of perspective, from concrete tasks to life purpose:

Ground level: Next Actions
Concrete tasks you can physically do. "Call the client," "Write the email."

10,000 feet: Projects
Outcomes requiring multiple steps. "Launch new website," "Move to a new apartment."

20,000 feet: Areas of Responsibility
Life areas you manage: health, finances, family, career, household. Each area generates projects.

30,000 feet: 1-2 year goals
What do you want to achieve in the foreseeable future? "Get promoted," "Learn to code," "Lose 10 kg."

40,000 feet: 3-5 year vision
Where do you want to be in 3-5 years? Career direction, lifestyle, education.

50,000 feet: Purpose and principles
Why are you here? Why do you do what you do? Your values and life mission.

The weekly review primarily covers ground level and 10,000 feet. Review higher horizons monthly or quarterly.`,

    tipsTitle: "Practical tips for getting started",
    tipsContent: `How to start with GTD:

1. The Big "Mind Sweep": Set aside 1-2 hours. Write down absolutely everything on your mind. David Allen recommends capturing at least 100 items. You'll be permanently surprised by how much you carry in your head.

2. Process your inbox: Go through each item with the "What's the next action?" rule. Use the 2-minute rule — anything shorter, do it now.

3. Set up your lists: Create basic lists in SweptMind — Next Actions, Waiting For, Someday/Maybe, and context lists based on your needs.

4. Establish the weekly review: Schedule a fixed time in your calendar. This is the most important habit of the entire method.

5. Be patient: Fully adopting GTD takes 2-3 months. Start simple and gradually add complexity.

Common mistakes:
- Tasks too vague (instead of "Call the dentist" writing "Deal with teeth") — be specific
- Forgetting the weekly review — without it, the system collapses
- Having too many lists — start simple
- Trying to be perfect — GTD is a tool, not a goal in itself`,

    bookTitle: "About the book",
    bookContent: `"Getting Things Done: The Art of Stress-Free Productivity" was written by David Allen and first published in 2001. The updated 2015 edition reflects the digital age. The book has sold millions of copies worldwide and GTD has become one of the most widely adopted personal productivity systems.

David Allen worked as a productivity consultant for corporations and individuals. His approach is unique in that it doesn't focus on setting priorities (like many other systems), but on completely capturing and organizing all inputs — which leads to "mind like water," a state of calm and readiness.

SweptMind is designed to naturally support the GTD workflow — from quick task capture through organization into context lists to the "Here & Now" feature that helps you focus on what you can do right now.`,

    ctaTitle: "Start using GTD with SweptMind",
  },
  hiddenTasks: {
    title: "Example: Hidden future tasks",
    desc: "You only see what's current. Future tasks are hidden and appear automatically.",
    visibleTasks: [
      { title: "Call the dentist" },
      { title: "Buy milk" },
      { title: "Send invoices" },
    ],
    futureLabel: "Future",
    futureTasks: [
      { title: "Prepare presentation", date: "Mar 15" },
      { title: "Renew driver's license", date: "Mar 22" },
      { title: "Mom's birthday — buy a gift", date: "Apr 5" },
    ],
    listName: "Tasks",
  },
  contextExample: {
    title: "Example: How contexts work in SweptMind",
    step1Title: "Create a list with a location",
    step1Desc: 'Create a list called "Home" and assign it your home address.',
    step2Title: "Create a list with a device context",
    step2Desc: 'Create a list called "At Computer" with the device context set to "computer."',
    step3Title: '"Here & Now" merges both contexts',
    step3Desc:
      "When you come home and open SweptMind on your computer, you see tasks from both lists at once. No need to browse individual lists — the app does it for you.",
    homeTasks: ["Vacuum the living room", "Water the plants", "Fix the faucet"],
    computerTasks: ["Send invoices", "Book flights"],
    nearby: "Nearby",
    deviceMatch: "Your computer",
    homeList: "Home",
    computerList: "At Computer",
    hereAndNow: "Here & Now",
  },
};
