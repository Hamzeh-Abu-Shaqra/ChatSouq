import type { OsmElement } from "./overpass";

// --- Jordan's 12 governorates (centroids) for geo-assignment -------------------
export const GOVERNORATES: { name: string; lat: number; lng: number }[] = [
  { name: "Amman", lat: 31.95, lng: 35.93 },
  { name: "Irbid", lat: 32.55, lng: 35.85 },
  { name: "Zarqa", lat: 32.07, lng: 36.09 },
  { name: "Mafraq", lat: 32.34, lng: 36.21 },
  { name: "Balqa", lat: 32.04, lng: 35.73 },
  { name: "Madaba", lat: 31.72, lng: 35.79 },
  { name: "Karak", lat: 31.18, lng: 35.7 },
  { name: "Tafilah", lat: 30.84, lng: 35.6 },
  { name: "Ma'an", lat: 30.19, lng: 35.73 },
  { name: "Aqaba", lat: 29.53, lng: 35.01 },
  { name: "Jerash", lat: 32.27, lng: 35.9 },
  { name: "Ajloun", lat: 32.33, lng: 35.75 },
];

function haversine(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

export function nearestGovernorate(lat: number, lng: number): string {
  let best = GOVERNORATES[0]!;
  let bestD = Infinity;
  for (const g of GOVERNORATES) {
    const d = haversine(lat, lng, g.lat, g.lng);
    if (d < bestD) {
      bestD = d;
      best = g;
    }
  }
  return best.name;
}

const humanize = (s: string) =>
  s.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()).trim();

// --- OSM tag -> normalized display category -----------------------------------
const AMENITY: Record<string, string> = {
  restaurant: "Restaurant", cafe: "Cafe", fast_food: "Fast Food", bar: "Bar", pub: "Bar",
  ice_cream: "Dessert", food_court: "Food Court", pharmacy: "Pharmacy", hospital: "Hospital",
  clinic: "Clinic", doctors: "Doctor", dentist: "Dentist", bank: "Bank",
  bureau_de_change: "Currency Exchange", fuel: "Gas Station", car_rental: "Car Rental",
  car_wash: "Car Wash", cinema: "Cinema", theatre: "Theatre", nightclub: "Nightclub",
  marketplace: "Market", school: "School", university: "University", college: "College",
  kindergarten: "Kindergarten", library: "Library", fitness_centre: "Gym", gym: "Gym",
  spa: "Spa", veterinary: "Veterinary", post_office: "Post Office", police: "Police",
  fire_station: "Fire Station", townhall: "Government", courthouse: "Government",
  bus_station: "Bus Station", community_centre: "Community Center", coworking_space: "Coworking Space",
};
const SHOP: Record<string, string> = {
  supermarket: "Supermarket", convenience: "Convenience Store", bakery: "Bakery", butcher: "Butcher",
  greengrocer: "Greengrocer", clothes: "Clothing", shoes: "Shoes", jewelry: "Jewelry",
  mobile_phone: "Mobile Phones", electronics: "Electronics", computer: "Computers",
  furniture: "Furniture", hardware: "Hardware", doityourself: "Hardware", car: "Car Dealer",
  car_repair: "Car Repair", car_parts: "Car Parts", bicycle: "Bicycle Shop", books: "Bookstore",
  stationery: "Stationery", gift: "Gift Shop", toys: "Toys", sports: "Sporting Goods",
  beauty: "Beauty", hairdresser: "Salon", cosmetics: "Cosmetics", perfumery: "Perfume",
  optician: "Optician", chemist: "Health & Beauty", florist: "Florist", mall: "Shopping Mall",
  department_store: "Department Store", variety_store: "Variety Store", coffee: "Coffee Shop",
  confectionery: "Sweets", pastry: "Pastry", tea: "Tea Shop", watches: "Watches", bag: "Bags",
  tailor: "Tailor", fabric: "Fabric", music: "Music Store", pet: "Pet Shop",
};
const TOURISM: Record<string, string> = {
  hotel: "Hotel", motel: "Motel", guest_house: "Guest House", hostel: "Hostel",
  apartment: "Serviced Apartment", museum: "Museum", attraction: "Attraction", gallery: "Gallery",
  viewpoint: "Viewpoint", camp_site: "Campsite", theme_park: "Theme Park", zoo: "Zoo",
};
const LEISURE: Record<string, string> = {
  fitness_centre: "Gym", sports_centre: "Sports Center", stadium: "Stadium", park: "Park",
  garden: "Garden", playground: "Playground", swimming_pool: "Swimming Pool", water_park: "Water Park",
  golf_course: "Golf Course", marina: "Marina", dance: "Dance Studio", bowling_alley: "Bowling",
  amusement_arcade: "Arcade", nature_reserve: "Nature Reserve",
};
const HEALTHCARE: Record<string, string> = {
  pharmacy: "Pharmacy", clinic: "Clinic", hospital: "Hospital", doctor: "Doctor", dentist: "Dentist",
  laboratory: "Medical Lab", physiotherapist: "Physiotherapy", optometrist: "Optician",
  centre: "Medical Center",
};
const OFFICE: Record<string, string> = {
  estate_agent: "Real Estate Agency", insurance: "Insurance", lawyer: "Law Firm",
  accountant: "Accounting", government: "Government", travel_agent: "Travel Agency",
  coworking: "Coworking Space", company: "Company", it: "IT Company",
  telecommunication: "Telecom", employment_agency: "Employment Agency",
};

