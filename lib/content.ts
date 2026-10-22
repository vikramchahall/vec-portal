/**
 * Single source of truth for everything the public site renders.
 *
 * This mirrors the Supabase tables created in docs/sql/01-website.sql. The site
 * reads from here so it runs with zero configuration; once the portal login
 * exists, these same shapes get fetched from Supabase instead and this file
 * becomes the seed. Keep the field names identical to the SQL columns.
 */

export const company = {
  legalName: "Harjeet Singh",
  tradeName: "Vikram Engineering Co.",
  short: "VEC",
  proprietor: "Harjeet Singh",
  constitution: "Proprietorship",
  tagline: "We run the plants that keep refineries running.",
  addressLines: [
    "B-526, Sushant City Phase-II",
    "Mansa Road, Bathinda",
    "Punjab – 151001",
  ],
  email: "vikramengineeringco@gmail.com",
  phones: ["+91 94174 85423"],
  trackRecordFrom: 2015,
  workersOnRoll: 160,
  liveSites: 4,
  states: ["Punjab", "Rajasthan", "Uttar Pradesh"],
};

/** Rendered on the Compliance page. Anything left blank is simply not shown. */
export const registrations = [
  { label: "Constitution", value: "Proprietorship", note: "Registered office at Bathinda, Punjab" },
  { label: "GSTIN", value: "03ANIPS5337H1ZW", note: "Regular, liable since 01 July 2017" },
  { label: "EPFO Establishment ID", value: "PBBTI0028877000", note: "PF Office: Bhatinda (BTI) — Un-exempted" },
  { label: "NIC Code", value: "F-42901", note: "Construction of civil engineering / water projects" },
  { label: "ESIC Employer Code", value: "12000531400001001", note: "" },
];

export type Service = {
  slug: string;
  title: string;
  blurb: string;
  detail: string;
  image: string;
  points: string[];
};

export const services: Service[] = [
  {
    slug: "om-plants",
    title: "O&M of Water, Effluent & Treatment Plants",
    blurb:
      "Water Block, ETP and RO-DM plants, run end to end.",
    detail:
      "Our largest service line. We take over a plant end to end — shift operation, maintenance, chemical dosing, lab testing and statutory record-keeping — at an operating BS-VI refinery and at a zinc smelter.",
    image: "etp-aerial",
    points: [
      "Shift-wise plant operation, 24×7",
      "Mechanical, electrical and instrumentation maintenance",
      "Chemical preparation, dosing and lab testing",
      "Greasing, lubrication and periodical cleaning of civil process units",
      "Equipment history cards, logbooks and daily records",
    ],
  },
  {
    slug: "manpower",
    title: "Contract Manpower Supply",
    blurb:
      "Un-skilled to highly-skilled, across 30+ trades.",
    detail:
      "We recruit, deploy and pay the workforce, and we carry the full compliance burden — PF, ESI, bonus, leave salary, labour licence and minimum wages. Wages go out by direct bank transfer by the 7th, whether or not our own invoice has cleared.",
    image: "workers-safety-gear",
    points: [
      "Four grades: Highly Skilled, Skilled, Semi-Skilled, Un-Skilled",
      "Shift rosters, overtime registers and OT justification records",
      "PF and ESI challans, half-yearly and annual returns",
      "Form XIX wage slips issued to every worker",
      "Labour licence obtained for each work place",
    ],
  },
  {
    slug: "erection",
    title: "Mechanical Erection, Testing & Commissioning",
    blurb:
      "Mechanical equipment, erected to commissioning.",
    detail:
      "Complete mechanical scope executed to GA drawings, with our own hydra, cranes, welding sets and consumables — through testing, trial run, commissioning and the defect liability period.",
    image: "welding-sparks",
    points: [
      "Erection to GA drawings and client specification",
      "Own hydra, cranes, welding machines and consumables",
      "Testing, trial run and commissioning",
      "Defect liability support after handover",
    ],
  },
  {
    slug: "pipeline",
    title: "Pipeline Laying & Civil Works",
    blurb:
      "PSC pipeline, excavation, chambers, thrust blocks.",
    detail:
      "We have laid 600 mm and 350 mm PSC pipeline for a 26 MLD sewage scheme, supplying all construction material, plant, machinery, survey equipment and site lighting for night working.",
    image: "trench-worker",
    points: [
      "PSC pipeline laying, 350 mm and 600 mm dia",
      "Excavation to 3 m in all soil types including soft rock",
      "Layer-wise compacted backfilling to specification",
      "Valve chambers, thrust blocks and caution-tape barricading",
      "Area survey and level measurement before layout",
    ],
  },
  {
    slug: "painting",
    title: "Industrial Painting & Protective Coating",
    blurb:
      "Protective coating, wrapping, sheds and canopies.",
    detail:
      "Surface preparation and protective coating across live plant areas — including wrapping and coating of buried pipeline, and fabrication of sheds and canopies over chemical dosing and pump areas.",
    image: "spray-painting",
    points: [
      "Piping, supports and equipment painting",
      "Wrapping and coating of underground pipeline",
      "Structural sheds over chemical dosing and pump house areas",
      "Canopies for dosing pumps, transmitters, switches and agitators",
      "Eye-wash fountains, safety showers and fume absorbers",
    ],
  },
  {
    slug: "site-services",
    title: "Site Support Services",
    blurb:
      "Channel patrolling, housekeeping, mess, transport.",
    detail:
      "The work that keeps a plant running around the operation itself — from patrolling a raw water channel through the night to running a 36-room guest house and a vehicle fleet.",
    image: "control-room",
    points: [
      "Raw water channel cleaning, monitoring and patrolling",
      "Housekeeping and janitorial services",
      "Guest-house, cook and common mess management",
      "Site transportation — buses, light vehicles, tractor-trolleys",
      "Sludge disposal to approved environmental areas",
    ],
  },
];

