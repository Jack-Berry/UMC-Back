module.exports = [
  {
    category: "Communication & Relationships",
    assessment_type: "initial",
    questions: [
      {
        id: "init-comm-1",
        text: "How confident are you at expressing your needs in relationships?",
        parent_id: null,
      },
      {
        id: "init-comm-2",
        text: "Are you comfortable giving and receiving feedback?",
        parent_id: null,
      },
      {
        id: "init-comm-3",
        text: "Do you find it easy to have difficult conversations without conflict?",
        parent_id: null,
      },
      {
        id: "init-comm-4",
        text: "Can you maintain long-term friendships or close connections?",
        parent_id: null,
      },
    ],
  },
  {
    category: "Community & Contribution",
    assessment_type: "initial",
    questions: [
      {
        id: "init-commu-1",
        text: "Are you involved in any community or volunteering activities?",
        parent_id: null,
      },
      {
        id: "init-commu-2",
        text: "Do you feel a sense of responsibility toward others?",
        parent_id: null,
      },
      {
        id: "init-commu-3",
        text: "Have you ever supported someone else in learning or improving a skill?",
        parent_id: null,
      },
      {
        id: "init-commu-4",
        text: "Do you make time to contribute beyond your own household?",
        parent_id: null,
      },
    ],
  },
  {
    category: "DIY & Repairs",
    assessment_type: "initial",
    questions: [
      {
        id: "init-diy-1",
        text: "How confident are you using basic tools like a hammer or screwdriver?",
        parent_id: null,
      },
      {
        id: "init-diy-2",
        text: "Can you assemble flat-pack furniture without help?",
        parent_id: null,
      },
      {
        id: "init-diy-3",
        text: "Have you ever repaired something in your home (e.g., a leaking tap, squeaky hinge)?",
        parent_id: null,
      },
      {
        id: "init-diy-4",
        text: "Can you hang a shelf or picture securely on a wall?",
        parent_id: null,
      },
    ],
  },
  {
    category: "Technology & Digital Skills",
    assessment_type: "initial",
    questions: [
      {
        id: "init-tech-1",
        text: "How confident are you setting up new devices (TV, Wi-Fi, smart home tech)?",
        parent_id: null,
      },
      {
        id: "init-tech-2",
        text: "Do you know how to keep your computer or phone software up to date?",
        parent_id: null,
      },
      {
        id: "init-tech-3",
        text: "Can you confidently troubleshoot basic tech issues?",
        parent_id: null,
      },
      {
        id: "init-tech-4",
        text: "Are you comfortable using tools like spreadsheets or word processors?",
        parent_id: null,
      },
    ],
  },
  {
    category: "Well-being & Self-care",
    assessment_type: "initial",
    questions: [
      {
        id: "init-well-1",
        text: "Do you have a regular exercise or movement routine?",
        parent_id: null,
      },
      {
        id: "init-well-2",
        text: "Do you take time to reflect on your mental well-being?",
        parent_id: null,
      },
      {
        id: "init-well-3",
        text: "Can you confidently prepare a healthy meal?",
        parent_id: null,
      },
      {
        id: "init-well-4",
        text: "Do you make time for rest and recovery?",
        parent_id: null,
      },
    ],
  },
  {
    category: "Communication & Relationships",
    assessment_type: "communication",
    questions: [
      {
        id: "comm-1",
        text: "How do you usually let others know what you need or want in a conversation?",
        parent_id: null,
        followUps: {
          questions: [
            {
              id: "comm-1-1",
              text: "Do you find it easy to clearly state your needs without feeling guilty?",
              parent_id: "comm-1",
            },
            {
              id: "comm-1-2",
              text: "Are there specific situations where you struggle to express yourself (e.g. with family, at work)?",
              parent_id: "comm-1",
            },
            {
              id: "comm-1-3",
              text: "Do you tend to avoid bringing things up to keep the peace?",
              parent_id: "comm-1",
            },
            {
              id: "comm-1-4",
              text: "Do you ever feel resentful when your needs go unmet because you didn’t share them?",
              parent_id: "comm-1",
            },
          ],
        },
      },
      {
        id: "comm-2",
        text: "How comfortable are you offering and receiving feedback in relationships?",
        parent_id: null,
        followUps: {
          questions: [
            {
              id: "comm-2-1",
              text: "Do you worry about hurting someone’s feelings when giving feedback?",
              parent_id: "comm-2",
            },
            {
              id: "comm-2-2",
              text: "How do you usually respond when someone gives you constructive criticism?",
              parent_id: "comm-2",
            },
            {
              id: "comm-2-3",
              text: "Do you have a structure or approach you use when giving feedback?",
              parent_id: "comm-2",
            },
          ],
        },
      },
      {
        id: "comm-3",
        text: "How do you handle difficult or emotionally charged conversations?",
        parent_id: null,
        followUps: {
          questions: [
            {
              id: "comm-3-1",
              text: "Do you find yourself getting defensive or shutting down?",
              parent_id: "comm-3",
            },
            {
              id: "comm-3-2",
              text: "Do you take time to pause and reflect before responding?",
              parent_id: "comm-3",
            },
            {
              id: "comm-3-3",
              text: "Do you feel confident de-escalating conflict when it starts to rise?",
              parent_id: "comm-3",
            },
          ],
        },
      },
      {
        id: "comm-4",
        text: "What helps you sustain close friendships and relationships over time?",
        parent_id: null,
        followUps: {
          questions: [
            {
              id: "comm-4-1",
              text: "How often do you reach out to maintain connections?",
              parent_id: "comm-4",
            },
            {
              id: "comm-4-2",
              text: "Do you make time for meaningful conversations?",
              parent_id: "comm-4",
            },
          ],
        },
      },
    ],
  },
  {
    category: "Community & Contribution",
    assessment_type: "community",
    questions: [
      {
        id: "community-1",
        text: "What kinds of activities help you feel connected to your community?",
        parent_id: null,
        followUps: {
          questions: [
            {
              id: "community-1-1",
              text: "Are there any local groups or causes you’ve been interested in joining?",
              parent_id: "community-1",
            },
            {
              id: "community-1-2",
              text: "Do you prefer structured volunteering or informal helping?",
              parent_id: "community-1",
            },
          ],
        },
      },
      {
        id: "community-2",
        text: "How do you balance your responsibilities to yourself and to others?",
        parent_id: null,
        followUps: {
          questions: [
            {
              id: "community-2-1",
              text: "Do you ever feel overcommitted when helping others?",
              parent_id: "community-2",
            },
            {
              id: "community-2-2",
              text: "Do you set boundaries when taking on commitments?",
              parent_id: "community-2",
            },
          ],
        },
      },
      {
        id: "community-3",
        text: "Have you supported someone else to build a skill or overcome a challenge?",
        parent_id: null,
        followUps: {
          questions: [
            {
              id: "community-3-1",
              text: "What did you find most rewarding about that experience?",
              parent_id: "community-3",
            },
            {
              id: "community-3-2",
              text: "Is there a way you’d like to do more of this?",
              parent_id: "community-3",
            },
          ],
        },
      },
      {
        id: "community-4",
        text: "Do you set aside time to contribute beyond your household (even small acts)?",
        parent_id: null,
        followUps: {
          questions: [
            {
              id: "community-4-1",
              text: "What’s one small way you’d like to contribute this month?",
              parent_id: "community-4",
            },
          ],
        },
      },
    ],
  },
  {
    category: "DIY & Repairs",
    assessment_type: "diy",
    questions: [
      {
        id: "diy-1",
        text: "How confident are you using basic tools and materials safely?",
        parent_id: null,
        followUps: {
          questions: [
            {
              id: "diy-1-1",
              text: "Do you know how to choose the right tool for a job?",
              parent_id: "diy-1",
            },
            {
              id: "diy-1-2",
              text: "Do you have a basic toolkit at home?",
              parent_id: "diy-1",
            },
            {
              id: "diy-1-3",
              text: "Do you wear safety gear when appropriate (e.g. goggles, mask)?",
              parent_id: "diy-1",
            },
          ],
        },
      },
      {
        id: "diy-2",
        text: "How comfortable are you assembling furniture or basic home fittings?",
        parent_id: null,
        followUps: {
          questions: [
            {
              id: "diy-2-1",
              text: "Do you read the instructions thoroughly or jump straight in?",
              parent_id: "diy-2",
            },
            {
              id: "diy-2-2",
              text: "What’s the trickiest build you’ve completed?",
              parent_id: "diy-2",
            },
          ],
        },
      },
      {
        id: "diy-3",
        text: "Have you done any minor repairs (like fixing a leak or a hinge)?",
        parent_id: null,
        followUps: {
          questions: [
            {
              id: "diy-3-1",
              text: "Do you research how-tos before starting?",
              parent_id: "diy-3",
            },
            {
              id: "diy-3-2",
              text: "Are you comfortable turning off water/electricity safely when needed?",
              parent_id: "diy-3",
            },
          ],
        },
      },
      {
        id: "diy-4",
        text: "Can you hang shelves or pictures securely and level?",
        parent_id: null,
        followUps: {
          questions: [
            {
              id: "diy-4-1",
              text: "Do you know the right fixings for different wall types?",
              parent_id: "diy-4",
            },
          ],
        },
      },
    ],
  },
  {
    category: "Technology & Digital Skills",
    assessment_type: "technology",
    questions: [
      {
        id: "tech-1",
        text: "How confident are you setting up devices and home connectivity?",
        parent_id: null,
        followUps: {
          questions: [
            {
              id: "tech-1-1",
              text: "Do you feel comfortable setting up Wi-Fi or pairing devices?",
              parent_id: "tech-1",
            },
            {
              id: "tech-1-2",
              text: "Have you configured privacy or security settings before?",
              parent_id: "tech-1",
            },
          ],
        },
      },
      {
        id: "tech-2",
        text: "Do you keep your devices and software up to date?",
        parent_id: null,
        followUps: {
          questions: [
            {
              id: "tech-2-1",
              text: "Do you update apps/OS regularly or use auto-updates?",
              parent_id: "tech-2",
            },
            {
              id: "tech-2-2",
              text: "Do you back up important data?",
              parent_id: "tech-2",
            },
          ],
        },
      },
      {
        id: "tech-3",
        text: "Can you troubleshoot common issues (slow Wi-Fi, printer not working, crashes)?",
        parent_id: null,
        followUps: {
          questions: [
            {
              id: "tech-3-1",
              text: "What’s your general approach when something doesn’t work?",
              parent_id: "tech-3",
            },
            {
              id: "tech-3-2",
              text: "Do you search for guides or ask for help first?",
              parent_id: "tech-3",
            },
          ],
        },
      },
      {
        id: "tech-4",
        text: "Are you confident with basic productivity tools (docs, spreadsheets, email)?",
        parent_id: null,
        followUps: {
          questions: [
            {
              id: "tech-4-1",
              text: "Which tools do you use most often?",
              parent_id: "tech-4",
            },
          ],
        },
      },
    ],
  },
  {
    category: "Well-being & Self-care",
    assessment_type: "self-care",
    questions: [
      {
        id: "well-1",
        text: "Do you maintain a regular routine for exercise, sleep, and meals?",
        parent_id: null,
        followUps: {
          questions: [
            {
              id: "well-1-1",
              text: "Which part of your routine feels strongest right now?",
              parent_id: "well-1",
            },
            {
              id: "well-1-2",
              text: "Which part is most inconsistent?",
              parent_id: "well-1",
            },
          ],
        },
      },
      {
        id: "well-2",
        text: "How often do you check in on your mental well-being?",
        parent_id: null,
        followUps: {
          questions: [
            {
              id: "well-2-1",
              text: "What practices help you decompress (journaling, walks, breathing, etc.)?",
              parent_id: "well-2",
            },
            {
              id: "well-2-2",
              text: "Do you notice early signs when you’re getting overwhelmed?",
              parent_id: "well-2",
            },
          ],
        },
      },
      {
        id: "well-3",
        text: "Are you comfortable cooking healthy meals and planning groceries?",
        parent_id: null,
        followUps: {
          questions: [
            {
              id: "well-3-1",
              text: "Do you batch cook or plan meals for the week?",
              parent_id: "well-3",
            },
          ],
        },
      },
      {
        id: "well-4",
        text: "Do you plan time for rest, fun, and recovery?",
        parent_id: null,
        followUps: {
          questions: [
            {
              id: "well-4-1",
              text: "What’s one small rest practice you want to protect this week?",
              parent_id: "well-4",
            },
          ],
        },
      },
    ],
  },
];