// Named OSM features that are not "places to recommend".
const EXCLUDE = new Set([
  "amenity=bench", "amenity=waste_basket", "amenity=recycling", "amenity=toilets",
  "amenity=drinking_water", "amenity=bicycle_parking", "amenity=parking", "amenity=parking_space",
  "amenity=parking_entrance", "amenity=vending_machine", "amenity=clock", "amenity=post_box",
  "amenity=telephone", "amenity=fountain", "amenity=bbq", "amenity=shelter", "amenity=grit_bin",
  "amenity=hunting_stand", "amenity=taxi", "amenity=atm", "amenity=charging_station",
  "tourism=information", "tourism=artwork", "leisure=pitch", "leisure=track",
  "leisure=fitness_station", "leisure=picnic_table", "leisure=firepit", "leisure=slipway",
  "shop=vacant",
]);

const KEYS: { key: string; map: Record<string, string> }[] = [
  { key: "amenity", map: AMENITY },
  { key: "shop", map: SHOP },
  { key: "tourism", map: TOURISM },
  { key: "leisure", map: LEISURE },
  { key: "healthcare", map: HEALTHCARE },
  { key: "office", map: OFFICE },
];

/** Resolve a normalized {category, subcategory} from OSM tags, or null to skip. */
export function categorize(tags: Record<string, string>): { category: string; subcategory: string } | null {
  for (const { key, map } of KEYS) {
    const val = tags[key];
    if (!val) continue;
    if (EXCLUDE.has(`${key}=${val}`)) return null;
    if (key === "amenity" && val === "place_of_worship") {
      const r = tags.religion;
      const cat = r === "muslim" ? "Mosque" : r === "christian" ? "Church" : "Place of Worship";
      return { category: cat, subcategory: `${key}=${val}` };
    }
    return { category: map[val] ?? humanize(val), subcategory: `${key}=${val}` };
  }
  return null;
}

export function elementCoords(el: OsmElement): { lat: number; lng: number } | null {
  if (typeof el.lat === "number" && typeof el.lon === "number") return { lat: el.lat, lng: el.lon };
  if (el.center) return { lat: el.center.lat, lng: el.center.lon };
  return null;
}

export interface PlaceInput {
  osmType: string;
  osmId: number;
  name: string;
  nameAr: string | null;
  category: string;
  subcategory: string;
  governorate: string;
  city: string | null;
  address: string | null;
  phone: string | null;
  website: string | null;
  openingHours: string | null;
  lat: number;
  lng: number;
  source: string;
  sourceUrl: string;
  raw: Record<string, string>;
  searchText: string;
}

export function toPlace(el: OsmElement): PlaceInput | null {
  const tags = el.tags ?? {};
  const name = tags.name || tags["name:en"];
  if (!name) return null;
  const cat = categorize(tags);
  if (!cat) return null;
  const coords = elementCoords(el);
  if (!coords) return null;

  const city = tags["addr:city"] || tags["addr:suburb"] || tags["addr:town"] || null;
  const governorate = nearestGovernorate(coords.lat, coords.lng);
  const street = [tags["addr:street"], tags["addr:housenumber"]].filter(Boolean).join(" ");
  const address = street || city || null;

  const searchText = [
    name,
    cat.category,
    tags.cuisine ? humanize(tags.cuisine) : null,
    tags.brand,
    city,
    governorate,
    tags.description,
  ]
    .filter(Boolean)
    .join(" — ");

  return {
    osmType: el.type,
    osmId: el.id,
    name,
    nameAr: tags["name:ar"] ?? null,
    category: cat.category,
    subcategory: cat.subcategory,
    governorate,
    city,
    address,
    phone: tags.phone || tags["contact:phone"] || null,
    website: tags.website || tags["contact:website"] || null,
    openingHours: tags.opening_hours ?? null,
    lat: coords.lat,
    lng: coords.lng,
    source: "osm",
    sourceUrl: `https://www.openstreetmap.org/${el.type}/${el.id}`,
    raw: tags,
    searchText,
  };
}