export type Project = {
  ref: string;
  client: string;
  title: string;
  city: string;
  state: string;
  period: string;
  description: string;
  image: string;
  category: string;
  ongoing?: boolean;
  featured?: boolean;
};

/** Live contracts — running today. */
export const liveSites: Project[] = [
  {
    ref: "WB-REF",
    client: "HPCL-Mittal Energy Ltd — via Aquatech Systems Asia Pvt Ltd",
    title: "Water Block — HMEL Refinery",
    city: "Bathinda",
    state: "Punjab",
    period: "Since 2018",
    ongoing: true,
    featured: true,
    category: "om-plants",
    description:
      "Complete O&M of the refinery Water Block — round-the-clock shift operation, mechanical, electrical and instrumentation maintenance, rigging, welding, fitting and gas cutting, chemical dosing, lab testing, housekeeping, safety supervision and admin support. Seventeen trades, from Helper to PLC Engineer.",
    image: "wtp-aerial-3",
  },
  {
    ref: "ETP-REF",
    client: "HPCL-Mittal Energy Ltd — via Aquatech Systems Asia Pvt Ltd",
    title: "Effluent Treatment Plant — HMEL Refinery",
    city: "Bathinda",
    state: "Punjab",
    period: "Since 2018",
    ongoing: true,
    featured: true,
    category: "om-plants",
    description:
      "Complete O&M of the refinery Effluent Treatment Plant — field operation across shifts, effluent monitoring and lab chemistry, mechanical fitting and welding, rigging, electrical and instrument technician work, horticulture, housekeeping, shift-incharge supervision and safety.",
    image: "etp-aerial",
  },
  {
    ref: "HZL-DEBARI",
    client: "Hindustan Zinc Ltd",
    title: "RO-DM Plant — Zinc Smelter Debari",
    city: "Udaipur",
    state: "Rajasthan",
    period: "Since April 2025",
    ongoing: true,
    featured: true,
    category: "om-plants",
    description:
      "O&M manpower for the RO-DM plant at the zinc smelter — plant operation, mechanical and electrical maintenance, junior engineering supervision, lab chemistry and helper support.",
    image: "smelter-molten",
  },
  {
    ref: "OTHER-HMEL",
    client: "HPCL-Mittal Energy Ltd — via Aquatech Systems Asia Pvt Ltd",
    title: "Transport & General Services — HMEL Refinery",
    city: "Bathinda",
    state: "Punjab",
    period: "Ongoing",
    ongoing: true,
    category: "site-services",
    description:
      "Dedicated driver pool and civil supervision for plant transport, in-plant material shifting and sludge disposal.",
    image: "transport-buses",
  },
];

