export interface Aspect {
  name: string;
  status: string;
  detail?: string;
}

export interface PeriodResult {
  title: string;
  subtitle: string;
  description: string;
  score: number;
  aspects: Aspect[];
}

export interface EnergyResult {
  dayMaster: string;
  bazi: string;
  periods: {
    yearly: PeriodResult;
    monthly: PeriodResult;
    daily: PeriodResult;
    hourly: PeriodResult;
  };
}

export interface UserInput {
  gender: string;
  birthYear: number;
  birthMonth: number;
  birthDay: number;
  birthHour?: number;
  province: string;
  city: string;
}

export interface TargetTime {
  targetYear: number;
  targetMonth: number;
  targetDay: number;
  targetHour: string;
}

