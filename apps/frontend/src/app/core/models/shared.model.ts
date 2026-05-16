export interface Picture {
  baseUrl: string;
  path: string;
}

export interface TargetCompanySummary {
  id?: string;
  name?: string | null;
  picture?: Picture | null;
}

export interface TargetType {
  company: string | TargetCompanySummary;
}

export interface TargetInput {
  company: string;
  pos?: string | null;
}
