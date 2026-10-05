/**
 * Profile dropdown/number fields and the counsellor discussion fields that
 * can be list columns (keys match the API's `pf.` / `cf.` filter and export keys).
 */
export const PROFILE_COLUMNS: { key: string; label: string }[] = [
  { key: 'gender', label: 'Gender' },
  { key: 'state', label: 'Current State' },
  { key: 'city', label: 'Current City' },
  { key: 'guardianRelationship', label: 'Guardian Relationship' },
  { key: 'class10Year', label: 'Class 10th Year' },
  { key: 'class10Score', label: 'Class 10th Score' },
  { key: 'class12Year', label: 'Class 12th Year' },
  { key: 'class12Score', label: 'Class 12th Score' },
  { key: 'ugQualification', label: 'UG Qualification' },
  { key: 'ugStatus', label: 'UG Status' },
  { key: 'ugScore', label: 'UG Score' },
  { key: 'ugYear', label: 'UG Year of Passing' },
  { key: 'higherQualification', label: 'Higher Qualification' },
  { key: 'employmentStatus', label: 'Employment Status' },
  { key: 'experienceYears', label: 'Experience (years)' },
]

export const DISCUSSION_COLUMNS: { key: string; label: string }[] = [
  { key: 'parentInvolved', label: 'CF 1: Parent involved' },
  { key: 'decisionInfluencer', label: 'CF 2: Decision influencer' },
  { key: 'jobAspirationDomain', label: 'CF 3: Job aspiration domain' },
  { key: 'employmentStatus', label: 'CF 4: Fresher / Working' },
  { key: 'currentCompany', label: 'CF 5: Company' },
  { key: 'currentSalary', label: 'CF 6: Salary (INR/month)' },
  { key: 'experienceRelevant', label: 'CF 7: Experience relevant' },
  { key: 'candidateDecisionLevel', label: 'CF 8: Candidate decision level' },
  { key: 'parentsDecisionLevel', label: "CF 9: Parents' decision level" },
  { key: 'qualificationInterestLevel', label: 'CF 10: Qualification interest' },
  { key: 'oneYearProgramInterest', label: 'CF 11: 1-year program interest' },
  { key: 'careerDiscussant', label: 'CF 12: Discusses career with' },
  { key: 'professionalCoursesInterest', label: 'CF 13: Professional courses' },
  { key: 'preferredQualification', label: 'CF 14: Preferred qualification' },
  { key: 'expertDiscussion', label: 'CF 15: Expert one-on-one' },
  { key: 'familySize', label: 'CF 16: Family size' },
  { key: 'earningMembers', label: 'CF 17: Earning members' },
  { key: 'canPayIndependently', label: 'CF 20: Can pay independently' },
  { key: 'coApplicantOccupation', label: 'CF 21: Co-applicant job/business' },
  { key: 'coApplicantEarnings', label: 'CF 22: Co-applicant earnings' },
  { key: 'existingLoan', label: 'CF 24: Existing loan' },
  { key: 'loanDefault', label: 'CF 25: Loan default history' },
  { key: 'loanInterest', label: 'CF 26: Loan interest' },
]
