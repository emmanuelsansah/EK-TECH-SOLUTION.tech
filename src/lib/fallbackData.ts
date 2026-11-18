import type { PublicBootstrap } from "../types";

export const DEFAULT_FALLBACK_BOOTSTRAP: PublicBootstrap = {
  "categories": [
    {
      "id": "cat-1",
      "name": "AI Website Development",
      "slug": "ai-website-development",
      "description": "Design, build, host, and connect domains for production websites with modern AI workflows.",
      "orderIndex": 1
    },
    {
      "id": "cat-2",
      "name": "AI Video Creation",
      "slug": "ai-video-creation",
      "description": "Script, synthesize, edit, and color-grade commercial videos using generative AI video tools.",
      "orderIndex": 2
    },
    {
      "id": "cat-3",
      "name": "Artificial Intelligence",
      "slug": "artificial-intelligence",
      "description": "Core AI literacy, model workflows, and practical AI integration for education and business.",
      "orderIndex": 3
    },
    {
      "id": "cat-4",
      "name": "Prompt Engineering",
      "slug": "prompt-engineering",
      "description": "Structured prompting frameworks for code generation, research, and automated operations.",
      "orderIndex": 4
    },
    {
      "id": "cat-5",
      "name": "Graphic Design",
      "slug": "graphic-design",
      "description": "Visual identity systems, typography, layout grids, and commercial branding workflows.",
      "orderIndex": 5
    },
    {
      "id": "cat-6",
      "name": "Web Development",
      "slug": "web-development",
      "description": "HTML, CSS, TypeScript, React, APIs, and hosting from fundamentals to deployment.",
      "orderIndex": 6
    },
    {
      "id": "cat-7",
      "name": "Computer Training",
      "slug": "computer-training",
      "description": "Essential digital productivity, cloud collaboration, spreadsheets, and cybersecurity hygiene.",
      "orderIndex": 7
    },
    {
      "id": "cat-8",
      "name": "Digital Marketing",
      "slug": "digital-marketing",
      "description": "Audience growth, content systems, paid campaigns, and AI-assisted analytics.",
      "orderIndex": 8
    }
  ],
  "courses": [
    {
      "id": "crs-1",
      "title": "AI Website Development Mastery",
      "slug": "ai-website-development-mastery",
      "categoryId": "cat-1",
      "instructorId": "usr-inst-1",
      "thumbnailUrl": "/src/assets/images/course_ai_webdev_1794843660816.jpg",
      "summary": "Watch Lesson 1 free on sign-in, then unlock the complete Google Drive AI Web Design Course (Detailed Tutorials, Hosting, Custom Domains & Bonuses) for GH₵ 50.",
      "description": "Master AI-powered website design and publishing with Emmanuel Sansah. Fresh students watch Lesson 1 (1 MUST WATCH) free immediately after login. Complete the GH₵ 50 MTN Mobile Money payment to unlock the remaining Google Drive video modules—Detailed Tutorials, Other Website Examples, Hosting Your Website, Domain Name setup, Android App conversion, Troubleshooting, and Bonuses—using your sign-up email.",
      "priceGhs": 50,
      "isFree": false,
      "duration": "6 Weeks",
      "difficulty": "Beginner",
      "isPublished": true,
      "isFeatured": true,
      "driveFolderId": "1Kzr26pgYSYro2pnP8W1lUFspy7_SwPQN",
      "driveFolderName": "AI Website Development Tutorials (Google Drive)",
      "learningObjectives": [
        "Follow the step-by-step AI Web Design curriculum from Lesson 1 free orientation",
        "Build real client and business websites with detailed AI tutorials and examples",
        "Host your finished website online and connect a custom domain name",
        "Package responsive web builds into Android apps and troubleshoot errors"
      ],
      "requirements": [
        "A laptop, desktop, or smartphone with internet access",
        "Valid sign-up Gmail address to receive full Google Drive video access after payment"
      ],
      "completionRequirement": "Watch Lesson 1 free, complete GH₵ 50 MTN MoMo payment to unlock all remaining videos, and finish the course quiz.",
      "createdAt": "2026-10-15T09:00:00+00:00"
    },
    {
      "id": "crs-2",
      "title": "AI Video Creation & Commercial Editing",
      "slug": "ai-video-creation-commercial-editing",
      "categoryId": "cat-2",
      "instructorId": "usr-inst-1",
      "thumbnailUrl": "/src/assets/images/course_ai_video_1794843660832.jpg",
      "summary": "Start with the free introduction video, then unlock the full AI Video Creation & Commercial Editing training series for GH₵ 50.",
      "description": "Learn how creators and agencies produce studio-grade adverts, social reels, and explainers using generative AI video pipelines. Start with Lesson 1 free on fresh login, then unlock all remaining tutorials and Google Drive video folders using your sign-up email after GH₵ 50 Mobile Money confirmation.",
      "priceGhs": 50,
      "isFree": false,
      "duration": "5 Weeks",
      "difficulty": "Beginner",
      "isPublished": true,
      "isFeatured": true,
      "driveFolderId": "1OccyWRAGt64BkaO3PXsLAXhInnfZG5uZ",
      "driveFolderName": "AI Video Creation Tutorials (Google Drive)",
      "learningObjectives": [
        "Write high-retention video scripts and shot lists with AI tools",
        "Generate consistent visual scenes, voiceovers, and studio B-roll",
        "Edit rhythmic timelines, captions, and commercial sound mixes",
        "Export commercial deliverables for YouTube, TikTok, Instagram, and clients"
      ],
      "requirements": [
        "Computer or smartphone capable of running modern video editors",
        "Valid sign-up email address for post-payment video folder access"
      ],
      "completionRequirement": "Unlock all modules via GH₵ 50 MoMo verification and submit your 45-second commercial project.",
      "createdAt": "2026-10-15T09:00:00+00:00"
    },
    {
      "id": "crs-3",
      "title": "Artificial Intelligence for Business & Education",
      "slug": "artificial-intelligence-business-education",
      "categoryId": "cat-3",
      "instructorId": "usr-inst-1",
      "thumbnailUrl": "/src/assets/images/course_ai_systems_1794843661238.jpg",
      "summary": "Practical AI implementation for educators, entrepreneurs, and teams looking to automate daily workflows.",
      "description": "Go beyond casual chat usage. Understand how large language models work, build reliable document workflows, automate customer support drafts, create lesson plans, and maintain data privacy across your organization.",
      "priceGhs": 150,
      "isFree": false,
      "duration": "8 Weeks",
      "difficulty": "Intermediate",
      "isPublished": true,
      "isFeatured": true,
      "learningObjectives": [
        "Design repeatable AI workflows for reporting, research, and curriculum design",
        "Evaluate AI outputs for factual accuracy and institutional compliance",
        "Integrate no-code automation bridges between forms, sheets, and email"
      ],
      "requirements": [
        "Familiarity with office productivity tools (Docs, Sheets, Email)"
      ],
      "completionRequirement": "Complete all modules and pass the AI Systems Assessment.",
      "createdAt": "2026-10-15T09:00:00+00:00"
    },
    {
      "id": "crs-4",
      "title": "Applied Prompt Engineering Studio",
      "slug": "applied-prompt-engineering-studio",
      "categoryId": "cat-4",
      "instructorId": "usr-inst-1",
      "thumbnailUrl": "/src/assets/images/course_ai_systems_1794843661238.jpg",
      "summary": "Master precision prompting patterns—chain-of-thought, structured JSON schemas, and reusable prompt libraries.",
      "description": "Learn the engineering discipline behind reliable AI outputs. Stop guessing with vague one-liners and start writing deterministic system prompts, evaluation rubrics, and domain-specific templates.",
      "priceGhs": 100,
      "isFree": false,
      "duration": "4 Weeks",
      "difficulty": "Beginner",
      "isPublished": true,
      "isFeatured": true,
      "learningObjectives": [
        "Apply role, context, constraint, and output-format frameworks",
        "Use few-shot examples to enforce consistent tone and structure",
        "Build a personal prompt library for coding, writing, and analysis"
      ],
      "requirements": [
        "Basic web browsing skills"
      ],
      "completionRequirement": "Complete all modules and score 75%+ on the Prompt Engineering Exam.",
      "createdAt": "2026-10-15T09:00:00+00:00"
    },
    {
      "id": "crs-5",
      "title": "Graphic Design Prompts & Modern Brand Identity",
      "slug": "graphic-design-modern-brand-identity",
      "categoryId": "cat-5",
      "instructorId": "usr-inst-1",
      "thumbnailUrl": "/src/assets/images/course_design_digital_1794843661469.jpg",
      "summary": "Start with Lesson 1 free, then unlock the complete Google Drive Graphic Design Prompts & Modern Brand Identity library after payment.",
      "description": "A hands-on design academy track covering visual hierarchy, color theory, print-ready flyers, social media kits, and complete brand books using modern design tools.",
      "priceGhs": 120,
      "isFree": false,
      "duration": "6 Weeks",
      "difficulty": "Beginner",
      "isPublished": true,
      "isFeatured": true,
      "driveFolderId": "1-X_O9cbsQJdXCwq-E2xHDh22SGGYx9ro",
      "driveFolderName": "Graphic Design Prompts & Tutorials (Google Drive)",
      "learningObjectives": [
        "Construct balanced typographic hierarchies and grid layouts",
        "Design vector logo marks and cohesive brand color systems",
        "Package print and digital brand assets for paying clients"
      ],
      "requirements": [
        "Laptop or desktop computer"
      ],
      "completionRequirement": "Submit a complete 5-page Brand Identity Guide.",
      "createdAt": "2026-10-15T09:00:00+00:00"
    },
    {
      "id": "crs-6",
      "title": "Full-Stack Web Development & TypeScript",
      "slug": "full-stack-web-development-typescript",
      "categoryId": "cat-6",
      "instructorId": "usr-inst-1",
      "thumbnailUrl": "/src/assets/images/course_ai_webdev_1794843660816.jpg",
      "summary": "Deep dive into modern JavaScript, TypeScript, React, Node.js REST APIs, and PostgreSQL/Supabase databases.",
      "description": "Become a job-ready full-stack engineer. Build real authentication systems, relational schemas, REST endpoints, and responsive React applications with strict type safety.",
      "priceGhs": 200,
      "isFree": false,
      "duration": "10 Weeks",
      "difficulty": "Intermediate",
      "isPublished": true,
      "isFeatured": false,
      "learningObjectives": [
        "Build type-safe React applications with hooks and state management",
        "Design REST APIs with Express and PostgreSQL/Supabase",
        "Implement secure password hashing, RBAC permissions, and deployment"
      ],
      "requirements": [
        "Basic familiarity with HTML/CSS or completion of AI Website Development"
      ],
      "completionRequirement": "Complete all lessons and deploy a full-stack capstone.",
      "createdAt": "2026-10-15T09:00:00+00:00"
    },
    {
      "id": "crs-7",
      "title": "Digital Skills & Computer Training Essentials",
      "slug": "digital-skills-computer-training",
      "categoryId": "cat-7",
      "instructorId": "usr-inst-1",
      "thumbnailUrl": "/src/assets/images/course_design_digital_1794843661469.jpg",
      "summary": "Introductory computer training covering cloud workspace tools, spreadsheets, documents, and online safety.",
      "description": "Designed for students, job seekers, and professionals building strong everyday computer fluency. Learn file organization, business spreadsheets, slide decks, email etiquette, and cybersecurity essentials.",
      "priceGhs": 50,
      "isFree": false,
      "duration": "3 Weeks",
      "difficulty": "Beginner",
      "isPublished": true,
      "isFeatured": false,
      "learningObjectives": [
        "Organize cloud drives, documents, and collaborative spreadsheets",
        "Protect personal and workplace accounts against phishing and scams",
        "Prepare professional reports and presentations efficiently"
      ],
      "requirements": [
        "Access to a computer or tablet"
      ],
      "completionRequirement": "Complete all lessons and the Digital Literacy Quiz.",
      "createdAt": "2026-10-15T09:00:00+00:00"
    },
    {
      "id": "crs-8",
      "title": "AI-Powered Digital Marketing & Growth",
      "slug": "ai-powered-digital-marketing-growth",
      "categoryId": "cat-8",
      "instructorId": "usr-inst-1",
      "thumbnailUrl": "/src/assets/images/course_ai_video_1794843660832.jpg",
      "summary": "Plan customer acquisition funnels, social content calendars, and conversion copy using data and AI.",
      "description": "Learn practical digital marketing tailored for West African and international online businesses—covering positioning, WhatsApp Business funnels, Meta ads fundamentals, and campaign analytics.",
      "priceGhs": 100,
      "isFree": false,
      "duration": "4 Weeks",
      "difficulty": "Beginner",
      "isPublished": true,
      "isFeatured": false,
      "learningObjectives": [
        "Build a 30-day multi-channel content and campaign calendar",
        "Design high-converting landing offers and WhatsApp follow-up flows",
        "Measure ROI, cost per lead, and retention metrics"
      ],
      "requirements": [
        "Active smartphone or laptop"
      ],
      "completionRequirement": "Complete all lessons and submit a campaign brief.",
      "createdAt": "2026-10-15T09:00:00+00:00"
    }
  ],
  "instructors": [
    {
      "id": "usr-inst-1",
      "fullName": "Emmanuel Sansah",
      "avatarUrl": "/assets/aistudio/file_00000000a15471f5ba7cf46620f2a80f_8115ee43.png",
      "bio": "Emmanuel Sansah | 💻 IT Specialist | AI Expert | Graphic Designer | Web Development | 🧠 Prompt Engineering | Tech Solutions | AI & Tech Knowledge",
      "title": "Lead AI Website & Video Creation Instructor",
      "location": "Tarkwa, Western Region & Accra, Ghana"
    }
  ],
  "website": {
    "heroHeadline": "Master the Future with Artificial Intelligence.",
    "heroSubheadline": "EK TECH SOLUTIONS equips ambitious learners across Ghana and beyond with practical training in AI Website Development (GH₵ 50), AI Video Creation (GH₵ 50), Prompt Engineering, and Modern Software Skills.",
    "aboutTitle": "Practical Technology Education Built for Real Outcomes",
    "aboutMission": "To make world-class artificial intelligence, website development, and AI video creation skills accessible through structured online tutorials, hands-on projects, and direct mentorship from Emmanuel Sansah.",
    "aboutVision": "Raising a generation of African and global builders who do not just consume technology, but design, automate, and ship meaningful digital products.",
    "announcementBanner": "Watch Lesson 1 Free on Sign-In — AI Website Learning & AI Video Creation are now GH₵ 50 each via MTN MoMo (0551464715).",
    "testimonials": [
      {
        "id": "tes-1",
        "name": "Kofi Agyemang",
        "role": "Freelance Web Designer",
        "quote": "Watching the free Lesson 1 convinced me immediately. After my GH₵ 50 MoMo payment was confirmed on my sign-up email, I followed the detailed Google Drive tutorials and delivered two paid client websites.",
        "organization": "Tema Digital Studio",
        "courseCompleted": "AI Website Development Mastery"
      },
      {
        "id": "tes-2",
        "name": "Ama Serwaa",
        "role": "Marketing Coordinator",
        "quote": "Emmanuel Sansah explains everything clearly step by step. The prompt engineering templates cut our campaign copywriting and reporting time in half.",
        "organization": "Accra Retail Collective",
        "courseCompleted": "Applied Prompt Engineering Studio"
      },
      {
        "id": "tes-3",
        "name": "Daniel Owusu",
        "role": "Content Producer",
        "quote": "For just GH₵ 50, the AI Video Creation course transformed how we produce commercial adverts for local businesses.",
        "organization": "Kumasi Media House",
        "courseCompleted": "AI Video Creation & Commercial Editing"
      }
    ],
    "faqs": [
      {
        "id": "faq-1",
        "answer": "Every newly registered or signed-in student can watch Lesson 1 (1 MUST WATCH) completely free. To unlock the remaining course videos and receive Google Drive access on your sign-up email, send GH₵ 50 (for AI Website Development or AI Video Creation) to MTN Mobile Money 0551464715 (EK TECH SOLUTIONS) and submit your Transaction ID inside your dashboard.",
        "category": "Enrolment & Payments",
        "question": "How do I unlock the rest of the videos after watching the free Lesson 1?"
      },
      {
        "id": "faq-2",
        "answer": "Once our administrator verifies your Mobile Money transfer, access to the remaining premium course videos in Instructor Emmanuel Sansah’s Google Drive library (emmanuelsansah020@gmail.com) is granted directly to your registered sign-up email address.",
        "category": "Learning Format",
        "question": "Why do I need to use my sign-up email for payment verification?"
      },
      {
        "id": "faq-3",
        "answer": "Payments are manually verified by our administration team to protect students and prevent duplicate transaction IDs. Verification typically completes within 15 minutes to 2 hours, and you can also message 0551464715 on WhatsApp for urgent assistance.",
        "category": "Verification & Access",
        "question": "How long does Mobile Money payment verification take?"
      },
      {
        "id": "faq-4",
        "answer": "Yes. Upon completing all required lessons and passing the course quiz or practical assessment, an official EK TECH SOLUTIONS certificate signed by Emmanuel Sansah is issued in your Student Dashboard.",
        "category": "Certificates",
        "question": "Do I receive a certificate after completing a course?"
      },
      {
        "id": "faq-5",
        "answer": "No prior programming background is required. Emmanuel Sansah walks you step by step from the free intro video through building, hosting, custom domains, and troubleshooting.",
        "category": "Prerequisites",
        "question": "Do I need coding experience before joining AI Website Development?"
      }
    ]
  },
  "settings": {
    "academyName": "EK TECH SOLUTIONS",
    "tagline": "Learn Technology. Build with AI. Create the Future.",
    "momoBusinessName": "EK TECH SOLUTIONS",
    "momoNumber": "0551464715",
    "whatsappNumber": "0551464715",
    "supportEmail": "emmanuelsansah020@gmail.com",
    "currency": "GH₵",
    "allowPublicRegistration": true,
    "paymentGatewayMode": "BOTH"
  },
  "paystackConfigured": true,
  "stats": {
    "activeLearners": 146,
    "publishedCourses": 8,
    "practicalModules": 20,
    "completionRate": 94
  }
};
