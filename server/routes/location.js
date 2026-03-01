const express = require('express');
const router = express.Router();
const axios = require('axios');

/**
 * ZIP code → city/state lookup using Zippopotam.us (free, no key needed)
 * Also validates and normalizes city/state input.
 */

// Common US state abbreviations
const STATE_ABBR = {
  'alabama': 'AL', 'alaska': 'AK', 'arizona': 'AZ', 'arkansas': 'AR',
  'california': 'CA', 'colorado': 'CO', 'connecticut': 'CT', 'delaware': 'DE',
  'florida': 'FL', 'georgia': 'GA', 'hawaii': 'HI', 'idaho': 'ID',
  'illinois': 'IL', 'indiana': 'IN', 'iowa': 'IA', 'kansas': 'KS',
  'kentucky': 'KY', 'louisiana': 'LA', 'maine': 'ME', 'maryland': 'MD',
  'massachusetts': 'MA', 'michigan': 'MI', 'minnesota': 'MN', 'mississippi': 'MS',
  'missouri': 'MO', 'montana': 'MT', 'nebraska': 'NE', 'nevada': 'NV',
  'new hampshire': 'NH', 'new jersey': 'NJ', 'new mexico': 'NM', 'new york': 'NY',
  'north carolina': 'NC', 'north dakota': 'ND', 'ohio': 'OH', 'oklahoma': 'OK',
  'oregon': 'OR', 'pennsylvania': 'PA', 'rhode island': 'RI', 'south carolina': 'SC',
  'south dakota': 'SD', 'tennessee': 'TN', 'texas': 'TX', 'utah': 'UT',
  'vermont': 'VT', 'virginia': 'VA', 'washington': 'WA', 'west virginia': 'WV',
  'wisconsin': 'WI', 'wyoming': 'WY', 'district of columbia': 'DC',
};

// Reverse lookup: abbreviation → full name
const STATE_NAMES = {};
for (const [name, code] of Object.entries(STATE_ABBR)) {
  STATE_NAMES[code] = name.replace(/\b\w/g, c => c.toUpperCase());
}

/**
 * GET /api/location/resolve?q=<zip or city, state>
 *
 * Accepts:
 *   - "46220"          → zip code lookup
 *   - "Indianapolis, IN"  → city/state parse
 *   - "Austin TX"        → city/state parse
 *   - "Miami, Florida"    → city/state parse
 *
 * Returns: { city, stateCode, stateName, zip?, source }
 */
router.get('/resolve', async (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q) {
    return res.status(400).json({ error: 'Query parameter "q" is required' });
  }

  // Check if it's a zip code (5 digits)
  const zipMatch = q.match(/^(\d{5})$/);
  if (zipMatch) {
    try {
      const resp = await axios.get(`https://api.zippopotam.us/us/${zipMatch[1]}`, {
        timeout: 5000,
      });
      const data = resp.data;
      const place = data.places?.[0];
      if (place) {
        return res.json({
          city: place['place name'],
          stateCode: place['state abbreviation'],
          stateName: place.state,
          zip: zipMatch[1],
          source: 'zip',
        });
      }
    } catch (err) {
      // Zip not found or API error
      return res.status(404).json({ error: `Could not find location for zip code ${zipMatch[1]}` });
    }
  }

  // Try to parse as "city, state" or "city state"
  const parsed = parseCityState(q);
  if (parsed) {
    return res.json({
      city: parsed.city,
      stateCode: parsed.stateCode,
      stateName: STATE_NAMES[parsed.stateCode] || parsed.stateCode,
      zip: null,
      source: 'citystate',
    });
  }

  return res.status(400).json({
    error: 'Please enter a 5-digit zip code or "City, State" (e.g. "Austin, TX" or "46220")',
  });
});

/**
 * Parse city/state from various formats:
 *   "Indianapolis, IN"
 *   "Austin TX"
 *   "Miami, Florida"
 *   "New York, NY"
 */
