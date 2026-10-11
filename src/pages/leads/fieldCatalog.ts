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
  { key: 'experienceYears', label: 'Experience (Years)' },
]

export const DISCUSSION_COLUMNS: { key: string; label: string }[] = [
  { key: 'parentInvolved', label: 'CF 1: Parent Involved' },
  { key: 'decisionInfluencer', label: 'CF 2: Decision Influencer' },
  { key: 'jobAspirationDomain', label: 'CF 3: Job Aspiration Domain' },
  { key: 'employmentStatus', label: 'CF 4: Fresher / Working' },
  { key: 'currentCompany', label: 'CF 5: Company' },
  { key: 'currentSalary', label: 'CF 6: Salary (INR/month)' },
  { key: 'experienceRelevant', label: 'CF 7: Experience Relevant' },
  { key: 'candidateDecisionLevel', label: 'CF 8: Candidate Decision Level' },
  { key: 'parentsDecisionLevel', label: "CF 9: Parents' decision level" },
  { key: 'qualificationInterestLevel', label: 'CF 10: Qualification Interest' },
  { key: 'oneYearProgramInterest', label: 'CF 11: 1-Year Program Interest' },
  { key: 'careerDiscussant', label: 'CF 12: Discusses Career With' },
  { key: 'professionalCoursesInterest', label: 'CF 13: Professional Courses' },
  { key: 'preferredQualification', label: 'CF 14: Preferred Qualification' },
  { key: 'expertDiscussion', label: 'CF 15: Expert One-on-One' },
  { key: 'familySize', label: 'CF 16: Family Size' },
  { key: 'earningMembers', label: 'CF 17: Earning Members' },
  { key: 'canPayIndependently', label: 'CF 20: Can Pay Independently' },
  { key: 'coApplicantOccupation', label: 'CF 21: Co-applicant Job/Business' },
  { key: 'coApplicantEarnings', label: 'CF 22: Co-applicant Earnings' },
  { key: 'existingLoan', label: 'CF 24: Existing Loan' },
  { key: 'loanDefault', label: 'CF 25: Loan Default History' },
  { key: 'loanInterest', label: 'CF 26: Loan Interest' },
]
