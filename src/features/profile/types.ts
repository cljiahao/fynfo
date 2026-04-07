export type ResidencyStatus = 'resident' | 'non_resident';

export interface ProfileData {
  birthYear: number | null;
  isNsman: boolean;
  residencyStatus: ResidencyStatus;
}