function parseCityState(input) {
  const text = input.trim();

  // Try "City, State" with comma
  const commaMatch = text.match(/^(.+?),\s*(.+)$/);
  if (commaMatch) {
    const city = commaMatch[1].trim();
    const statePart = commaMatch[2].trim();
    const stateCode = resolveState(statePart);
    if (stateCode && city.length > 1 && /[A-Za-z]/.test(city)) {
      return { city: capitalize(city), stateCode };
    }
  }

  // Try "City StateCode" (e.g. "Austin TX")
  const spaceCodeMatch = text.match(/^(.+?)\s+([A-Za-z]{2})$/);
  if (spaceCodeMatch) {
    const city = spaceCodeMatch[1].trim();
    const code = spaceCodeMatch[2].toUpperCase();
    if (STATE_NAMES[code]) {
      return { city: capitalize(city), stateCode: code };
    }
  }

  // Try "City StateName" (e.g. "Miami Florida")
  for (const [name, code] of Object.entries(STATE_ABBR)) {
    const re = new RegExp(`^(.+?)\\s+${name}$`, 'i');
    const m = text.match(re);
    if (m) {
      return { city: capitalize(m[1].trim()), stateCode: code };
    }
  }

  return null;
}

function resolveState(input) {
  const lower = input.toLowerCase().trim();
  // Direct abbreviation (2 letters)
  if (lower.length === 2) {
    const code = lower.toUpperCase();
    if (STATE_NAMES[code]) return code;
  }
  // Full state name
  if (STATE_ABBR[lower]) return STATE_ABBR[lower];
  return null;
}

function capitalize(str) {
  return str.replace(/\b\w/g, c => c.toUpperCase());
}

// ──────────────────────────────────────────────────────────────────────
// GET /api/location/reverse-geocode?lat=X&lng=Y
// Converts map center coordinates to city + state using Nominatim (free)
// ──────────────────────────────────────────────────────────────────────

const reverseCache = new Map();

router.get('/reverse-geocode', async (req, res) => {
  const { lat, lng } = req.query;
  if (!lat || !lng) {
    return res.status(400).json({ error: 'lat and lng are required' });
  }

  // Round to 2 decimals for caching (~1km precision)
  const cacheKey = `${parseFloat(lat).toFixed(2)},${parseFloat(lng).toFixed(2)}`;
  if (reverseCache.has(cacheKey)) {
    return res.json(reverseCache.get(cacheKey));
  }

  try {
    const resp = await axios.get('https://nominatim.openstreetmap.org/reverse', {
      params: {
        lat: parseFloat(lat),
        lon: parseFloat(lng),
        format: 'json',
        zoom: 10,
        addressdetails: 1,
      },
      headers: {
        'User-Agent': 'HomeMatch/1.0 (tours@homematch.app)',
      },
      timeout: 5000,
    });

    const addr = resp.data?.address || {};
    const cityName = addr.city || addr.town || addr.village || addr.hamlet || addr.county || '';
    const stateName = addr.state || '';
    const stateCode = resolveState(stateName) || stateName;

    const result = {
      city: cityName,
      stateCode,
      stateName: STATE_NAMES[stateCode] || stateName,
    };

    reverseCache.set(cacheKey, result);

    // Keep cache from growing unbounded
    if (reverseCache.size > 500) {
      const firstKey = reverseCache.keys().next().value;
      reverseCache.delete(firstKey);
    }

    res.json(result);
  } catch (err) {
    console.error('Reverse geocode error:', err.message);
    res.status(500).json({ error: 'Failed to reverse geocode location' });
  }
});

// ──────────────────────────────────────────────────────────────────────
// GET /api/location/cities?state=<XX>&q=<optional filter>
// Returns a list of cities/towns for a state (for multi-select picker).
// Uses Nominatim + a curated top-cities list. Caches aggressively.
// ──────────────────────────────────────────────────────────────────────

const citiesCache = new Map();

