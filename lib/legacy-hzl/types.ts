export type Site = {
  id: string;
  code: string;
  name: string;
  client_name: string | null;
  principal_employer: string | null;
  city: string | null;
  state: string | null;
  started_on: string | null;
  is_active: boolean;
};

export type SkillGrade =
  | "UNSKILLED"
  | "SEMI-SKILLED"
  | "SKILLED"
  | "HIGHLY SKILLED"
  | "STAFF";

export type Employee = {
  id: string;
  site_id: string;
  emp_code: string | null;
  full_name: string;
  father_name: string | null;
  gender: string | null;
  dob: string | null;
  mobile: string | null;
  email: string | null;
  address: string | null;
  designation: string | null;
  category: SkillGrade | null;
  doj: string | null;
  dol: string | null;
  status: "active" | "left" | "transferred";
  aadhaar_last4: string | null;
  uan: string | null;
  pf_account_no: string | null;
  esi_number: string | null;
  pf_applicable: boolean;
  esi_applicable: boolean;
  bank_name: string | null;
  bank_account_no: string | null;
  ifsc: string | null;
  notes: string | null;
};

export type EmployeeDocument = {
  id: string;
  employee_id: string;
  type: string;
  label: string | null;
  file_path: string;
  file_size: number | null;
  mime_type: string | null;
  uploaded_at: string;
};

export const SKILL_GRADES: SkillGrade[] = [
  "UNSKILLED",
  "SEMI-SKILLED",
  "SKILLED",
  "HIGHLY SKILLED",
  "STAFF",
];

export const DOCUMENT_TYPES = [
  { value: "aadhaar", label: "Aadhaar" },
  { value: "pan", label: "PAN" },
  { value: "bank_proof", label: "Bank proof" },
  { value: "photo", label: "Photograph" },
  { value: "medical", label: "Medical" },
  { value: "gate_pass", label: "Gate pass" },
  { value: "police_verification", label: "Police verification" },
  { value: "safety_training", label: "Safety training" },
  { value: "pf_nomination", label: "PF nomination" },
  { value: "qualification", label: "Qualification" },
  { value: "experience", label: "Experience" },
  { value: "other", label: "Other" },
] as const;
