// India states & union territories with their major cities — the single source
// of truth for every State/City field across the app (leads, users, forms…).
// Stored here as a typed dataset; swap for an API call later without changing
// the consumers (they use the helpers below).

export const STATES_CITIES: Record<string, string[]> = {
  "Andhra Pradesh": ["Visakhapatnam", "Vijayawada", "Guntur", "Nellore", "Tirupati", "Kakinada", "Rajahmundry", "Kurnool"],
  "Arunachal Pradesh": ["Itanagar", "Naharlagun", "Pasighat", "Tawang"],
  "Assam": ["Guwahati", "Silchar", "Dibrugarh", "Jorhat", "Nagaon", "Tinsukia"],
  "Bihar": ["Patna", "Gaya", "Bhagalpur", "Muzaffarpur", "Darbhanga", "Purnia"],
  "Chhattisgarh": ["Raipur", "Bhilai", "Bilaspur", "Korba", "Durg", "Raigarh"],
  "Goa": ["Panaji", "Margao", "Vasco da Gama", "Mapusa", "Ponda"],
  "Gujarat": ["Ahmedabad", "Surat", "Vadodara", "Rajkot", "Bhavnagar", "Jamnagar", "Gandhinagar", "Junagadh"],
  "Haryana": ["Gurugram", "Faridabad", "Panipat", "Ambala", "Karnal", "Hisar", "Rohtak"],
  "Himachal Pradesh": ["Shimla", "Dharamshala", "Solan", "Mandi", "Kullu", "Manali"],
  "Jharkhand": ["Ranchi", "Jamshedpur", "Dhanbad", "Bokaro", "Hazaribagh", "Deoghar"],
  "Karnataka": ["Bengaluru", "Mysuru", "Hubli", "Mangaluru", "Belagavi", "Davangere", "Ballari", "Shivamogga"],
  "Kerala": ["Kochi", "Thiruvananthapuram", "Kozhikode", "Thrissur", "Kollam", "Kannur", "Kottayam"],
  "Madhya Pradesh": ["Indore", "Bhopal", "Jabalpur", "Gwalior", "Ujjain", "Sagar", "Rewa"],
  "Maharashtra": ["Mumbai", "Pune", "Nagpur", "Nashik", "Thane", "Aurangabad", "Solapur", "Kolhapur", "Navi Mumbai"],
  "Manipur": ["Imphal", "Thoubal", "Bishnupur"],
  "Meghalaya": ["Shillong", "Tura", "Jowai"],
  "Mizoram": ["Aizawl", "Lunglei", "Champhai"],
  "Nagaland": ["Kohima", "Dimapur", "Mokokchung"],
  "Odisha": ["Bhubaneswar", "Cuttack", "Rourkela", "Berhampur", "Sambalpur", "Puri"],
  "Punjab": ["Ludhiana", "Amritsar", "Jalandhar", "Patiala", "Bathinda", "Mohali", "Pathankot"],
  "Rajasthan": ["Jaipur", "Jodhpur", "Udaipur", "Kota", "Ajmer", "Bikaner", "Bhilwara"],
  "Sikkim": ["Gangtok", "Namchi", "Gyalshing"],
  "Tamil Nadu": ["Chennai", "Coimbatore", "Madurai", "Tiruchirappalli", "Salem", "Tirunelveli", "Erode", "Vellore"],
  "Telangana": ["Hyderabad", "Warangal", "Nizamabad", "Karimnagar", "Khammam", "Secunderabad"],
  "Tripura": ["Agartala", "Udaipur", "Dharmanagar"],
  "Uttar Pradesh": ["Lucknow", "Kanpur", "Ghaziabad", "Agra", "Varanasi", "Meerut", "Prayagraj", "Noida", "Bareilly"],
  "Uttarakhand": ["Dehradun", "Haridwar", "Roorkee", "Haldwani", "Rishikesh", "Nainital"],
  "West Bengal": ["Kolkata", "Howrah", "Durgapur", "Asansol", "Siliguri", "Darjeeling"],
  // Union Territories
  "Andaman & Nicobar Islands": ["Port Blair"],
  "Chandigarh": ["Chandigarh"],
  "Dadra & Nagar Haveli and Daman & Diu": ["Daman", "Silvassa", "Diu"],
  "Delhi": ["New Delhi", "Delhi", "Dwarka", "Rohini", "Saket"],
  "Jammu & Kashmir": ["Srinagar", "Jammu", "Anantnag", "Baramulla"],
  "Ladakh": ["Leh", "Kargil"],
  "Lakshadweep": ["Kavaratti"],
  "Puducherry": ["Puducherry", "Karaikal", "Yanam"],
};

export const STATE_NAMES: string[] = Object.keys(STATES_CITIES);

/** Cities for a given state (empty list for unknown/blank state). */
export function citiesOf(state: string): string[] {
  return STATES_CITIES[state] ?? [];
}

/** Every city across all states, de-duplicated and sorted. */
export function allCities(): string[] {
  return Array.from(new Set(Object.values(STATES_CITIES).flat())).sort();
}

/** Reverse lookup: which state a city belongs to (first match). */
export function stateOfCity(city: string): string | undefined {
  return STATE_NAMES.find((s) => STATES_CITIES[s].includes(city));
}

export function isValidCity(state: string, city: string): boolean {
  return citiesOf(state).includes(city);
}