// Top/popular cities per state — ensures immediate results without API call
const TOP_CITIES = {
  AL: ['Birmingham', 'Montgomery', 'Huntsville', 'Mobile', 'Tuscaloosa', 'Hoover', 'Dothan', 'Auburn', 'Decatur', 'Madison', 'Florence', 'Gadsden', 'Vestavia Hills', 'Prattville', 'Phenix City', 'Alabaster', 'Opelika', 'Enterprise', 'Homewood', 'Northport'],
  AK: ['Anchorage', 'Fairbanks', 'Juneau', 'Sitka', 'Ketchikan', 'Wasilla', 'Kenai', 'Kodiak', 'Bethel', 'Palmer', 'Homer', 'Soldotna', 'Valdez', 'Nome', 'Barrow', 'Seward'],
  AZ: ['Phoenix', 'Tucson', 'Mesa', 'Chandler', 'Scottsdale', 'Glendale', 'Gilbert', 'Tempe', 'Peoria', 'Surprise', 'Yuma', 'Avondale', 'Goodyear', 'Flagstaff', 'Buckeye', 'Lake Havasu City', 'Maricopa', 'Casa Grande', 'Sierra Vista', 'Prescott'],
  AR: ['Little Rock', 'Fort Smith', 'Fayetteville', 'Springdale', 'Jonesboro', 'Rogers', 'Conway', 'North Little Rock', 'Bentonville', 'Pine Bluff', 'Hot Springs', 'Benton', 'Texarkana', 'Sherwood', 'Jacksonville', 'Cabot', 'Paragould', 'Russellville', 'Van Buren', 'Maumelle'],
  CA: ['Los Angeles', 'San Francisco', 'San Diego', 'San Jose', 'Sacramento', 'Fresno', 'Oakland', 'Long Beach', 'Bakersfield', 'Anaheim', 'Santa Ana', 'Riverside', 'Stockton', 'Irvine', 'Chula Vista', 'Fremont', 'San Bernardino', 'Modesto', 'Moreno Valley', 'Fontana'],
  CO: ['Denver', 'Colorado Springs', 'Aurora', 'Fort Collins', 'Lakewood', 'Thornton', 'Arvada', 'Westminster', 'Pueblo', 'Centennial', 'Boulder', 'Greeley', 'Longmont', 'Loveland', 'Grand Junction', 'Broomfield', 'Castle Rock', 'Parker', 'Commerce City', 'Brighton'],
  CT: ['Bridgeport', 'New Haven', 'Stamford', 'Hartford', 'Waterbury', 'Norwalk', 'Danbury', 'New Britain', 'West Hartford', 'Greenwich', 'Fairfield', 'Hamden', 'Bristol', 'Meriden', 'Manchester', 'West Haven', 'Milford', 'Stratford', 'East Hartford', 'Middletown'],
  DE: ['Wilmington', 'Dover', 'Newark', 'Middletown', 'Bear', 'Glasgow', 'Hockessin', 'Brookside', 'Smyrna', 'Milford', 'Seaford', 'Georgetown', 'Elsmere', 'New Castle', 'Millsboro', 'Lewes', 'Camden', 'Laurel', 'Harrington', 'Rehoboth Beach'],
  FL: ['Miami', 'Orlando', 'Tampa', 'Jacksonville', 'St. Petersburg', 'Fort Lauderdale', 'Hialeah', 'Tallahassee', 'Cape Coral', 'Port St. Lucie', 'Pembroke Pines', 'Hollywood', 'Gainesville', 'Miramar', 'Coral Springs', 'Clearwater', 'Palm Bay', 'Lakeland', 'West Palm Beach', 'Pompano Beach'],
  GA: ['Atlanta', 'Augusta', 'Columbus', 'Savannah', 'Athens', 'Sandy Springs', 'Roswell', 'Macon', 'Johns Creek', 'Albany', 'Warner Robins', 'Alpharetta', 'Marietta', 'Valdosta', 'Smyrna', 'Dunwoody', 'Brookhaven', 'Peachtree City', 'Kennesaw', 'Lawrenceville'],
  HI: ['Honolulu', 'Pearl City', 'Hilo', 'Kailua', 'Waipahu', 'Kaneohe', 'Mililani Town', 'Kahului', 'Ewa Gentry', 'Kapolei', 'Kihei', 'Wailuku', 'Lahaina', 'Aiea', 'Kapaa'],
  ID: ['Boise', 'Meridian', 'Nampa', 'Idaho Falls', 'Caldwell', 'Pocatello', 'Coeur d\'Alene', 'Twin Falls', 'Post Falls', 'Lewiston', 'Eagle', 'Kuna', 'Star', 'Moscow', 'Rexburg', 'Mountain Home', 'Ammon', 'Chubbuck', 'Hayden', 'Blackfoot'],
  IL: ['Chicago', 'Aurora', 'Naperville', 'Joliet', 'Rockford', 'Springfield', 'Elgin', 'Peoria', 'Champaign', 'Waukegan', 'Cicero', 'Bloomington', 'Arlington Heights', 'Evanston', 'Decatur', 'Schaumburg', 'Bolingbrook', 'Palatine', 'Skokie', 'Des Plaines'],
  IN: ['Indianapolis', 'Fort Wayne', 'Evansville', 'South Bend', 'Carmel', 'Fishers', 'Bloomington', 'Hammond', 'Gary', 'Lafayette', 'Muncie', 'Terre Haute', 'Kokomo', 'Noblesville', 'Anderson', 'Greenwood', 'Elkhart', 'Mishawaka', 'Lawrence', 'Jeffersonville', 'Columbus', 'Portage', 'New Albany', 'Richmond', 'Westfield', 'Valparaiso', 'Goshen', 'Michigan City', 'Merrillville', 'Crown Point', 'Brownsburg', 'Avon', 'Zionsville', 'Plainfield', 'Franklin', 'Granger', 'Shelbyville', 'East Chicago', 'Marion', 'Logansport', 'Seymour', 'Crawfordsville', 'Hobart', 'Highland', 'Schererville', 'St. John', 'Cedar Lake', 'Dyer', 'Martinsville', 'Greenfield', 'New Castle', 'Connersville', 'Vincennes', 'Jasper', 'Bedford', 'Warsaw', 'Auburn', 'Huntington', 'Lebanon', 'Speedway', 'McCordsville', 'Fortville', 'Whitestown', 'Bargersville', 'Pendleton', 'Mooresville', 'Cicero', 'Pittsboro', 'Danville', 'Whiteland'],
  IA: ['Des Moines', 'Cedar Rapids', 'Davenport', 'Sioux City', 'Iowa City', 'Waterloo', 'Council Bluffs', 'Ames', 'West Des Moines', 'Dubuque', 'Ankeny', 'Urbandale', 'Cedar Falls', 'Marion', 'Bettendorf', 'Mason City', 'Marshalltown', 'Clinton', 'Burlington', 'Ottumwa'],
  KS: ['Wichita', 'Overland Park', 'Kansas City', 'Olathe', 'Topeka', 'Lawrence', 'Shawnee', 'Manhattan', 'Lenexa', 'Salina', 'Hutchinson', 'Leavenworth', 'Leawood', 'Dodge City', 'Garden City', 'Emporia', 'Derby', 'Prairie Village', 'Junction City', 'Hays'],
  KY: ['Louisville', 'Lexington', 'Bowling Green', 'Owensboro', 'Covington', 'Richmond', 'Georgetown', 'Florence', 'Hopkinsville', 'Nicholasville', 'Elizabethtown', 'Henderson', 'Frankfort', 'Independence', 'Jeffersontown', 'Paducah', 'Radcliff', 'Ashland', 'Madisonville', 'Winchester'],
  LA: ['New Orleans', 'Baton Rouge', 'Shreveport', 'Lafayette', 'Lake Charles', 'Kenner', 'Bossier City', 'Monroe', 'Alexandria', 'Houma', 'Marrero', 'New Iberia', 'Slidell', 'Central', 'Ruston', 'Sulphur', 'Hammond', 'Harvey', 'Natchitoches', 'Zachary'],
  ME: ['Portland', 'Lewiston', 'Bangor', 'South Portland', 'Auburn', 'Biddeford', 'Sanford', 'Brunswick', 'Scarborough', 'Westbrook', 'Saco', 'Augusta', 'Windham', 'Gorham', 'Kennebunk', 'Waterville', 'Falmouth', 'Old Orchard Beach', 'Standish', 'Kittery'],
  MD: ['Baltimore', 'Columbia', 'Germantown', 'Silver Spring', 'Waldorf', 'Ellicott City', 'Frederick', 'Glen Burnie', 'Rockville', 'Gaithersburg', 'Bethesda', 'Dundalk', 'Towson', 'Bowie', 'Aspen Hill', 'Wheaton', 'Bel Air', 'Potomac', 'Severn', 'Odenton'],
  MA: ['Boston', 'Worcester', 'Springfield', 'Cambridge', 'Lowell', 'Brockton', 'New Bedford', 'Quincy', 'Lynn', 'Fall River', 'Newton', 'Somerville', 'Lawrence', 'Framingham', 'Haverhill', 'Waltham', 'Brookline', 'Plymouth', 'Medford', 'Malden'],
  MI: ['Detroit', 'Grand Rapids', 'Warren', 'Sterling Heights', 'Ann Arbor', 'Lansing', 'Flint', 'Dearborn', 'Livonia', 'Clinton Township', 'Canton', 'Westland', 'Troy', 'Farmington Hills', 'Kalamazoo', 'Wyoming', 'Southfield', 'Rochester Hills', 'Taylor', 'Pontiac'],
  MN: ['Minneapolis', 'Saint Paul', 'Rochester', 'Duluth', 'Bloomington', 'Brooklyn Park', 'Plymouth', 'Maple Grove', 'Woodbury', 'St. Cloud', 'Eagan', 'Eden Prairie', 'Coon Rapids', 'Burnsville', 'Blaine', 'Lakeville', 'Minnetonka', 'Apple Valley', 'Edina', 'Mankato'],
  MS: ['Jackson', 'Gulfport', 'Southaven', 'Hattiesburg', 'Biloxi', 'Meridian', 'Tupelo', 'Olive Branch', 'Greenville', 'Horn Lake', 'Clinton', 'Pearl', 'Madison', 'Starkville', 'Ridgeland', 'Columbus', 'Vicksburg', 'Pascagoula', 'Brandon', 'Oxford'],
  MO: ['Kansas City', 'St. Louis', 'Springfield', 'Columbia', 'Independence', 'Lee\'s Summit', 'O\'Fallon', 'St. Joseph', 'St. Charles', 'Blue Springs', 'St. Peters', 'Florissant', 'Joplin', 'Chesterfield', 'Jefferson City', 'Cape Girardeau', 'Wildwood', 'University City', 'Ballwin', 'Wentzville'],
  MT: ['Billings', 'Missoula', 'Great Falls', 'Bozeman', 'Butte', 'Helena', 'Kalispell', 'Havre', 'Anaconda', 'Miles City', 'Belgrade', 'Livingston', 'Laurel', 'Whitefish', 'Lewistown', 'Sidney'],
  NE: ['Omaha', 'Lincoln', 'Bellevue', 'Grand Island', 'Kearney', 'Fremont', 'Hastings', 'Norfolk', 'North Platte', 'Columbus', 'Papillion', 'La Vista', 'Scottsbluff', 'South Sioux City', 'Beatrice', 'Lexington', 'Gering', 'Alliance', 'Blair', 'York'],
  NV: ['Las Vegas', 'Henderson', 'Reno', 'North Las Vegas', 'Sparks', 'Carson City', 'Fernley', 'Elko', 'Mesquite', 'Boulder City', 'Fallon', 'Winnemucca', 'West Wendover', 'Ely', 'Yerington', 'Pahrump'],
  NH: ['Manchester', 'Nashua', 'Concord', 'Dover', 'Rochester', 'Keene', 'Portsmouth', 'Laconia', 'Lebanon', 'Claremont', 'Derry', 'Londonderry', 'Hudson', 'Bedford', 'Merrimack', 'Salem', 'Hanover', 'Amherst', 'Exeter', 'Hampton'],
  NJ: ['Newark', 'Jersey City', 'Paterson', 'Elizabeth', 'Trenton', 'Clifton', 'Camden', 'Passaic', 'Union City', 'Bayonne', 'East Orange', 'Vineland', 'New Brunswick', 'Hoboken', 'Perth Amboy', 'Plainfield', 'West New York', 'Hackensack', 'Sayreville', 'Kearny'],
  NM: ['Albuquerque', 'Las Cruces', 'Rio Rancho', 'Santa Fe', 'Roswell', 'Farmington', 'Clovis', 'Hobbs', 'Alamogordo', 'Carlsbad', 'Gallup', 'Deming', 'Los Lunas', 'Chaparral', 'Sunland Park', 'Las Vegas', 'Portales', 'Los Alamos', 'Artesia', 'Lovington'],
  NY: ['New York', 'Buffalo', 'Rochester', 'Yonkers', 'Syracuse', 'Albany', 'New Rochelle', 'Mount Vernon', 'Schenectady', 'Utica', 'White Plains', 'Troy', 'Niagara Falls', 'Binghamton', 'Freeport', 'Long Beach', 'Ithaca', 'Saratoga Springs', 'Poughkeepsie', 'Jamestown'],
  NC: ['Charlotte', 'Raleigh', 'Greensboro', 'Durham', 'Winston-Salem', 'Fayetteville', 'Cary', 'Wilmington', 'High Point', 'Concord', 'Greenville', 'Asheville', 'Gastonia', 'Jacksonville', 'Chapel Hill', 'Huntersville', 'Apex', 'Burlington', 'Kannapolis', 'Mooresville'],
  ND: ['Fargo', 'Bismarck', 'Grand Forks', 'Minot', 'West Fargo', 'Williston', 'Dickinson', 'Mandan', 'Jamestown', 'Wahpeton', 'Devils Lake', 'Watford City', 'Valley City', 'Grafton', 'Beulah', 'Rugby'],
  OH: ['Columbus', 'Cleveland', 'Cincinnati', 'Toledo', 'Akron', 'Dayton', 'Parma', 'Canton', 'Youngstown', 'Lorain', 'Hamilton', 'Springfield', 'Kettering', 'Elyria', 'Lakewood', 'Cuyahoga Falls', 'Dublin', 'Beavercreek', 'Middletown', 'Newark'],
  OK: ['Oklahoma City', 'Tulsa', 'Norman', 'Broken Arrow', 'Edmond', 'Lawton', 'Moore', 'Midwest City', 'Enid', 'Stillwater', 'Muskogee', 'Bartlesville', 'Owasso', 'Shawnee', 'Yukon', 'Bixby', 'Jenks', 'Ardmore', 'Ponca City', 'Duncan'],
  OR: ['Portland', 'Salem', 'Eugene', 'Gresham', 'Hillsboro', 'Beaverton', 'Bend', 'Medford', 'Springfield', 'Corvallis', 'Albany', 'Tigard', 'Lake Oswego', 'Keizer', 'Grants Pass', 'Oregon City', 'McMinnville', 'Redmond', 'Tualatin', 'West Linn'],
  PA: ['Philadelphia', 'Pittsburgh', 'Allentown', 'Reading', 'Scranton', 'Bethlehem', 'Lancaster', 'Harrisburg', 'York', 'Wilkes-Barre', 'Chester', 'Erie', 'Easton', 'Lebanon', 'Hazleton', 'New Castle', 'Johnstown', 'McKeesport', 'Williamsport', 'State College'],
  RI: ['Providence', 'Warwick', 'Cranston', 'Pawtucket', 'East Providence', 'Woonsocket', 'Coventry', 'Cumberland', 'North Providence', 'South Kingstown', 'West Warwick', 'Johnston', 'North Kingstown', 'Newport', 'Bristol', 'Westerly'],
  SC: ['Charleston', 'Columbia', 'North Charleston', 'Mount Pleasant', 'Rock Hill', 'Greenville', 'Summerville', 'Goose Creek', 'Hilton Head Island', 'Florence', 'Spartanburg', 'Sumter', 'Myrtle Beach', 'Greer', 'Aiken', 'Anderson', 'Mauldin', 'Simpsonville', 'Easley', 'Bluffton'],
  SD: ['Sioux Falls', 'Rapid City', 'Aberdeen', 'Brookings', 'Watertown', 'Mitchell', 'Yankton', 'Huron', 'Pierre', 'Spearfish', 'Vermillion', 'Brandon', 'Box Elder', 'Harrisburg', 'Sturgis', 'Madison'],
  TN: ['Nashville', 'Memphis', 'Knoxville', 'Chattanooga', 'Clarksville', 'Murfreesboro', 'Franklin', 'Jackson', 'Johnson City', 'Bartlett', 'Hendersonville', 'Kingsport', 'Collierville', 'Smyrna', 'Cleveland', 'Brentwood', 'Germantown', 'Spring Hill', 'Cookeville', 'Gallatin'],
  TX: ['Houston', 'San Antonio', 'Dallas', 'Austin', 'Fort Worth', 'El Paso', 'Arlington', 'Corpus Christi', 'Plano', 'Laredo', 'Lubbock', 'Garland', 'Irving', 'Frisco', 'McKinney', 'Amarillo', 'Grand Prairie', 'Brownsville', 'Pasadena', 'Killeen'],
  UT: ['Salt Lake City', 'West Valley City', 'Provo', 'West Jordan', 'Orem', 'Sandy', 'Ogden', 'St. George', 'Layton', 'South Jordan', 'Lehi', 'Millcreek', 'Taylorsville', 'Logan', 'Murray', 'Draper', 'Bountiful', 'Riverton', 'Roy', 'Spanish Fork'],
  VT: ['Burlington', 'South Burlington', 'Rutland', 'Barre', 'Montpelier', 'Winooski', 'St. Albans', 'Newport', 'Vergennes', 'Bennington', 'Brattleboro', 'Milton', 'Essex', 'Colchester', 'Williston', 'Shelburne'],
  VA: ['Virginia Beach', 'Norfolk', 'Chesapeake', 'Richmond', 'Newport News', 'Alexandria', 'Hampton', 'Roanoke', 'Portsmouth', 'Suffolk', 'Lynchburg', 'Centreville', 'Dale City', 'Arlington', 'Manassas', 'Ashburn', 'Blacksburg', 'Leesburg', 'Charlottesville', 'Danville'],
  WA: ['Seattle', 'Spokane', 'Tacoma', 'Vancouver', 'Bellevue', 'Kent', 'Everett', 'Renton', 'Federal Way', 'Spokane Valley', 'Kirkland', 'Bellingham', 'Auburn', 'Redmond', 'Pasco', 'Marysville', 'Lakewood', 'Kennewick', 'Sammamish', 'Olympia'],
  WV: ['Charleston', 'Huntington', 'Morgantown', 'Parkersburg', 'Wheeling', 'Weirton', 'Fairmont', 'Martinsburg', 'Beckley', 'Clarksburg', 'South Charleston', 'St. Albans', 'Vienna', 'Bluefield', 'Elkins', 'Nitro', 'Dunbar', 'Hurricane', 'Princeton', 'Bridgeport'],
  WI: ['Milwaukee', 'Madison', 'Green Bay', 'Kenosha', 'Racine', 'Appleton', 'Waukesha', 'Oshkosh', 'Eau Claire', 'Janesville', 'West Allis', 'La Crosse', 'Sheboygan', 'Wauwatosa', 'Fond du Lac', 'New Berlin', 'Brookfield', 'Beloit', 'Greenfield', 'Manitowoc'],
  WY: ['Cheyenne', 'Casper', 'Laramie', 'Gillette', 'Rock Springs', 'Sheridan', 'Green River', 'Evanston', 'Riverton', 'Jackson', 'Cody', 'Rawlins', 'Lander', 'Torrington', 'Powell', 'Douglas'],
  DC: ['Washington'],
};