/** Completed contracts, newest first. */
export const completedProjects: Project[] = [
  {
    ref: "C10",
    client: "HPCL-Mittal Energy Ltd",
    title: "Raw Water Channel Cleaning & Patrolling — Rate Contract",
    city: "Bathinda",
    state: "Punjab",
    period: "May 2022 – April 2023",
    category: "site-services",
    description:
      "Second renewal of the raw water channel contract, awarded as an annual rate contract for the Guru Gobind Singh Refinery.",
    image: "water-channel",
  },
  {
    ref: "C9",
    client: "HPCL-Mittal Energy Ltd",
    title: "Raw Water Channel Cleaning & Patrolling — Renewal",
    city: "Bathinda",
    state: "Punjab",
    period: "April 2019 – April 2020",
    category: "site-services",
    description:
      "First renewal of the channel cleaning and patrolling contract, re-awarded on satisfactory performance.",
    image: "water-channel",
  },
  {
    ref: "C8",
    client: "Engineers India Ltd — a Govt. of India Undertaking",
    title: "Manpower & Housekeeping — BS-VI Project",
    city: "Bathinda",
    state: "Punjab",
    period: "24 months from May 2018",
    featured: true,
    category: "manpower",
    description:
      "Secretarial, Data Entry and SAP Operator, Office Assistant and Messenger at the EIL site office; Cook-cum-Caretaker, Helpers and complete janitorial services at the EIL transit accommodation — all on the full statutory wage build-up.",
    image: "workers-hardhats",
  },
  {
    ref: "C7",
    client: "SUEZ India Pvt Ltd",
    title: "Complete Transportation Services",
    city: "Bathinda",
    state: "Punjab",
    period: "January – December 2018",
    category: "site-services",
    description:
      "24×7 transport between the guest house and the WTP and EPT plants — a 40-seater deluxe mini bus, three Mahindra Boleros and two tractor-and-twin-trolley sets for sludge disposal. Diesel, drivers, insurance, maintenance and replacement vehicles all in our scope.",
    image: "transport-buses",
  },
  {
    ref: "C6",
    client: "SUEZ India Pvt Ltd",
    title: "Complete Guest-House Services",
    city: "Bathinda",
    state: "Punjab",
    period: "January – December 2018",
    category: "site-services",
    description:
      "36 fully furnished rooms with rent and accommodation management, round-the-clock housekeeping, cook management and common mess operation, and twice-daily refreshments for all staff on duty.",
    image: "refinery-day",
  },
  {
    ref: "C5",
    client: "SUEZ India Pvt Ltd",
    title: "Manpower Services — RODM & ETP Plants",
    city: "Bathinda",
    state: "Punjab",
    period: "January – December 2018",
    category: "manpower",
    description:
      "Greasing, lubricating, finishing and cleaning of units and equipment; chemical preparation and dosing; assisting equipment rectification and repair; periodical cleaning of all civil process units; equipment history cards and daily logbooks.",
    image: "operator-panel",
  },
  {
    ref: "C4",
    client: "HPCL-Mittal Energy Ltd",
    title: "Raw Water Channel Cleaning & Patrolling",
    city: "Bathinda",
    state: "Punjab",
    period: "August 2017 – March 2018",
    category: "site-services",
    description:
      "Monitoring and cleaning the canal from the Bangi head channel to the Kotla Canal plant intake — one man per shift round the clock, inlet gate monitoring, removal and disposal of debris, solids, grasses and bushes.",
    image: "water-channel",
  },
  {
    ref: "C3",
    client: "Triveni Engineering & Industries Ltd",
    title: "Mechanical Painting & Protective Coating",
    city: "Bathinda",
    state: "Punjab",
    period: "From July 2016",
    featured: true,
    category: "painting",
    description:
      "2,357 m² of piping, supports and equipment painted; 90 m of underground pipeline wrapped and coated; structural sheds over the chemical dosing area and pump house; 25+ canopies; eye-wash fountains, safety showers and fume absorbers; ladder grouting at 13 tanks.",
    image: "spray-painting",
  },
  {
    ref: "C2",
    client: "Geo Miller & Co. Pvt Ltd — for UP Jal Nigam",
    title: "PSC Pipeline Laying — 26 MLD STP",
    city: "Jhansi",
    state: "Uttar Pradesh",
    period: "From April 2016",
    featured: true,
    category: "pipeline",
    description:
      "Four pipeline runs totalling roughly 2,300 running metres — 600 mm dia from SPS-1 to the STP, and 350 mm dia from SPS-2 to the STP, SPS-3 to SPS-2 and the STP to the lake. 3,300 cum of excavation to 3 m, layer-wise compacted backfill, 10 valve chambers and 25 thrust blocks.",
    image: "stp-aerial-2",
  },
  {
    ref: "C1",
    client: "SN Enviro-Tech Pvt Ltd",
    title: "Erection, Testing & Commissioning — 10 MLD STP",
    city: "Sriganganagar",
    state: "Rajasthan",
    period: "From September 2015",
    category: "erection",
    description:
      "Full mechanical scope for a 10 MLD sewage treatment plant executed to GA drawings, with our own hydra, cranes, welding sets and consumables, through trial run, commissioning and a one-year defect liability period.",
    image: "stp-aerial-1",
  },
];

