"""Option lists and limits for the student profile form (Deep Dive: Lead Management §4.2)."""
from datetime import date

GENDERS = ['Male', 'Female', 'Other']

# #8: Indian states + UTs master.
INDIAN_STATES = [
    'Andaman and Nicobar Islands', 'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chandigarh',
    'Chhattisgarh', 'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 'Goa', 'Gujarat', 'Haryana',
    'Himachal Pradesh', 'Jammu and Kashmir', 'Jharkhand', 'Karnataka', 'Kerala', 'Ladakh', 'Lakshadweep',
    'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Puducherry',
    'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand',
    'West Bengal',
]

RELATIONSHIPS = ['Father', 'Mother', 'Guardian', 'Other']  # #13
GRADE_TYPES = ['Percentage', 'CGPA']
MEDIUMS = ['English', 'Other']
UG_QUALIFICATIONS = ['B.Com', 'BBA', 'BMS']
QUALIFICATION_STATUSES = ['Completed', 'Pursuing']
EMPLOYMENT_STATUSES = ['Fresher', 'Experienced']

MIN_PASSING_YEAR = 1990  # #16
MIN_AGE, MAX_AGE = 17, 40  # #5


def max_pursuing_year() -> int:
    """#26: a future UG year is allowed only while Pursuing — capped 5 years ahead (not in the doc)."""
    return date.today().year + 5


# #42: the declaration stores its text version with the timestamp.
DECLARATION_VERSION = 'v1'
DECLARATION_TEXT = 'I declare that the information provided in this form is true and correct to the best of my knowledge.'

# Dropdown / number profile fields usable as list filters, columns and export columns (GL-34/38).
# key → (path inside LeadProfile JSON, type)
PROFILE_FILTER_FIELDS = {
    'gender': ('personal__gender', 'choice'),
    'state': ('personal__state', 'choice'),
    'city': ('personal__city', 'text'),
    'guardianRelationship': ('guardian__relationship', 'choice'),
    'class10Year': ('academic__class10__yearOfPassing', 'number'),
    'class10GradeType': ('academic__class10__gradeType', 'choice'),
    'class10Score': ('academic__class10__score', 'number'),
    'class10Medium': ('academic__class10__medium', 'choice'),
    'class12Year': ('academic__class12__yearOfPassing', 'number'),
    'class12GradeType': ('academic__class12__gradeType', 'choice'),
    'class12Score': ('academic__class12__score', 'number'),
    'class12Medium': ('academic__class12__medium', 'choice'),
    'ugQualification': ('academic__ug__qualification', 'choice'),
    'ugStatus': ('academic__ug__status', 'choice'),
    'ugScore': ('academic__ug__score', 'number'),
    'ugYear': ('academic__ug__yearOfPassing', 'number'),
    'ugMedium': ('academic__ug__medium', 'choice'),
    'higherQualification': ('academic__higherQualification__has', 'bool'),
    'employmentStatus': ('work__employmentStatus', 'choice'),
    'experienceYears': ('work__experienceYears', 'number'),
}

PROFILE_FIELD_LABELS = {
    'gender': 'Gender', 'state': 'Current State', 'city': 'Current City', 'guardianRelationship': 'Guardian Relationship',
    'class10Year': 'Class 10th Year', 'class10GradeType': 'Class 10th Grade Type', 'class10Score': 'Class 10th Score',
    'class10Medium': 'Class 10th Medium', 'class12Year': 'Class 12th Year', 'class12GradeType': 'Class 12th Grade Type',
    'class12Score': 'Class 12th Score', 'class12Medium': 'Class 12th Medium', 'ugQualification': 'UG Qualification',
    'ugStatus': 'UG Status', 'ugScore': 'UG Score', 'ugYear': 'UG Year of Passing', 'ugMedium': 'Medium of Instruction',
    'higherQualification': 'Higher Qualification', 'employmentStatus': 'Employment Status',
    'experienceYears': 'Experience (years)',
}

# #9 Current City: filtered by state; "Other" opens a text box.
CITIES_BY_STATE = {
    'Andaman and Nicobar Islands': ['Port Blair'],
    'Andhra Pradesh': ['Visakhapatnam', 'Vijayawada', 'Guntur', 'Nellore', 'Tirupati', 'Kakinada'],
    'Arunachal Pradesh': ['Itanagar', 'Naharlagun'],
    'Assam': ['Guwahati', 'Dibrugarh', 'Silchar', 'Jorhat'],
    'Bihar': ['Patna', 'Gaya', 'Bhagalpur', 'Muzaffarpur', 'Darbhanga'],
    'Chandigarh': ['Chandigarh'],
    'Chhattisgarh': ['Raipur', 'Bhilai', 'Bilaspur', 'Durg'],
    'Dadra and Nagar Haveli and Daman and Diu': ['Daman', 'Silvassa', 'Diu'],
    'Delhi': ['New Delhi', 'Delhi'],
    'Goa': ['Panaji', 'Margao', 'Vasco da Gama'],
    'Gujarat': ['Ahmedabad', 'Surat', 'Vadodara', 'Rajkot', 'Gandhinagar', 'Bhavnagar'],
    'Haryana': ['Gurugram', 'Faridabad', 'Panipat', 'Ambala', 'Karnal', 'Hisar'],
    'Himachal Pradesh': ['Shimla', 'Dharamshala', 'Solan', 'Mandi'],
    'Jammu and Kashmir': ['Srinagar', 'Jammu', 'Anantnag'],
    'Jharkhand': ['Ranchi', 'Jamshedpur', 'Dhanbad', 'Bokaro'],
    'Karnataka': ['Bengaluru', 'Mysuru', 'Mangaluru', 'Hubballi', 'Belagavi'],
    'Kerala': ['Thiruvananthapuram', 'Kochi', 'Kozhikode', 'Thrissur', 'Kollam'],
    'Ladakh': ['Leh', 'Kargil'],
    'Lakshadweep': ['Kavaratti'],
    'Madhya Pradesh': ['Indore', 'Bhopal', 'Jabalpur', 'Gwalior', 'Ujjain'],
    'Maharashtra': ['Mumbai', 'Pune', 'Nagpur', 'Thane', 'Nashik', 'Aurangabad', 'Navi Mumbai'],
    'Manipur': ['Imphal'],
    'Meghalaya': ['Shillong'],
    'Mizoram': ['Aizawl'],
    'Nagaland': ['Kohima', 'Dimapur'],
    'Odisha': ['Bhubaneswar', 'Cuttack', 'Rourkela', 'Puri'],
    'Puducherry': ['Puducherry', 'Karaikal'],
    'Punjab': ['Ludhiana', 'Amritsar', 'Jalandhar', 'Mohali', 'Patiala'],
    'Rajasthan': ['Jaipur', 'Jodhpur', 'Udaipur', 'Kota', 'Ajmer', 'Bikaner'],
    'Sikkim': ['Gangtok'],
    'Tamil Nadu': ['Chennai', 'Coimbatore', 'Madurai', 'Tiruchirappalli', 'Salem'],
    'Telangana': ['Hyderabad', 'Warangal', 'Nizamabad', 'Karimnagar'],
    'Tripura': ['Agartala'],
    'Uttar Pradesh': ['Lucknow', 'Kanpur', 'Noida', 'Ghaziabad', 'Agra', 'Varanasi', 'Prayagraj', 'Meerut'],
    'Uttarakhand': ['Dehradun', 'Haridwar', 'Haldwani', 'Rishikesh'],
    'West Bengal': ['Kolkata', 'Howrah', 'Durgapur', 'Siliguri', 'Asansol'],
}