router.get('/cities', (req, res) => {
  const stateCode = (req.query.state || '').trim().toUpperCase();
  const filter = (req.query.q || '').trim().toLowerCase();

  if (!stateCode || !TOP_CITIES[stateCode]) {
    return res.status(400).json({ error: 'Valid state code is required' });
  }

  let cities = TOP_CITIES[stateCode];

  // Filter if query provided
  if (filter) {
    cities = cities.filter((c) => c.toLowerCase().includes(filter));
  }

  res.json({
    state: stateCode,
    cities,
    total: cities.length,
  });
});

// ──────────────────────────────────────────────────────────────────────
// GET /api/location/search-places?q=<query>&state=<XX>
// Place autocomplete for the map search bar — uses Nominatim search
// ──────────────────────────────────────────────────────────────────────

const placeCache = new Map();
let lastNominatimSearch = 0; // rate-limit tracker (1 req/sec)

router.get('/search-places', async (req, res) => {
  const q = (req.query.q || '').trim();
  const stateHint = (req.query.state || '').trim().toUpperCase();

  if (!q || q.length < 2) {
    return res.json({ results: [] });
  }

  // Check cache
  const cacheKey = `${q.toLowerCase()}|${stateHint}`;
  if (placeCache.has(cacheKey)) {
    return res.json({ results: placeCache.get(cacheKey) });
  }

  // ZIP code shortcut — use Zippopotam (faster, no rate limit)
  const zipMatch = q.match(/^(\d{5})$/);
  if (zipMatch) {
    try {
      const resp = await axios.get(`https://api.zippopotam.us/us/${zipMatch[1]}`, {
        timeout: 5000,
      });
      const place = resp.data?.places?.[0];
      if (place) {
        const results = [{
          displayName: `${place['place name']}, ${place['state abbreviation']} ${zipMatch[1]}`,
          lat: parseFloat(place.latitude),
          lng: parseFloat(place.longitude),
          type: 'zip',
          boundingbox: null,
        }];
        placeCache.set(cacheKey, results);
        return res.json({ results });
      }
    } catch {
      // Fall through to Nominatim
    }
  }

  // Rate-limit: wait if needed (Nominatim requires 1 req/sec)
  const now = Date.now();
  const elapsed = now - lastNominatimSearch;
  if (elapsed < 1000) {
    await new Promise((resolve) => setTimeout(resolve, 1000 - elapsed));
  }
  lastNominatimSearch = Date.now();

  try {
    // Bias query with state name if provided
    let searchQ = q;
    if (stateHint && STATE_NAMES[stateHint]) {
      searchQ = `${q}, ${STATE_NAMES[stateHint]}`;
    }

    const resp = await axios.get('https://nominatim.openstreetmap.org/search', {
      params: {
        q: searchQ,
        format: 'json',
        countrycodes: 'us',
        limit: 5,
        addressdetails: 1,
      },
      headers: {
        'User-Agent': 'HomeMatch/1.0 (tours@homematch.app)',
      },
      timeout: 5000,
    });

    const results = (resp.data || []).map((item) => {
      // Build a clean display name
      const addr = item.address || {};
      const city = addr.city || addr.town || addr.village || addr.hamlet || '';
      const state = addr.state || '';
      const stateCode = resolveState(state) || '';
      const county = addr.county || '';

      let displayName = item.display_name || '';
      // Shorten: just "City, State" or "Neighborhood, City, State"
      if (city && stateCode) {
        const neighborhood = addr.neighbourhood || addr.suburb || '';
        displayName = neighborhood
          ? `${neighborhood}, ${city}, ${stateCode}`
          : `${city}, ${stateCode}`;
      } else if (county && stateCode) {
        displayName = `${county}, ${stateCode}`;
      }

      return {
        displayName,
        lat: parseFloat(item.lat),
        lng: parseFloat(item.lon),
        type: item.type || 'place',
        boundingbox: item.boundingbox || null,
      };
    });

    placeCache.set(cacheKey, results);

    // Keep cache bounded
    if (placeCache.size > 200) {
      const firstKey = placeCache.keys().next().value;
      placeCache.delete(firstKey);
    }

    res.json({ results });
  } catch (err) {
    console.error('Place search error:', err.message);
    res.status(500).json({ error: 'Place search failed' });
  }
});

module.exports = router;
