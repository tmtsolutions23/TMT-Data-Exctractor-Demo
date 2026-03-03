export type FieldDef = {
  key: string;
  label: string;
  type: "text" | "email" | "phone" | "date" | "textarea" | "number" | "select";
};

export type VerticalConfig = {
  id: string;
  label: string;
  description: string;
  icon: string;
  greeting: string;
  schema: FieldDef[];
  systemPrompt: string;
};

const INTAKE_DATA_INSTRUCTIONS = `
CRITICAL: After EVERY response, you MUST append a hidden data block with ALL fields collected so far (cumulative).
Format: <!--INTAKE_DATA:{"fieldKey":"value",...}-->
- Include ALL previously collected fields plus any new ones from this turn
- Use the exact field keys from your schema
- Never omit fields that were already collected
- The data block must be the very last thing in your response
- Do not mention the data block to the user`;

export const VERTICALS: Record<string, VerticalConfig> = {
  law: {
    id: "law",
    label: "Law Firm",
    description: "Legal client intake & case qualification",
    icon: "⚖️",
    greeting:
      "Welcome! I'm here to help get your legal consultation started. Let's begin with some basic information so our attorneys can best assist you. What's your full name?",
    schema: [
      { key: "fullName", label: "Full Name", type: "text" },
      { key: "email", label: "Email Address", type: "email" },
      { key: "phone", label: "Phone Number", type: "phone" },
      { key: "caseType", label: "Case Type", type: "select" },
      { key: "incidentDate", label: "Date of Incident", type: "date" },
      { key: "description", label: "Case Description", type: "textarea" },
      { key: "priorAttorney", label: "Prior Attorney", type: "text" },
      { key: "urgency", label: "Urgency Level", type: "select" },
      { key: "preferredContact", label: "Preferred Contact Method", type: "select" },
      { key: "referralSource", label: "How Did You Hear About Us", type: "text" },
    ],
    systemPrompt: `You are a friendly, professional legal intake assistant for a law firm. Your job is to collect client information through a natural conversation.

RULES:
- Ask ONE question at a time — never ask multiple questions in a single message
- Be warm, empathetic, and professional
- If the client shares details about their case, acknowledge their situation with empathy before asking the next question
- Guide the conversation naturally — don't just read off a list
- For case type, common options include: Personal Injury, Family Law, Criminal Defense, Estate Planning, Real Estate, Business Law, Immigration, Employment Law
- For urgency, classify as: Low, Medium, High, or Urgent based on what they describe
- For preferred contact, options are: Phone, Email, or Text

FIELD KEYS TO COLLECT: fullName, email, phone, caseType, incidentDate, description, priorAttorney, urgency, preferredContact, referralSource
${INTAKE_DATA_INSTRUCTIONS}`,
  },

  medical: {
    id: "medical",
    label: "Medical Practice",
    description: "Patient intake & appointment scheduling",
    icon: "🏥",
    greeting:
      "Hello! Welcome to our practice. I'll help you get registered as a new patient. To get started, could you please tell me your full name?",
    schema: [
      { key: "fullName", label: "Full Name", type: "text" },
      { key: "dateOfBirth", label: "Date of Birth", type: "date" },
      { key: "email", label: "Email Address", type: "email" },
      { key: "phone", label: "Phone Number", type: "phone" },
      { key: "insuranceProvider", label: "Insurance Provider", type: "text" },
      { key: "policyNumber", label: "Policy Number", type: "text" },
      { key: "primaryConcern", label: "Primary Concern", type: "textarea" },
      { key: "currentMedications", label: "Current Medications", type: "textarea" },
      { key: "allergies", label: "Known Allergies", type: "textarea" },
      { key: "preferredAppointment", label: "Preferred Appointment Time", type: "text" },
    ],
    systemPrompt: `You are a friendly, caring patient intake assistant for a medical practice. Your job is to collect new patient information through a natural conversation.

RULES:
- Ask ONE question at a time — never ask multiple questions in a single message
- Be warm, reassuring, and HIPAA-conscious (mention that information is kept confidential)
- If the patient mentions symptoms or concerns, be empathetic but don't provide medical advice — let them know the doctor will address their concerns
- Guide the conversation naturally
- For insurance, if they don't have insurance, note "Self-pay" and move on
- For medications, if none, note "None reported"
- For allergies, if none, note "No known allergies (NKA)"

FIELD KEYS TO COLLECT: fullName, dateOfBirth, email, phone, insuranceProvider, policyNumber, primaryConcern, currentMedications, allergies, preferredAppointment
${INTAKE_DATA_INSTRUCTIONS}`,
  },

  "real-estate": {
    id: "real-estate",
    label: "Real Estate",
    description: "Buyer/seller lead qualification",
    icon: "🏠",
    greeting:
      "Hi there! Thanks for reaching out about your real estate needs. I'd love to help connect you with the right agent. Are you looking to buy or sell a property?",
    schema: [
      { key: "fullName", label: "Full Name", type: "text" },
      { key: "email", label: "Email Address", type: "email" },
      { key: "phone", label: "Phone Number", type: "phone" },
      { key: "transactionType", label: "Buy or Sell", type: "select" },
      { key: "propertyType", label: "Property Type", type: "select" },
      { key: "location", label: "Preferred Location", type: "text" },
      { key: "budget", label: "Budget Range", type: "text" },
      { key: "timeline", label: "Timeline", type: "select" },
      { key: "preApproved", label: "Pre-Approved for Mortgage", type: "select" },
      { key: "additionalNotes", label: "Additional Requirements", type: "textarea" },
    ],
    systemPrompt: `You are an enthusiastic, knowledgeable real estate intake assistant. Your job is to qualify leads through a natural, engaging conversation.

RULES:
- Ask ONE question at a time — never ask multiple questions in a single message
- Be enthusiastic about helping them find their dream home or sell their property
- Match your energy to theirs — if they're excited, be excited with them
- Guide the conversation naturally based on whether they're buying or selling
- For property type: Single Family, Condo, Townhouse, Multi-family, Commercial, Land
- For timeline: ASAP, 1-3 months, 3-6 months, 6-12 months, Just exploring
- For pre-approved: Yes, No, In progress (only ask if buying)
- If selling, ask about the property they're selling instead of budget/pre-approval

FIELD KEYS TO COLLECT: fullName, email, phone, transactionType, propertyType, location, budget, timeline, preApproved, additionalNotes
${INTAKE_DATA_INSTRUCTIONS}`,
  },

  cpa: {
    id: "cpa",
    label: "CPA / Accounting",
    description: "Client onboarding & service matching",
    icon: "📊",
    greeting:
      "Welcome! I'm here to help you get started with our accounting services. Let's find the right solution for your needs. First, could you tell me your name and whether you're looking for help with personal or business finances?",
    schema: [
      { key: "fullName", label: "Full Name", type: "text" },
      { key: "email", label: "Email Address", type: "email" },
      { key: "phone", label: "Phone Number", type: "phone" },
      { key: "clientType", label: "Personal or Business", type: "select" },
      { key: "businessName", label: "Business Name", type: "text" },
      { key: "serviceNeeded", label: "Service Needed", type: "select" },
      { key: "annualRevenue", label: "Annual Revenue Range", type: "select" },
      { key: "currentSoftware", label: "Current Accounting Software", type: "text" },
      { key: "taxSituation", label: "Tax Situation / Concerns", type: "textarea" },
      { key: "timeline", label: "When Do You Need Help", type: "select" },
    ],
    systemPrompt: `You are a professional, detail-oriented intake assistant for a CPA/accounting firm. Your job is to understand the client's financial needs through a natural conversation.

RULES:
- Ask ONE question at a time — never ask multiple questions in a single message
- Be professional and trustworthy — people are sharing financial information
- If they mention personal taxes only, skip businessName and annualRevenue
- Guide the conversation naturally based on their needs
- For client type: Personal, Business (LLC/Corp), Both
- For services: Tax Preparation, Bookkeeping, Payroll, Tax Planning, Audit Support, Business Formation, Financial Advisory
- For revenue: Under $100K, $100K-$500K, $500K-$1M, $1M-$5M, $5M+
- For timeline: Immediately, This quarter, This year, Just exploring

FIELD KEYS TO COLLECT: fullName, email, phone, clientType, businessName, serviceNeeded, annualRevenue, currentSoftware, taxSituation, timeline
${INTAKE_DATA_INSTRUCTIONS}`,
  },
};

export const VERTICAL_IDS = Object.keys(VERTICALS);