export const allProjects: Project[] = [...liveSites, ...completedProjects];

export const clients = [
  "HPCL-Mittal Energy Ltd",
  "Hindustan Zinc Ltd",
  "Aquatech Systems Asia Pvt Ltd",
  "Engineers India Ltd",
  "SUEZ India Pvt Ltd",
  "UP Jal Nigam",
  "Geo Miller & Co. Pvt Ltd",
  "Triveni Engineering & Industries Ltd",
  "SN Enviro-Tech Pvt Ltd",
];

export const trades = {
  "Highly Skilled": [
    "Rigger",
    "Mechanical Welder",
    "Safety Officer",
    "Mechanical Supervisor",
  ],
  Skilled: [
    "Field Engineer",
    "Field Operator",
    "PLC Engineer",
    "Chemist",
    "Fitter",
    "Welder",
    "Instrument Technician",
    "Electrician",
    "Driver",
  ],
  "Semi-Skilled": [
    "Mechanical Helper",
    "Instrument Helper",
    "Lab Boy",
    "Assistant Supervisor",
  ],
  "Un-Skilled": ["Helper", "Electrical Helper", "Horticulture Helper"],
};

export const compliancePoints = [
  {
    title: "Labour Licence",
    body: "Obtained under the Contract Labour (Regulation & Abolition) Act for every work place, before mobilisation.",
  },
  {
    title: "Provident Fund & ESI",
    body: "Registered and un-exempted. Monthly challans filed, with half-yearly and annual returns submitted on time.",
  },
  {
    title: "Minimum Wages",
    body: "Category-wise minimum wages applied and revised immediately on every Government notification, without waiting for a client instruction.",
  },
  {
    title: "Statutory Bonus & Leave Salary",
    body: "Paid as per Act, computed monthly on earned basic and shown separately on every wage slip.",
  },
  {
    title: "Wages by the 7th",
    body: "Every worker is paid by direct bank transfer by the 7th of the month — independent of when our own invoice is cleared.",
  },
  {
    title: "Form XIX Wage Slips",
    body: "A computer-generated Form XIX wage slip is issued to every worker, every month, with full earnings and deduction detail.",
  },
  {
    title: "Employee Compensation Policy",
    body: "Workmen's compensation and insurance cover maintained in force for the full contract period.",
  },
  {
    title: "HSSE Compliance",
    body: "Mandatory PPE, refinery safety norms and same-day incident and near-miss reporting on every site.",
  },
];

export const stats = [
  { value: 11, suffix: "+", label: "Years" },
  { value: 14, suffix: "", label: "Contracts" },
  { value: 9, suffix: "", label: "Clients" },
  { value: 30, suffix: "+", label: "Trades" },
];

/** Shown on the home page. Dates only — no claims about duration. */
export const timeline = [
  { year: "2015", text: "Mechanical erection, testing and commissioning of a 10 MLD STP at Sriganganagar." },
  { year: "2016", text: "PSC pipeline laying for a 26 MLD STP at Jhansi for UP Jal Nigam. Mechanical painting for Triveni Engineering at Bathinda." },
  { year: "2017", text: "First direct contract with HPCL-Mittal Energy Ltd at the Guru Gobind Singh Refinery." },
  { year: "2018", text: "Manpower, guest-house and transport contracts with SUEZ India. Manpower and housekeeping for Engineers India Ltd on the BS-VI project." },
  { year: "2019", text: "HMEL renews the raw water channel contract." },
  { year: "2022", text: "HMEL awards the channel work again, as an annual rate contract." },
  { year: "2025", text: "O&M manpower contract with Hindustan Zinc Ltd at the Zinc Smelter, Debari." },
];

/** Single-page anchors. About sits under Home rather than its own tab. */
export const navigation = [
  { href: "#top", label: "Home" },
  { href: "#services", label: "Services" },
  { href: "#projects", label: "Projects" },
  { href: "#careers", label: "Careers" },
  { href: "#contact", label: "Contact" },
];
