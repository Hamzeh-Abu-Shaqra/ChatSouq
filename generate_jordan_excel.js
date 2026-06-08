/**
 * Generates: ChatSouq_Jordan_Data.xlsx
 * Sheets:
 *   1. Overview
 *   2. Amman Neighborhoods
 *   3. Jordan Governorates
 *   4. Jordan Cities
 *   5. Product Categories
 *   6. Vendors (Catalog)
 *   7. Listings – Category Breakdown
 *   8. Knowledge Graph (all 8,306 entities)
 *   9. Place Categories
 *  10. Government Institutions
 *  11. Tourism Attractions
 *  12. Major Corporations
 */

const XLSX = require("xlsx");
const fs = require("fs");
const path = require("path");
const readline = require("readline");

// ── Styles helpers ──────────────────────────────────────────────────────────

function ws(data, cols) {
  const sheet = XLSX.utils.aoa_to_sheet(data);
  if (cols) sheet["!cols"] = cols;
  return sheet;
}

function wsFromJson(rows, cols) {
  const sheet = XLSX.utils.json_to_sheet(rows);
  if (cols) sheet["!cols"] = cols;
  return sheet;
}

// ── 1. OVERVIEW ──────────────────────────────────────────────────────────────

const overviewData = [
  ["ChatSouq – Jordan Data Overview", ""],
  ["Generated", new Date().toISOString().split("T")[0]],
  ["", ""],
  ["METRIC", "VALUE"],
  ["Total Knowledge Graph Entities", "8,306"],
  ["Total Product Listings", "62,898"],
  ["Total Vendors", "64"],
  ["Product Categories (Canonical)", "23"],
  ["Amman Neighborhoods Documented", "17"],
  ["Jordan Governorates", "12"],
  ["Place Category Types", "68+"],
  ["Government Institutions Mapped", "40+"],
  ["Major Banks", "10"],
  ["Telecom Operators", "4"],
  ["Tourism Attractions Featured", "20+"],
  ["", ""],
  ["SHEETS IN THIS FILE", "DESCRIPTION"],
  ["Amman Neighborhoods", "17 districts – rent ranges, tiers, pros/cons, best-for audience"],
  ["Jordan Governorates", "12 governorates with geographic centroids (lat/lng)"],
  ["Jordan Cities", "5 major cities with Arabic names and governorate"],
  ["Product Categories", "23 canonical departments + raw-to-canonical mapping rules"],
  ["Vendors (Catalog)", "64 vendors with website, Instagram, category, location"],
  ["Listings – Category Breakdown", "62,898 listings summarised by category"],
  ["Knowledge Graph", "All 8,306 entities: services, food, tourism, healthcare, education…"],
  ["Place Categories", "68 normalised place types (amenity / shop / tourism / leisure)"],
  ["Government Institutions", "Ministries, central banks, utilities, telcos, banks"],
  ["Tourism Attractions", "Major tourist sites with descriptions"],
  ["Major Corporations", "Key Jordanian companies across tech, retail, logistics"],
];

// ── 2. AMMAN NEIGHBORHOODS ──────────────────────────────────────────────────

const neighborhoods = [
  // LUXURY
  {
    Name: "Dabouq", "Name (Arabic)": "دابوق", City: "Amman", Tier: "Luxury",
    "Rent Min (JOD/mo)": 1000, "Rent Max (JOD/mo)": 3500,
    Characteristics: "Quiet villa district; Far west Amman; Lush greenery; Very private",
    Pros: "Most spacious & private; Large villas with gardens; Very low density; Excellent air quality",
    Cons: "Far from city center (30+ min); Car absolutely essential; Limited nearby shops",
    "Best For": "High-budget families; Executives; Those wanting maximum space & privacy",
    "Price Level": "$$$$",
  },
  {
    Name: "Abdoun", "Name (Arabic)": "عبدون", City: "Amman", Tier: "Luxury",
    "Rent Min (JOD/mo)": 900, "Rent Max (JOD/mo)": 2500,
    Characteristics: "Embassy district; Tree-lined streets; Villas & upscale apartments; Near 5th Circle",
    Pros: "Prestige address; Extremely safe & secure; Near best restaurants in Amman; International community",
    Cons: "Car essential; Very high cost of living; Limited public transit",
    "Best For": "Expats; Senior executives; Diplomatic families",
    "Price Level": "$$$$",
  },
  {
    Name: "Deir Ghbar", "Name (Arabic)": "دير غبار", City: "Amman", Tier: "Luxury",
    "Rent Min (JOD/mo)": 800, "Rent Max (JOD/mo)": 2000,
    Characteristics: "Quiet hilltop; Upscale residential; Private community feel; Near 5th Circle",
    Pros: "Panoramic city views; Very secure; Modern buildings; Close to Abdoun amenities",
    Cons: "Car essential; Limited walkability; Higher service charges",
    "Best For": "Families; Expats; Professionals seeking quiet luxury",
    "Price Level": "$$$$",
  },
  // UPSCALE
  {
    Name: "Rabieh", "Name (Arabic)": "الرابية", City: "Amman", Tier: "Upscale",
    "Rent Min (JOD/mo)": 700, "Rent Max (JOD/mo)": 1800,
    Characteristics: "Quiet suburban; Upscale housing; Near 4th & 5th circles; Green spaces",
    Pros: "Very peaceful & quiet; High-quality buildings; Good international schools nearby; Safe & secure",
    Cons: "Need a car; Limited walkability; Fewer cafes & shops",
    "Best For": "Families with children; Expats; Professionals",
    "Price Level": "$$$",
  },
  {
    Name: "Um Uthaina", "Name (Arabic)": "أم أذينة", City: "Amman", Tier: "Upscale",
    "Rent Min (JOD/mo)": 550, "Rent Max (JOD/mo)": 1200,
    Characteristics: "Residential & commercial mix; Near 4th Circle; Well-connected; Many amenities",
    Pros: "Central-west location; Walkable to shops; Good schools & hospitals; Less traffic than Sweifieh",
    Cons: "Getting denser; Moderate traffic; Mixed commercial-residential",
    "Best For": "Young professionals; Couples; Families who want convenience",
    "Price Level": "$$$",
  },
  {
    Name: "Sweifieh", "Name (Arabic)": "الصويفية", City: "Amman", Tier: "Upscale",
    "Rent Min (JOD/mo)": 500, "Rent Max (JOD/mo)": 1100,
    Characteristics: "Major shopping district; Cafes & restaurants; Active nightlife; Central-west Amman",
    Pros: "Everything within walking distance; Excellent transport; Great dining & entertainment; Lively atmosphere",
    Cons: "Heavy traffic congestion; Noisy; Parking nightmare; Higher rents for size",
    "Best For": "Young singles & couples; Expats who like city energy; Those who don't need a car",
    "Price Level": "$$$",
  },
  // MID-RANGE
  {
    Name: "Shmeisani", "Name (Arabic)": "الشميساني", City: "Amman", Tier: "Mid-Range",
    "Rent Min (JOD/mo)": 450, "Rent Max (JOD/mo)": 900,
    Characteristics: "Business & financial district; Banks & corporate offices; Central location; Good infrastructure",
    Pros: "Most central location in Amman; Walking distance to offices & banks; Great connectivity; Diverse amenities",
    Cons: "Commercial feel; Heavy peak-hour traffic; Less residential charm; Noisy on weekdays",
    "Best For": "Business professionals; Singles; Those who work in the area",
    "Price Level": "$$",
  },
  {
    Name: "Jabal Amman", "Name (Arabic)": "جبل عمان", City: "Amman", Tier: "Mid-Range",
    "Rent Min (JOD/mo)": 400, "Rent Max (JOD/mo)": 850,
    Characteristics: "Historic trendy district; 1st–4th Circles; Rainbow Street; Cafes & boutiques",
    Pros: "Cultural & artsy vibe; Walkable neighbourhood; Best café & dining scene in Amman; Historic character",
    Cons: "Hilly terrain (hard on older people); Older buildings; Very limited parking",
    "Best For": "Creatives & artists; Young professionals; Culture & food lovers",
    "Price Level": "$$",
  },
  {
    Name: "Wadi Saqra / 3rd Circle", "Name (Arabic)": "وادي صقرة / الدوار الثالث", City: "Amman", Tier: "Mid-Range",
    "Rent Min (JOD/mo)": 350, "Rent Max (JOD/mo)": 800,
    Characteristics: "Central-west Amman; Near 3rd Circle; Mix of residential & offices; Convenient location",
    Pros: "Very central; Good connectivity to all areas; Walkable to many services; Character neighbourhood",
    Cons: "Traffic at circles; Parking limited; Older building stock",
    "Best For": "Young professionals; Singles; Couples who value central location",
    "Price Level": "$$",
  },
  {
    Name: "Khalda", "Name (Arabic)": "خلدا", City: "Amman", Tier: "Mid-Range",
    "Rent Min (JOD/mo)": 380, "Rent Max (JOD/mo)": 780,
    Characteristics: "Established residential; Near University of Jordan; Family-oriented; Quieter pace",
    Pros: "Peaceful atmosphere; Family-friendly community; Reasonably priced for quality; Good schools & uni nearby",
    Cons: "Needs a car for most errands; Less entertainment & nightlife",
    "Best For": "Families; Students at UJ; Those seeking quiet family life",
    "Price Level": "$$",
  },
  {
    Name: "Tlaa Al-Ali", "Name (Arabic)": "تلاع العلي", City: "Amman", Tier: "Mid-Range",
    "Rent Min (JOD/mo)": 320, "Rent Max (JOD/mo)": 700,
    Characteristics: "Residential suburb; Newer developments; Family-focused; Quieter",
    Pros: "Modern apartments with good finishes; Spacious for the price; Family community feel; Less congested",
    Cons: "Further from city center (20+ min); Car essential; Less entertainment",
    "Best For": "Young families; Those seeking space at reasonable cost",
    "Price Level": "$$",
  },
  {
    Name: "Sweileh", "Name (Arabic)": "سويلح", City: "Amman", Tier: "Mid-Range",
    "Rent Min (JOD/mo)": 250, "Rent Max (JOD/mo)": 550,
    Characteristics: "Near University of Jordan; Active area; Mixed residential-commercial; Affordable",
    Pros: "Very affordable for west Amman; Busy local scene; Good transport options; Near university",
    Cons: "Can be chaotic; Heavy traffic on main roads; Less polished environment",
    "Best For": "Students; Budget-conscious professionals; University staff",
    "Price Level": "$",
  },
  {
    Name: "Jubeiha", "Name (Arabic)": "الجبيهة", City: "Amman", Tier: "Budget",
    "Rent Min (JOD/mo)": 220, "Rent Max (JOD/mo)": 480,
    Characteristics: "University student hub; Affordable; Lively local cafes; Near UJ & JUST",
    Pros: "Lowest-cost option in west Amman; Lively student atmosphere; Many cheap eats & cafes; Near University of Jordan",
    Cons: "Noisier & busier; Less polished; Can feel overcrowded in student season",
    "Best For": "University students; Young budget renters; Those on tight budgets near campus",
    "Price Level": "$",
  },
  // BUDGET – EAST AMMAN
  {
    Name: "Jabal Hussein", "Name (Arabic)": "جبل الحسين", City: "Amman", Tier: "Budget",
    "Rent Min (JOD/mo)": 180, "Rent Max (JOD/mo)": 400,
    Characteristics: "Central east Amman; Dense residential; Affordable; Local markets",
    Pros: "Very central location; Affordable rents; Good public transport; Strong local community",
    Cons: "Dense & crowded; Older buildings; Limited amenities",
    "Best For": "Budget renters; Those needing central location on tight budget; Local families",
    "Price Level": "$",
  },
  {
    Name: "Jabal Al-Nuzha", "Name (Arabic)": "جبل النزهة", City: "Amman", Tier: "Budget",
    "Rent Min (JOD/mo)": 150, "Rent Max (JOD/mo)": 350,
    Characteristics: "East Amman residential; Affordable; Family neighbourhood; Local community",
    Pros: "Affordable family apartments; Good community feel; Accessible public transport",
    Cons: "Limited modern amenities; Older building stock; Distance from west Amman",
    "Best For": "Families on tight budgets; Local Jordanians; Those working in east Amman",
    "Price Level": "$",
  },
  {
    Name: "Marka", "Name (Arabic)": "ماركا", City: "Amman", Tier: "Budget",
    "Rent Min (JOD/mo)": 130, "Rent Max (JOD/mo)": 320,
    Characteristics: "East Amman; Working-class area; Very affordable; Near airport road",
    Pros: "Cheapest rents in Amman; Near Queen Alia Highway; Strong local community",
    Cons: "Far from west Amman amenities; Older housing stock; Less infrastructure",
    "Best For": "Very tight budgets; Those working near the airport or east Amman",
    "Price Level": "$",
  },
  {
    Name: "Sahab", "Name (Arabic)": "سحاب", City: "Amman", Tier: "Budget",
    "Rent Min (JOD/mo)": 110, "Rent Max (JOD/mo)": 280,
    Characteristics: "South-east Amman suburb; Industrial area; Very affordable; Spacious",
    Pros: "Lowest rents in greater Amman area; Larger apartments for price; Quiet residential streets",
    Cons: "Very far from city center (30+ min drive); Limited local services; Far from top schools",
    "Best For": "Extremely tight budgets; Those working in industrial areas; Large families needing space",
    "Price Level": "$",
  },
];

// ── 3. JORDAN GOVERNORATES ──────────────────────────────────────────────────

const governorates = [
  { "#": 1,  Governorate: "Amman",   "Arabic Name": "عمّان",     "Capital City": "Amman",  "Lat (°N)": 31.95, "Lng (°E)": 35.93, Notes: "Largest governorate; political & economic capital" },
  { "#": 2,  Governorate: "Irbid",   "Arabic Name": "إربد",      "Capital City": "Irbid",  "Lat (°N)": 32.55, "Lng (°E)": 35.85, Notes: "Second most populous; northern Jordan" },
  { "#": 3,  Governorate: "Zarqa",   "Arabic Name": "الزرقاء",    "Capital City": "Zarqa",  "Lat (°N)": 32.07, "Lng (°E)": 36.09, Notes: "Industrial centre; large refugee population" },
  { "#": 4,  Governorate: "Mafraq",  "Arabic Name": "المفرق",     "Capital City": "Mafraq", "Lat (°N)": 32.34, "Lng (°E)": 36.21, Notes: "Border with Syria; large Bedouin population" },
  { "#": 5,  Governorate: "Balqa",   "Arabic Name": "البلقاء",    "Capital City": "Salt",   "Lat (°N)": 32.04, "Lng (°E)": 35.73, Notes: "Includes Dead Sea area (Sweimeh)" },
  { "#": 6,  Governorate: "Madaba",  "Arabic Name": "مادبا",      "Capital City": "Madaba", "Lat (°N)": 31.72, "Lng (°E)": 35.79, Notes: "Home to Wadi Mujib, famous mosaic map" },
  { "#": 7,  Governorate: "Karak",   "Arabic Name": "الكرك",      "Capital City": "Karak",  "Lat (°N)": 31.18, "Lng (°E)": 35.70, Notes: "Historic Crusader castle; King's Highway" },
  { "#": 8,  Governorate: "Tafilah", "Arabic Name": "الطفيلة",    "Capital City": "Tafilah","Lat (°N)": 30.84, "Lng (°E)": 35.60, Notes: "Dana Biosphere Reserve" },
  { "#": 9,  Governorate: "Ma'an",   "Arabic Name": "معان",       "Capital City": "Ma'an",  "Lat (°N)": 30.19, "Lng (°E)": 35.73, Notes: "Largest by area; gateway to Petra & Wadi Rum" },
  { "#": 10, Governorate: "Aqaba",   "Arabic Name": "العقبة",     "Capital City": "Aqaba",  "Lat (°N)": 29.53, "Lng (°E)": 35.01, Notes: "Only seaport; Red Sea access; ASEZA zone" },
  { "#": 11, Governorate: "Jerash",  "Arabic Name": "جرش",        "Capital City": "Jerash", "Lat (°N)": 32.27, "Lng (°E)": 35.90, Notes: "Roman city ruins; major tourism destination" },
  { "#": 12, Governorate: "Ajloun",  "Arabic Name": "عجلون",      "Capital City": "Ajloun", "Lat (°N)": 32.33, "Lng (°E)": 35.75, Notes: "Forest reserve; Ajloun Castle (Saladin era)" },
];

// ── 4. JORDAN CITIES ────────────────────────────────────────────────────────

const cities = [
  { City: "Amman",  "Arabic Name": "عمّان",   Governorate: "Amman",  "Population (est.)": "4,200,000+", Role: "Capital; political, economic & cultural hub" },
  { City: "Irbid",  "Arabic Name": "إربد",    Governorate: "Irbid",  "Population (est.)": "660,000+",   Role: "Northern university city; Jordan's second city" },
  { City: "Zarqa",  "Arabic Name": "الزرقاء", Governorate: "Zarqa",  "Population (est.)": "600,000+",   Role: "Industrial & manufacturing hub" },
  { City: "Aqaba",  "Arabic Name": "العقبة",  Governorate: "Aqaba",  "Population (est.)": "148,000+",   Role: "Red Sea port; tourism & ASEZA free zone" },
  { City: "Salt",   "Arabic Name": "السلط",   Governorate: "Balqa",  "Population (est.)": "90,000+",    Role: "UNESCO World Heritage Site (2021); historic trade city" },
  { City: "Madaba", "Arabic Name": "مادبا",   Governorate: "Madaba", "Population (est.)": "60,000+",    Role: "City of mosaics; Christian heritage; tourism" },
  { City: "Jerash", "Arabic Name": "جرش",     Governorate: "Jerash", "Population (est.)": "50,000+",    Role: "Roman ruins; one of best-preserved in the world" },
  { City: "Petra",  "Arabic Name": "البتراء",  Governorate: "Ma'an",  "Population (est.)": "25,000+",    Role: "UNESCO World Heritage; New Seven Wonder of the World" },
];

// ── 5. PRODUCT CATEGORIES ────────────────────────────────────────────────────

const productCategories = [
  { "#": 1,  Category: "Beauty & Skincare",      "Arabic Equivalent": "العناية بالبشرة",       "Subcategory Examples": "Serums, moisturisers, cleansers, sunscreen", "Key Brands / Vendors": "Beauty Box Jordan, Gifts Center" },
  { "#": 2,  Category: "Makeup",                 "Arabic Equivalent": "مكياج",                "Subcategory Examples": "Lipstick, foundation, eyeshadow, mascara", "Key Brands / Vendors": "Beauty Box Jordan" },
  { "#": 3,  Category: "Hair Care",              "Arabic Equivalent": "العناية بالشعر",        "Subcategory Examples": "Shampoo, conditioner, hair dryers, serums", "Key Brands / Vendors": "Beauty Box Jordan" },
  { "#": 4,  Category: "Perfume & Fragrance",    "Arabic Equivalent": "عطور",                 "Subcategory Examples": "EDP, EDT, cologne, oud", "Key Brands / Vendors": "Gifts Center, Beauty Box Jordan" },
  { "#": 5,  Category: "Health & Wellness",      "Arabic Equivalent": "الصحة والعافية",        "Subcategory Examples": "Vitamins, supplements, dental care, oral-b", "Key Brands / Vendors": "Various" },
  { "#": 6,  Category: "Mobile Phones",          "Arabic Equivalent": "هواتف ذكية",           "Subcategory Examples": "iPhone, Samsung Galaxy, Xiaomi, phone cases", "Key Brands / Vendors": "Multiple retailers" },
  { "#": 7,  Category: "Tablets",               "Arabic Equivalent": "أجهزة لوحية",          "Subcategory Examples": "iPad, Galaxy Tab, Lenovo", "Key Brands / Vendors": "Multiple retailers" },
  { "#": 8,  Category: "Computers & Laptops",   "Arabic Equivalent": "أجهزة كمبيوتر",        "Subcategory Examples": "MacBook, laptop, desktop, monitor, keyboard", "Key Brands / Vendors": "Multiple retailers" },
  { "#": 9,  Category: "Audio & Headphones",     "Arabic Equivalent": "سماعات وصوتيات",       "Subcategory Examples": "Headphones, earbuds, AirPods, speakers, soundbars", "Key Brands / Vendors": "Multiple retailers" },
  { "#": 10, Category: "TVs & Displays",         "Arabic Equivalent": "تلفزيونات وشاشات",     "Subcategory Examples": "Smart TV, OLED, projectors", "Key Brands / Vendors": "Multiple retailers" },
  { "#": 11, Category: "Cameras",               "Arabic Equivalent": "كاميرات",              "Subcategory Examples": "DSLR, mirrorless, GoPro, lenses", "Key Brands / Vendors": "Multiple retailers" },
  { "#": 12, Category: "Gaming",                "Arabic Equivalent": "ألعاب إلكترونية",      "Subcategory Examples": "PS5, Xbox, Nintendo, controllers", "Key Brands / Vendors": "Multiple retailers" },
  { "#": 13, Category: "Electronics & Accessories","Arabic Equivalent": "إلكترونيات وملحقات", "Subcategory Examples": "Chargers, cables, power banks, HDMI, USB, routers", "Key Brands / Vendors": "Multiple retailers" },
  { "#": 14, Category: "Home Appliances",        "Arabic Equivalent": "أجهزة منزلية",         "Subcategory Examples": "Blenders, microwaves, fridges, kettles, irons", "Key Brands / Vendors": "Multiple retailers" },
  { "#": 15, Category: "Home & Living",          "Arabic Equivalent": "المنزل والديكور",       "Subcategory Examples": "Vases, plants, cushions, candles, curtains, bedding", "Key Brands / Vendors": "Vyne Flower Boutique" },
  { "#": 16, Category: "Watches & Accessories",  "Arabic Equivalent": "ساعات وإكسسوارات",     "Subcategory Examples": "Smartwatch, luxury watch, strap", "Key Brands / Vendors": "Gifts Center" },
  { "#": 17, Category: "Jewelry",               "Arabic Equivalent": "مجوهرات",              "Subcategory Examples": "Necklaces, rings, bracelets, earrings, gold, silver", "Key Brands / Vendors": "Gifts Center" },
  { "#": 18, Category: "Bags & Luggage",         "Arabic Equivalent": "حقائب وأمتعة",         "Subcategory Examples": "Backpacks, handbags, suitcases, wallets", "Key Brands / Vendors": "Multiple retailers" },
  { "#": 19, Category: "Toys & Games",           "Arabic Equivalent": "ألعاب أطفال",          "Subcategory Examples": "LEGO, dolls, puzzles, board games", "Key Brands / Vendors": "Multiple retailers" },
  { "#": 20, Category: "Baby & Kids",            "Arabic Equivalent": "مستلزمات الأطفال",     "Subcategory Examples": "Strollers, diapers, baby food, nursery", "Key Brands / Vendors": "Multiple retailers" },
  { "#": 21, Category: "Food & Gourmet",         "Arabic Equivalent": "أطعمة فاخرة",          "Subcategory Examples": "Belgian chocolates, coffee, tea, honey, dates", "Key Brands / Vendors": "Neuhaus Belgian Chocolates" },
  { "#": 22, Category: "Sports & Outdoors",      "Arabic Equivalent": "رياضة وأماكن مفتوحة", "Subcategory Examples": "Dumbbells, yoga mats, tents, cycling, camping", "Key Brands / Vendors": "Multiple retailers" },
  { "#": 23, Category: "Stationery & Office",    "Arabic Equivalent": "قرطاسية ومكتبيات",    "Subcategory Examples": "Notebooks, pens, planners, agendas, office supplies", "Key Brands / Vendors": "Multiple retailers" },
];

// ── 6. LISTINGS CATEGORY BREAKDOWN ──────────────────────────────────────────

const listingBreakdown = [
  { "Raw Category": "Watches & Accessories",    "Canonical Category": "Watches & Accessories",      Count: 16770, "% of Total": "26.7%" },
  { "Raw Category": "Beauty & Skincare",        "Canonical Category": "Beauty & Skincare",           Count: 8301,  "% of Total": "13.2%" },
  { "Raw Category": "Makeup",                   "Canonical Category": "Makeup",                      Count: 5054,  "% of Total": "8.0%"  },
  { "Raw Category": "Perfume & Fragrance",      "Canonical Category": "Perfume & Fragrance",         Count: 4939,  "% of Total": "7.9%"  },
  { "Raw Category": "Home & Living",            "Canonical Category": "Home & Living",               Count: 4492,  "% of Total": "7.1%"  },
  { "Raw Category": "Electronics Accessories",  "Canonical Category": "Electronics & Accessories",  Count: 4220,  "% of Total": "6.7%"  },
  { "Raw Category": "Home Appliances",          "Canonical Category": "Home Appliances",             Count: 4138,  "% of Total": "6.6%"  },
  { "Raw Category": "Mobile Phones",            "Canonical Category": "Mobile Phones",               Count: 2185,  "% of Total": "3.5%"  },
  { "Raw Category": "Audio & Sound",            "Canonical Category": "Audio & Headphones",          Count: 1710,  "% of Total": "2.7%"  },
  { "Raw Category": "Toys & Games",             "Canonical Category": "Toys & Games",                Count: 1606,  "% of Total": "2.6%"  },
  { "Raw Category": "Women's Clothing",         "Canonical Category": "Home & Living",               Count: 968,   "% of Total": "1.5%"  },
  { "Raw Category": "Hair & Beauty",            "Canonical Category": "Hair Care",                   Count: 862,   "% of Total": "1.4%"  },
  { "Raw Category": "Gifts & Occasions",        "Canonical Category": "Home & Living",               Count: 807,   "% of Total": "1.3%"  },
  { "Raw Category": "Outdoor & Camping",        "Canonical Category": "Sports & Outdoors",           Count: 649,   "% of Total": "1.0%"  },
  { "Raw Category": "Computers & Laptops",      "Canonical Category": "Computers & Laptops",         Count: 632,   "% of Total": "1.0%"  },
  { "Raw Category": "Chocolates & Sweets",      "Canonical Category": "Food & Gourmet",              Count: 506,   "% of Total": "0.8%"  },
  { "Raw Category": "TVs & Displays",           "Canonical Category": "TVs & Displays",              Count: 487,   "% of Total": "0.8%"  },
  { "Raw Category": "Jewelry",                  "Canonical Category": "Jewelry",                     Count: 464,   "% of Total": "0.7%"  },
  { "Raw Category": "Baby & Kids",              "Canonical Category": "Baby & Kids",                 Count: 387,   "% of Total": "0.6%"  },
  { "Raw Category": "Tablets",                  "Canonical Category": "Tablets",                     Count: 373,   "% of Total": "0.6%"  },
  { "Raw Category": "Bags & Backpacks",         "Canonical Category": "Bags & Luggage",              Count: 356,   "% of Total": "0.6%"  },
  { "Raw Category": "Health & Wellness",        "Canonical Category": "Health & Wellness",           Count: 326,   "% of Total": "0.5%"  },
  { "Raw Category": "Gaming",                   "Canonical Category": "Gaming",                      Count: 269,   "% of Total": "0.4%"  },
  { "Raw Category": "Networking",               "Canonical Category": "Electronics & Accessories",  Count: 193,   "% of Total": "0.3%"  },
  { "Raw Category": "Cameras",                  "Canonical Category": "Cameras",                     Count: 190,   "% of Total": "0.3%"  },
  { "Raw Category": "Personal Care",            "Canonical Category": "Beauty & Skincare",           Count: 185,   "% of Total": "0.3%"  },
  { "Raw Category": "Sports & Fitness",         "Canonical Category": "Sports & Outdoors",           Count: 158,   "% of Total": "0.3%"  },
  { "Raw Category": "Nail Care",                "Canonical Category": "Beauty & Skincare",           Count: 149,   "% of Total": "0.2%"  },
  { "Raw Category": "Printers & Scanners",      "Canonical Category": "Electronics & Accessories",  Count: 130,   "% of Total": "0.2%"  },
  { "Raw Category": "Coffee & Beverages",       "Canonical Category": "Food & Gourmet",              Count: 91,    "% of Total": "0.1%"  },
  { "Raw Category": "Stationery",               "Canonical Category": "Stationery & Office",         Count: 51,    "% of Total": "0.1%"  },
  { "Raw Category": "Belgian Chocolates",       "Canonical Category": "Food & Gourmet",              Count: 23,    "% of Total": "0.0%"  },
  { "Raw Category": "Other / Misc",             "Canonical Category": "(various)",                   Count: 976,   "% of Total": "1.6%"  },
  { "Raw Category": "TOTAL",                    "Canonical Category": "",                            Count: 62898, "% of Total": "100%"  },
];

// ── 7. PLACE CATEGORIES ──────────────────────────────────────────────────────

const placeCategories = [
  // Amenity
  { Type: "Amenity", "OSM Key": "amenity=restaurant",      "Normalised Label": "Restaurant",         Group: "Food & Beverage" },
  { Type: "Amenity", "OSM Key": "amenity=cafe",            "Normalised Label": "Cafe",               Group: "Food & Beverage" },
  { Type: "Amenity", "OSM Key": "amenity=fast_food",       "Normalised Label": "Fast Food",          Group: "Food & Beverage" },
  { Type: "Amenity", "OSM Key": "amenity=bar",             "Normalised Label": "Bar",                Group: "Food & Beverage" },
  { Type: "Amenity", "OSM Key": "amenity=pub",             "Normalised Label": "Pub",                Group: "Food & Beverage" },
  { Type: "Amenity", "OSM Key": "amenity=ice_cream",       "Normalised Label": "Ice Cream",          Group: "Food & Beverage" },
  { Type: "Amenity", "OSM Key": "amenity=food_court",      "Normalised Label": "Food Court",         Group: "Food & Beverage" },
  { Type: "Amenity", "OSM Key": "amenity=pharmacy",        "Normalised Label": "Pharmacy",           Group: "Healthcare" },
  { Type: "Amenity", "OSM Key": "amenity=hospital",        "Normalised Label": "Hospital",           Group: "Healthcare" },
  { Type: "Amenity", "OSM Key": "amenity=clinic",          "Normalised Label": "Clinic",             Group: "Healthcare" },
  { Type: "Amenity", "OSM Key": "amenity=doctors",         "Normalised Label": "Doctors",            Group: "Healthcare" },
  { Type: "Amenity", "OSM Key": "amenity=dentist",         "Normalised Label": "Dentist",            Group: "Healthcare" },
  { Type: "Amenity", "OSM Key": "amenity=bank",            "Normalised Label": "Bank",               Group: "Financial" },
  { Type: "Amenity", "OSM Key": "amenity=bureau_de_change","Normalised Label": "Currency Exchange",  Group: "Financial" },
  { Type: "Amenity", "OSM Key": "amenity=fuel",            "Normalised Label": "Gas Station",        Group: "Transport" },
  { Type: "Amenity", "OSM Key": "amenity=car_rental",      "Normalised Label": "Car Rental",         Group: "Transport" },
  { Type: "Amenity", "OSM Key": "amenity=car_wash",        "Normalised Label": "Car Wash",           Group: "Automotive" },
  { Type: "Amenity", "OSM Key": "amenity=cinema",          "Normalised Label": "Cinema",             Group: "Entertainment" },
  { Type: "Amenity", "OSM Key": "amenity=theatre",         "Normalised Label": "Theatre",            Group: "Entertainment" },
  { Type: "Amenity", "OSM Key": "amenity=nightclub",       "Normalised Label": "Nightclub",          Group: "Entertainment" },
  { Type: "Amenity", "OSM Key": "amenity=marketplace",     "Normalised Label": "Marketplace",        Group: "Retail" },
  { Type: "Amenity", "OSM Key": "amenity=school",          "Normalised Label": "School",             Group: "Education" },
  { Type: "Amenity", "OSM Key": "amenity=university",      "Normalised Label": "University",         Group: "Education" },
  { Type: "Amenity", "OSM Key": "amenity=college",         "Normalised Label": "College",            Group: "Education" },
  { Type: "Amenity", "OSM Key": "amenity=kindergarten",    "Normalised Label": "Kindergarten",       Group: "Education" },
  { Type: "Amenity", "OSM Key": "amenity=library",         "Normalised Label": "Library",            Group: "Education" },
  { Type: "Amenity", "OSM Key": "amenity=gym",             "Normalised Label": "Gym",                Group: "Health & Fitness" },
  { Type: "Amenity", "OSM Key": "amenity=spa",             "Normalised Label": "Spa",                Group: "Health & Fitness" },
  { Type: "Amenity", "OSM Key": "amenity=veterinary",      "Normalised Label": "Veterinary",         Group: "Healthcare" },
  { Type: "Amenity", "OSM Key": "amenity=post_office",     "Normalised Label": "Post Office",        Group: "Government" },
  { Type: "Amenity", "OSM Key": "amenity=police",          "Normalised Label": "Police",             Group: "Government" },
  { Type: "Amenity", "OSM Key": "amenity=fire_station",    "Normalised Label": "Fire Station",       Group: "Government" },
  { Type: "Amenity", "OSM Key": "amenity=bus_station",     "Normalised Label": "Bus Station",        Group: "Transport" },
  { Type: "Amenity", "OSM Key": "amenity=coworking_space", "Normalised Label": "Coworking Space",    Group: "Business" },
  // Shops
  { Type: "Shop",    "OSM Key": "shop=supermarket",        "Normalised Label": "Supermarket",        Group: "Retail" },
  { Type: "Shop",    "OSM Key": "shop=convenience",        "Normalised Label": "Convenience Store",  Group: "Retail" },
  { Type: "Shop",    "OSM Key": "shop=bakery",             "Normalised Label": "Bakery",             Group: "Food & Beverage" },
  { Type: "Shop",    "OSM Key": "shop=butcher",            "Normalised Label": "Butcher",            Group: "Food & Beverage" },
  { Type: "Shop",    "OSM Key": "shop=clothes",            "Normalised Label": "Clothing",           Group: "Retail – Fashion" },
  { Type: "Shop",    "OSM Key": "shop=shoes",              "Normalised Label": "Shoes",              Group: "Retail – Fashion" },
  { Type: "Shop",    "OSM Key": "shop=jewelry",            "Normalised Label": "Jewelry",            Group: "Retail – Fashion" },
  { Type: "Shop",    "OSM Key": "shop=mobile_phone",       "Normalised Label": "Mobile Phones",      Group: "Retail – Electronics" },
  { Type: "Shop",    "OSM Key": "shop=electronics",        "Normalised Label": "Electronics",        Group: "Retail – Electronics" },
  { Type: "Shop",    "OSM Key": "shop=computer",           "Normalised Label": "Computers",          Group: "Retail – Electronics" },
  { Type: "Shop",    "OSM Key": "shop=furniture",          "Normalised Label": "Furniture",          Group: "Retail – Home" },
  { Type: "Shop",    "OSM Key": "shop=hardware",           "Normalised Label": "Hardware",           Group: "Retail – Home" },
  { Type: "Shop",    "OSM Key": "shop=car",                "Normalised Label": "Car Dealer",         Group: "Automotive" },
  { Type: "Shop",    "OSM Key": "shop=car_repair",         "Normalised Label": "Car Repair",         Group: "Automotive" },
  { Type: "Shop",    "OSM Key": "shop=books",              "Normalised Label": "Bookstore",          Group: "Retail" },
  { Type: "Shop",    "OSM Key": "shop=stationery",         "Normalised Label": "Stationery",         Group: "Retail" },
  { Type: "Shop",    "OSM Key": "shop=gift",               "Normalised Label": "Gift Shop",          Group: "Retail" },
  { Type: "Shop",    "OSM Key": "shop=toys",               "Normalised Label": "Toys",               Group: "Retail" },
  { Type: "Shop",    "OSM Key": "shop=sports",             "Normalised Label": "Sporting Goods",     Group: "Retail" },
  { Type: "Shop",    "OSM Key": "shop=beauty",             "Normalised Label": "Beauty",             Group: "Retail – Beauty" },
  { Type: "Shop",    "OSM Key": "shop=hairdresser",        "Normalised Label": "Salon",              Group: "Retail – Beauty" },
  { Type: "Shop",    "OSM Key": "shop=cosmetics",          "Normalised Label": "Cosmetics",          Group: "Retail – Beauty" },
  { Type: "Shop",    "OSM Key": "shop=perfumery",          "Normalised Label": "Perfume",            Group: "Retail – Beauty" },
  { Type: "Shop",    "OSM Key": "shop=optician",           "Normalised Label": "Optician",           Group: "Healthcare" },
  { Type: "Shop",    "OSM Key": "shop=florist",            "Normalised Label": "Florist",            Group: "Retail" },
  { Type: "Shop",    "OSM Key": "shop=mall",               "Normalised Label": "Shopping Mall",      Group: "Retail" },
  { Type: "Shop",    "OSM Key": "shop=department_store",   "Normalised Label": "Department Store",   Group: "Retail" },
  { Type: "Shop",    "OSM Key": "shop=confectionery",      "Normalised Label": "Sweets",             Group: "Food & Beverage" },
  { Type: "Shop",    "OSM Key": "shop=pastry",             "Normalised Label": "Pastry",             Group: "Food & Beverage" },
  { Type: "Shop",    "OSM Key": "shop=watches",            "Normalised Label": "Watches",            Group: "Retail" },
  { Type: "Shop",    "OSM Key": "shop=bags",               "Normalised Label": "Bags",               Group: "Retail" },
  { Type: "Shop",    "OSM Key": "shop=music",              "Normalised Label": "Music Store",        Group: "Retail" },
  { Type: "Shop",    "OSM Key": "shop=pet",                "Normalised Label": "Pet Shop",           Group: "Retail" },
  // Tourism
  { Type: "Tourism", "OSM Key": "tourism=hotel",           "Normalised Label": "Hotel",              Group: "Accommodation" },
  { Type: "Tourism", "OSM Key": "tourism=hostel",          "Normalised Label": "Hostel",             Group: "Accommodation" },
  { Type: "Tourism", "OSM Key": "tourism=guest_house",     "Normalised Label": "Guest House",        Group: "Accommodation" },
  { Type: "Tourism", "OSM Key": "tourism=museum",          "Normalised Label": "Museum",             Group: "Tourism" },
  { Type: "Tourism", "OSM Key": "tourism=attraction",      "Normalised Label": "Attraction",         Group: "Tourism" },
  { Type: "Tourism", "OSM Key": "tourism=gallery",         "Normalised Label": "Gallery",            Group: "Tourism" },
  { Type: "Tourism", "OSM Key": "tourism=viewpoint",       "Normalised Label": "Viewpoint",          Group: "Tourism" },
  { Type: "Tourism", "OSM Key": "tourism=camp_site",       "Normalised Label": "Campsite",           Group: "Tourism" },
  { Type: "Tourism", "OSM Key": "tourism=theme_park",      "Normalised Label": "Theme Park",         Group: "Entertainment" },
  { Type: "Tourism", "OSM Key": "tourism=zoo",             "Normalised Label": "Zoo",                Group: "Entertainment" },
  // Leisure
  { Type: "Leisure", "OSM Key": "leisure=fitness_centre",  "Normalised Label": "Gym",                Group: "Health & Fitness" },
  { Type: "Leisure", "OSM Key": "leisure=sports_centre",   "Normalised Label": "Sports Center",      Group: "Health & Fitness" },
  { Type: "Leisure", "OSM Key": "leisure=stadium",         "Normalised Label": "Stadium",            Group: "Sports" },
  { Type: "Leisure", "OSM Key": "leisure=park",            "Normalised Label": "Park",               Group: "Outdoor" },
  { Type: "Leisure", "OSM Key": "leisure=garden",          "Normalised Label": "Garden",             Group: "Outdoor" },
  { Type: "Leisure", "OSM Key": "leisure=playground",      "Normalised Label": "Playground",         Group: "Outdoor" },
  { Type: "Leisure", "OSM Key": "leisure=swimming_pool",   "Normalised Label": "Swimming Pool",      Group: "Health & Fitness" },
  { Type: "Leisure", "OSM Key": "leisure=water_park",      "Normalised Label": "Water Park",         Group: "Entertainment" },
  { Type: "Leisure", "OSM Key": "leisure=golf_course",     "Normalised Label": "Golf Course",        Group: "Sports" },
  { Type: "Leisure", "OSM Key": "leisure=marina",          "Normalised Label": "Marina",             Group: "Outdoor" },
  { Type: "Leisure", "OSM Key": "leisure=dance",           "Normalised Label": "Dance Studio",       Group: "Health & Fitness" },
  { Type: "Leisure", "OSM Key": "leisure=bowling_alley",   "Normalised Label": "Bowling",            Group: "Entertainment" },
  { Type: "Leisure", "OSM Key": "leisure=nature_reserve",  "Normalised Label": "Nature Reserve",     Group: "Outdoor" },
];

// ── 8. GOVERNMENT INSTITUTIONS ───────────────────────────────────────────────

const govtInstitutions = [
  // Ministries
  { Sector: "Ministry", Institution: "Ministry of Finance", "Arabic Name": "وزارة المالية", Notes: "Fiscal policy, budget, taxation" },
  { Sector: "Ministry", Institution: "Ministry of Interior", "Arabic Name": "وزارة الداخلية", Notes: "Civil status, passports, residency" },
  { Sector: "Ministry", Institution: "Ministry of Health", "Arabic Name": "وزارة الصحة", Notes: "Healthcare regulation & public hospitals" },
  { Sector: "Ministry", Institution: "Ministry of Education", "Arabic Name": "وزارة التربية والتعليم", Notes: "K-12 public education" },
  { Sector: "Ministry", Institution: "Ministry of Higher Education & Scientific Research", "Arabic Name": "وزارة التعليم العالي", Notes: "Universities and research" },
  { Sector: "Ministry", Institution: "Ministry of Tourism & Antiquities", "Arabic Name": "وزارة السياحة والآثار", Notes: "Tourism promotion, heritage sites" },
  { Sector: "Ministry", Institution: "Ministry of Trade & Industry", "Arabic Name": "وزارة الصناعة والتجارة", Notes: "Business registration, trade policy" },
  { Sector: "Ministry", Institution: "Ministry of Energy & Mineral Resources", "Arabic Name": "وزارة الطاقة والثروة المعدنية", Notes: "Energy, oil, mining" },
  { Sector: "Ministry", Institution: "Ministry of Transport", "Arabic Name": "وزارة النقل", Notes: "Roads, aviation, maritime" },
  { Sector: "Ministry", Institution: "Ministry of Agriculture", "Arabic Name": "وزارة الزراعة", Notes: "Food security, farming policy" },
  { Sector: "Ministry", Institution: "Ministry of Labor", "Arabic Name": "وزارة العمل", Notes: "Employment, work permits" },
  { Sector: "Ministry", Institution: "Ministry of Justice", "Arabic Name": "وزارة العدل", Notes: "Courts, legal system" },
  { Sector: "Ministry", Institution: "Ministry of Foreign Affairs", "Arabic Name": "وزارة الخارجية", Notes: "Diplomatic relations, visas" },
  { Sector: "Ministry", Institution: "Ministry of Digital Economy & Entrepreneurship", "Arabic Name": "وزارة الاقتصاد الرقمي", Notes: "Tech policy, digital transformation" },
  { Sector: "Ministry", Institution: "Ministry of Water & Irrigation", "Arabic Name": "وزارة المياه والري", Notes: "Water resources" },
  { Sector: "Ministry", Institution: "Ministry of Environment", "Arabic Name": "وزارة البيئة", Notes: "Environmental regulation" },
  { Sector: "Ministry", Institution: "Ministry of Social Development", "Arabic Name": "وزارة التنمية الاجتماعية", Notes: "Social welfare, NGOs" },
  { Sector: "Ministry", Institution: "Ministry of Communication & IT", "Arabic Name": "وزارة الاتصالات", Notes: "Telecom regulation" },
  // Central & Regulatory
  { Sector: "Central/Regulatory", Institution: "Central Bank of Jordan", "Arabic Name": "البنك المركزي الأردني", Notes: "Monetary policy, banking oversight" },
  { Sector: "Central/Regulatory", Institution: "Jordan Securities Commission", "Arabic Name": "هيئة الأوراق المالية", Notes: "Capital markets regulator" },
  { Sector: "Central/Regulatory", Institution: "Amman Stock Exchange", "Arabic Name": "بورصة عمّان", Notes: "ASE – national stock exchange" },
  { Sector: "Central/Regulatory", Institution: "Greater Amman Municipality", "Arabic Name": "أمانة عمّان الكبرى", Notes: "Amman city administration" },
  { Sector: "Central/Regulatory", Institution: "Aqaba Special Economic Zone Authority", "Arabic Name": "سلطة منطقة العقبة الاقتصادية", Notes: "ASEZA – manages Aqaba free zone" },
  { Sector: "Central/Regulatory", Institution: "Jordan Investment Commission", "Arabic Name": "هيئة الاستثمار الأردنية", Notes: "Attracts and facilitates investment" },
  { Sector: "Central/Regulatory", Institution: "Jordan Customs Department", "Arabic Name": "دائرة الجمارك", Notes: "Trade border control" },
  { Sector: "Central/Regulatory", Institution: "Civil Status & Passports Dept.", "Arabic Name": "دائرة الأحوال المدنية", Notes: "National IDs, passports, birth certificates" },
  { Sector: "Central/Regulatory", Institution: "Income & Sales Tax Department", "Arabic Name": "دائرة ضريبة الدخل والمبيعات", Notes: "Tax collection" },
  // Utilities
  { Sector: "Utility", Institution: "National Electric Power Company (NEPCO)", "Arabic Name": "شركة الكهرباء الوطنية", Notes: "National electricity transmission" },
  { Sector: "Utility", Institution: "Water Authority of Jordan", "Arabic Name": "سلطة المياه", Notes: "Drinking water & wastewater" },
  { Sector: "Utility", Institution: "Jordan Electricity Company", "Arabic Name": "شركة كهرباء الأردن", Notes: "Distribution in greater Amman" },
  // Banks
  { Sector: "Bank", Institution: "Arab Bank", "Arabic Name": "البنك العربي", Notes: "Largest Arab bank by assets; HQ Amman; global" },
  { Sector: "Bank", Institution: "Bank of Jordan", "Arabic Name": "بنك الأردن", Notes: "Retail & commercial banking" },
  { Sector: "Bank", Institution: "Housing Bank for Trade & Finance", "Arabic Name": "بنك الإسكان", Notes: "Largest by assets in Jordan" },
  { Sector: "Bank", Institution: "Jordan Ahli Bank", "Arabic Name": "البنك الأهلي الأردني", Notes: "Retail banking; regional branches" },
  { Sector: "Bank", Institution: "Cairo Amman Bank", "Arabic Name": "بنك القاهرة عمّان", Notes: "Retail & SME focus" },
  { Sector: "Bank", Institution: "Jordan Islamic Bank", "Arabic Name": "البنك الإسلامي الأردني", Notes: "Shariah-compliant; largest Islamic bank in Jordan" },
  { Sector: "Bank", Institution: "Safwa Islamic Bank", "Arabic Name": "بنك صفوة الإسلامي", Notes: "Islamic banking; growing digital presence" },
  { Sector: "Bank", Institution: "Capital Bank", "Arabic Name": "بنك كابيتال", Notes: "Corporate & investment banking" },
  { Sector: "Bank", Institution: "Jordan Kuwait Bank", "Arabic Name": "البنك الأردني الكويتي", Notes: "Retail; partially Kuwait-owned" },
  { Sector: "Bank", Institution: "Arab Jordan Investment Bank", "Arabic Name": "البنك العربي الأردني للاستثمار", Notes: "Investment & corporate banking" },
  { Sector: "Digital Bank", Institution: "Blink (by Cairo Amman Bank)", "Arabic Name": "بلنك", Notes: "Jordan's first fully digital bank" },
  { Sector: "Digital Bank", Institution: "Reflect (by Bank al Etihad)", "Arabic Name": "ريفلكت", Notes: "Mobile-first digital banking" },
  // Telecoms
  { Sector: "Telecom", Institution: "Zain Jordan", "Arabic Name": "زين الأردن", Notes: "Largest telecom operator by subscribers" },
  { Sector: "Telecom", Institution: "Orange Jordan", "Arabic Name": "أورنج الأردن", Notes: "Fixed & mobile; Orange Group subsidiary" },
  { Sector: "Telecom", Institution: "Umniah", "Arabic Name": "أمنية", Notes: "Budget operator; Batelco subsidiary" },
  { Sector: "Telecom", Institution: "Jordan Telecom Group (JTG)", "Arabic Name": "مجموعة الاتصالات الأردنية", Notes: "Fixed-line incumbent; ADSL" },
  // Transport
  { Sector: "Transport", Institution: "Royal Jordanian Airlines", "Arabic Name": "الملكية الأردنية", Notes: "National carrier; 50+ destinations" },
  { Sector: "Transport", Institution: "Queen Alia International Airport", "Arabic Name": "مطار الملكة علياء", Notes: "HUB; 12M+ passengers/year" },
  { Sector: "Transport", Institution: "Jordan Tourism Board", "Arabic Name": "هيئة تنشيط السياحة", Notes: "National tourism promotion body" },
];

// ── 9. TOURISM ATTRACTIONS ────────────────────────────────────────────────────

const tourismAttractions = [
  {
    Site: "Petra",                   "Arabic Name": "البتراء",         Governorate: "Ma'an",
    Type: "Archaeological",          UNESCO: "Yes (1985)",
    "Highlight": "Rose-red Nabataean city; The Siq & Treasury (Al-Khazneh); The Monastery (Ad Deir)",
    "Best Time to Visit": "Mar–May, Sep–Nov",  "Entry Fee (JOD)": "50 (day) / 55 (2-day)",
    Notes: "New Seven Wonders of the World; 2nd-century BC; 800+ monuments"
  },
  {
    Site: "Wadi Rum",                "Arabic Name": "وادي رم",         Governorate: "Aqaba",
    Type: "Nature / Desert",         UNESCO: "Yes (2011)",
    "Highlight": "Red sandstone desert; jeep tours; camel rides; Bedouin camps; stargazing",
    "Best Time to Visit": "Mar–May, Sep–Nov",  "Entry Fee (JOD)": "5 (bus entry)",
    Notes: "UNESCO Mixed Heritage; featured in 'The Martian', 'Lawrence of Arabia'"
  },
  {
    Site: "Dead Sea",                "Arabic Name": "البحر الميت",     Governorate: "Balqa (Sweimeh)",
    Type: "Nature / Wellness",       UNESCO: "No",
    "Highlight": "World's lowest point (−430 m); ultra-saline water; mineral-rich black mud; resort spas",
    "Best Time to Visit": "Mar–Jun, Sep–Nov",  "Entry Fee (JOD)": "15–30 (resort day pass)",
    Notes: "9× saltier than ocean; you float naturally; 10+ luxury resorts on Jordanian shore"
  },
  {
    Site: "Jerash",                  "Arabic Name": "جرش",             Governorate: "Jerash",
    Type: "Archaeological (Roman)",  UNESCO: "No (nominated)",
    "Highlight": "Hadrian's Arch; Oval Plaza; Temple of Artemis; South Theatre (6,000 seats); chariot racing",
    "Best Time to Visit": "All year",             "Entry Fee (JOD)": "10",
    Notes: "'Pompeii of the East'; one of best-preserved Roman cities outside Italy"
  },
  {
    Site: "Wadi Mujib Biosphere Reserve","Arabic Name": "محمية وادي الموجب", Governorate: "Madaba",
    Type: "Nature / Adventure",      UNESCO: "MAB Reserve",
    "Highlight": "Jordan's Grand Canyon; aquatic siq trail; canyoning; cliff hiking; wildlife",
    "Best Time to Visit": "Apr–Oct",              "Entry Fee (JOD)": "21 (siq trail)",
    Notes: "Lowest nature reserve on Earth (−410 m); 420 plant species; 190 bird species"
  },
  {
    Site: "Dana Biosphere Reserve",  "Arabic Name": "محمية ضانا",      Governorate: "Tafilah",
    Type: "Nature / Eco-tourism",    UNESCO: "MAB Reserve",
    "Highlight": "Four bio-geographic zones; Dana village; Feynan Ecolodge; star gazing; hiking",
    "Best Time to Visit": "Mar–May, Sep–Nov",  "Entry Fee (JOD)": "Free (guide recommended)",
    Notes: "Jordan's largest reserve; 800+ plant species; Nubian ibex, sand cat, wolves"
  },
  {
    Site: "Ajloun Castle (Qal'at al-Rabad)","Arabic Name": "قلعة عجلون", Governorate: "Ajloun",
    Type: "Historical Fortress",     UNESCO: "No",
    "Highlight": "12th-century Islamic fortress; built by Saladin's general Izz al-Din Usama",
    "Best Time to Visit": "All year",             "Entry Fee (JOD)": "3",
    Notes: "Overlooking Jordan Valley; panoramic views; pine forest setting"
  },
  {
    Site: "Amman Citadel (Jabal al-Qal'a)","Arabic Name": "جبل القلعة", Governorate: "Amman",
    Type: "Archaeological (Multi-era)","UNESCO": "No",
    "Highlight": "Temple of Hercules; Umayyad Palace; Byzantine church; stunning Amman skyline views",
    "Best Time to Visit": "All year",             "Entry Fee (JOD)": "3.5",
    Notes: "Inhabited since Neolithic period; downtown Amman hilltop"
  },
  {
    Site: "Roman Theatre, Amman",    "Arabic Name": "المسرح الروماني", Governorate: "Amman",
    Type: "Archaeological (Roman)",  UNESCO: "No",
    "Highlight": "2nd-century AD; 6,000-seat capacity; still used for performances",
    "Best Time to Visit": "All year",             "Entry Fee (JOD)": "3.5",
    Notes: "Built during reign of Marcus Aurelius; includes the Odeon (500-seat)"
  },
  {
    Site: "Mount Nebo",              "Arabic Name": "جبل نيبو",        Governorate: "Madaba",
    Type: "Religious / Historical",  UNESCO: "No",
    "Highlight": "Where Moses viewed the Promised Land; Byzantine mosaics; views of Dead Sea & Jerusalem",
    "Best Time to Visit": "All year",             "Entry Fee (JOD)": "3",
    Notes: "Franciscan church; 4th-century mosaics; pilgrimage site"
  },
  {
    Site: "Madaba Mosaic Map",       "Arabic Name": "خريطة مادبا",     Governorate: "Madaba",
    Type: "Archaeological / Religious","UNESCO": "No",
    "Highlight": "World's oldest surviving cartographic depiction of the Holy Land in mosaic",
    "Best Time to Visit": "All year",             "Entry Fee (JOD)": "2",
    Notes: "6th-century Byzantine mosaic; St George's Church; 2.3 million tessera"
  },
  {
    Site: "Jordan Museum",           "Arabic Name": "المتحف الأردني",   Governorate: "Amman",
    Type: "Museum",                  UNESCO: "No",
    "Highlight": "Dead Sea Scrolls; prehistoric artifacts; Ain Ghazal statues (7500 BC); Islamic era",
    "Best Time to Visit": "All year",             "Entry Fee (JOD)": "4",
    Notes: "National museum; opened 2014; world-class collection"
  },
  {
    Site: "Aqaba Marine Park",       "Arabic Name": "المتنزه البحري العقبة", Governorate: "Aqaba",
    Type: "Marine / Diving",         UNESCO: "No",
    "Highlight": "Red Sea coral reefs; scuba diving; snorkelling; glass-bottom boat tours",
    "Best Time to Visit": "Year-round (water 20–27°C)", "Entry Fee (JOD)": "10 (park entry)",
    Notes: "ASEZA protected area; 200+ fish species; clear visibility; multiple dive centres"
  },
  {
    Site: "Baptism Site (Al-Maghtas)","Arabic Name": "الموقع الأثري المغطس", Governorate: "Balqa",
    Type: "Religious",               UNESCO: "Yes (2015)",
    "Highlight": "Where Jesus was baptised by John the Baptist; Jordan River; Byzantine churches",
    "Best Time to Visit": "All year",             "Entry Fee (JOD)": "12",
    Notes: "UNESCO World Heritage 2015; religious significance for Christians; active excavations"
  },
  {
    Site: "Azraq Wetland Reserve",   "Arabic Name": "محمية الأزرق",    Governorate: "Zarqa",
    Type: "Nature / Birdwatching",   UNESCO: "Ramsar Wetland",
    "Highlight": "Migratory bird sanctuary; 300+ species; Lawrence of Arabia HQ in WWI",
    "Best Time to Visit": "Oct–Apr (migration season)", "Entry Fee (JOD)": "3",
    Notes: "RSCN managed; oasis in the eastern desert; rare species including White Pelican"
  },
];

// ── 10. MAJOR CORPORATIONS ───────────────────────────────────────────────────

const corporations = [
  // TECH & STARTUPS
  { Sector: "Tech / Internet", Company: "Maktoob", Founded: 1999, Status: "Acquired", Notes: "Pioneer Arab internet portal; sold to Yahoo 2009 for $165M; spawned Jordan's startup ecosystem" },
  { Sector: "Tech / E-Commerce", Company: "Souq.com", Founded: 2005, Status: "Acquired by Amazon", Notes: "Arab world's largest e-commerce; acquired by Amazon 2017 for ~$650M; co-founded by Jordanian" },
  { Sector: "Tech / Books", Company: "Jamalon", Founded: 2010, Status: "Active", Notes: "Arab world's largest online bookstore; HQ Amman; 10M+ Arabic & English titles" },
  { Sector: "Tech / Gaming", Company: "Tamatem Games", Founded: 2013, Status: "Active", Notes: "Mobile gaming for Arabic market; 25M+ downloads; HQ Amman" },
  { Sector: "Tech / Content", Company: "Mawdoo3", Founded: 2011, Status: "Active", Notes: "Largest Arabic content platform; Wikipedia-like; 100M+ monthly visitors" },
  { Sector: "Tech / Animation", Company: "Kharabeesh", Founded: 2007, Status: "Active", Notes: "Leading Arabic animation & digital content studio" },
  { Sector: "Tech / Social", Company: "Jeeran", Founded: 2000, Status: "Active", Notes: "Early Arab social network & local business reviews; HQ Amman" },
  { Sector: "Tech / Logistics", Company: "Aramex", Founded: 1982, Status: "Public (ARMX.AD)", Notes: "Global logistics & courier; founded Amman; listed Abu Dhabi exchange; Jordan's first unicorn precursor" },
  { Sector: "Tech / Accelerator", Company: "Oasis500", Founded: 2010, Status: "Active", Notes: "Jordan's leading startup accelerator; 200+ startups funded; backed by King Abdullah" },
  { Sector: "Tech / Accelerator", Company: "Endeavor Jordan", Founded: 2004, Status: "Active", Notes: "Global entrepreneur support network; high-impact companies" },
  // PHARMA & HEALTHCARE
  { Sector: "Pharma", Company: "Hikma Pharmaceuticals", Founded: 1978, Status: "Public (HIK.L)", Notes: "LSE-listed global pharma; founded Amman; generics & injectables; operates in 50+ countries" },
  { Sector: "Pharma", Company: "Jordan Pharmaceutical Manufacturing (JPM)", Founded: 1978, Status: "Active", Notes: "Leading Jordanian generic drug manufacturer; GMP certified" },
  { Sector: "Healthcare", Company: "King Hussein Cancer Center", Founded: 2003, Status: "Public (JIC)", Notes: "Jordan's premier cancer care centre; JCI accredited; regional reference hospital" },
  { Sector: "Healthcare", Company: "Royal Medical Services (RMS)", Founded: 1950, Status: "Government", Notes: "Military/government healthcare network; largest in Jordan by bed count" },
  // RESOURCES & INDUSTRY
  { Sector: "Mining", Company: "Jordan Phosphate Mines Company (JPMC)", Founded: 1953, Status: "Public (JOPH.AM)", Notes: "One of world's largest phosphate producers; 20M+ tons/year; major export earner" },
  { Sector: "Mining", Company: "Arab Potash Company (APC)", Founded: 1956, Status: "Public (APOT.AM)", Notes: "Extracts potash from Dead Sea; 2M ton/year capacity; major global supplier" },
  { Sector: "Energy", Company: "Jordan Petroleum Refinery Company (JPRC)", Founded: 1956, Status: "Public", Notes: "Sole petroleum refinery in Jordan; Zarqa; 100,000 bbl/day" },
  // RETAIL & CONSUMER
  { Sector: "Supermarket", Company: "Carrefour Jordan", Founded: 1999, Status: "Active (franchise)", Notes: "10+ hypermarkets; operated by Majid Al Futtaim; largest supermarket chain" },
  { Sector: "Supermarket", Company: "Safeway Jordan", Founded: 1999, Status: "Active", Notes: "Premium supermarket; 5+ branches; strong in west Amman" },
  { Sector: "Supermarket", Company: "Cozmo (Lemongrass Group)", Founded: 2010, Status: "Active", Notes: "Upscale grocery & gourmet; 10+ branches; trendy west Amman" },
  { Sector: "Retail Mall", Company: "City Mall", Founded: 2005, Status: "Active", Notes: "Largest mall in Jordan; Mecca Street, Amman; 350+ stores; IKEA anchor" },
  { Sector: "Retail Mall", Company: "Mecca Mall", Founded: 1999, Status: "Active", Notes: "Pioneer enclosed mall; Sweifieh; 220+ stores" },
  { Sector: "Retail Mall", Company: "Taj Mall", Founded: 2008, Status: "Active", Notes: "Luxury mall; 7th Circle; premium brands; 230+ stores" },
  { Sector: "Retail Mall", Company: "Abdali Mall", Founded: 2016, Status: "Active", Notes: "Modern downtown Abdali development; 350+ stores; sky bridges" },
  { Sector: "Retail Mall", Company: "Avenue Mall", Founded: 2021, Status: "Active", Notes: "Newest large-format mall; South Amman; family-oriented" },
  // FOOD & BEVERAGE
  { Sector: "Food Delivery", Company: "Talabat Jordan", Founded: 2004, Status: "Active (Delivery Hero)", Notes: "Dominant food delivery app; 3,000+ restaurant partners; HQ Amman" },
  { Sector: "F&B", Company: "McDonald's Jordan (Ambitious Group)", Founded: 1994, Status: "Active (franchise)", Notes: "50+ locations; one of largest fast-food chains in Jordan" },
  { Sector: "F&B", Company: "KFC Jordan", Founded: 1998, Status: "Active (franchise)", Notes: "40+ locations; operated by Kuwait Food Company (Americana)" },
  { Sector: "F&B", Company: "Starbucks Jordan", Founded: 2000, Status: "Active (franchise)", Notes: "30+ locations; operated by Alshaya Group" },
  // RIDE-HAILING
  { Sector: "Mobility", Company: "Careem / Uber Jordan", Founded: 2015, Status: "Active", Notes: "Dominant ride-hailing; Careem acquired by Uber 2019; Jordan ops continue" },
  { Sector: "Mobility", Company: "InDriver Jordan", Founded: 2020, Status: "Active", Notes: "Price-negotiation model; growing market share among drivers" },
  // MEDIA
  { Sector: "Media", Company: "Roya TV", Founded: 2010, Status: "Active", Notes: "Leading private TV station; news, entertainment; most-watched in Jordan" },
  { Sector: "Media", Company: "Jordan Times", Founded: 1975, Status: "Active", Notes: "Jordan's oldest English-language daily newspaper" },
  { Sector: "Media", Company: "Al-Ghad", Founded: 2004, Status: "Active", Notes: "Leading Arabic-language daily; online edition among top news sites" },
];

// ── Load VENDORS from seed file ───────────────────────────────────────────────

function loadVendors() {
  try {
    const raw = fs.readFileSync(path.join(__dirname, "data/seed/vendors.ndjson"), "utf8");
    return raw.trim().split("\n").map((l) => {
      const v = JSON.parse(l);
      return {
        ID: v.id,
        "Business Name": v.businessName,
        Category: v.category,
        Description: v.description,
        Location: v.location,
        Website: v.websiteUrl,
        Instagram: v.instagramUrl,
        Status: v.status,
      };
    });
  } catch {
    return [];
  }
}

// ── Load Knowledge Graph (Master.csv) ────────────────────────────────────────

async function loadMaster() {
  const filePath = path.join(__dirname, "data/knowledge-graph/output/Master.csv");
  if (!fs.existsSync(filePath)) return [];

  const rows = [];
  const rl = readline.createInterface({ input: fs.createReadStream(filePath), crlfDelay: Infinity });
  let headers = null;
  for await (const line of rl) {
    if (!line.trim()) continue;
    const cols = parseCSVLine(line);
    if (!headers) { headers = cols; continue; }
    const obj = {};
    headers.forEach((h, i) => { obj[h] = cols[i] ?? ""; });
    // Flatten boolean-ish fields
    if (obj.gift_suitability) obj.gift_suitability = obj.gift_suitability === "True" ? "Yes" : "No";
    rows.push(obj);
  }
  return rows;
}

function parseCSVLine(line) {
  const result = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

// ── Build & save workbook ────────────────────────────────────────────────────

(async () => {
  console.log("Loading data...");
  const vendors = loadVendors();
  const masterRows = await loadMaster();
  console.log(`  Vendors: ${vendors.length}, Knowledge Graph: ${masterRows.length}`);

  const wb = XLSX.utils.book_new();

  // Sheet 1 – Overview
  const s1 = ws(overviewData, [{ wch: 38 }, { wch: 60 }]);
  XLSX.utils.book_append_sheet(wb, s1, "Overview");

  // Sheet 2 – Amman Neighborhoods
  const s2 = wsFromJson(neighborhoods, [
    { wch: 26 }, { wch: 20 }, { wch: 10 }, { wch: 12 },
    { wch: 18 }, { wch: 18 },
    { wch: 52 }, { wch: 60 }, { wch: 48 }, { wch: 52 }, { wch: 14 },
  ]);
  XLSX.utils.book_append_sheet(wb, s2, "Amman Neighborhoods");

  // Sheet 3 – Jordan Governorates
  const s3 = wsFromJson(governorates, [
    { wch: 4 }, { wch: 14 }, { wch: 18 }, { wch: 14 },
    { wch: 12 }, { wch: 12 }, { wch: 50 },
  ]);
  XLSX.utils.book_append_sheet(wb, s3, "Jordan Governorates");

  // Sheet 4 – Jordan Cities
  const s4 = wsFromJson(cities, [
    { wch: 12 }, { wch: 16 }, { wch: 14 }, { wch: 18 }, { wch: 50 },
  ]);
  XLSX.utils.book_append_sheet(wb, s4, "Jordan Cities");

  // Sheet 5 – Product Categories
  const s5 = wsFromJson(productCategories, [
    { wch: 4 }, { wch: 26 }, { wch: 22 }, { wch: 40 }, { wch: 34 },
  ]);
  XLSX.utils.book_append_sheet(wb, s5, "Product Categories");

  // Sheet 6 – Vendors
  if (vendors.length > 0) {
    const s6 = wsFromJson(vendors, [
      { wch: 6 }, { wch: 34 }, { wch: 24 }, { wch: 70 }, { wch: 16 },
      { wch: 36 }, { wch: 36 }, { wch: 10 },
    ]);
    XLSX.utils.book_append_sheet(wb, s6, "Vendors");
  }

  // Sheet 7 – Listings Category Breakdown
  const s7 = wsFromJson(listingBreakdown, [
    { wch: 30 }, { wch: 30 }, { wch: 10 }, { wch: 12 },
  ]);
  XLSX.utils.book_append_sheet(wb, s7, "Listings – Category Breakdown");

  // Sheet 8 – Knowledge Graph (full)
  if (masterRows.length > 0) {
    const s8 = XLSX.utils.json_to_sheet(masterRows);
    s8["!cols"] = [
      { wch: 38 }, { wch: 36 }, { wch: 36 }, { wch: 18 }, { wch: 22 },
      { wch: 60 }, { wch: 36 }, { wch: 28 }, { wch: 28 }, { wch: 16 },
      { wch: 22 }, { wch: 30 }, { wch: 14 }, { wch: 14 }, { wch: 10 },
      { wch: 10 }, { wch: 20 }, { wch: 10 }, { wch: 30 }, { wch: 30 },
      { wch: 22 }, { wch: 8 },  { wch: 20 }, { wch: 10 }, { wch: 24 },
      { wch: 8 },  { wch: 8 },  { wch: 8 },  { wch: 8 },  { wch: 8 }, { wch: 8 },
    ];
    XLSX.utils.book_append_sheet(wb, s8, "Knowledge Graph");
  }

  // Sheet 9 – Place Categories
  const s9 = wsFromJson(placeCategories, [
    { wch: 10 }, { wch: 30 }, { wch: 22 }, { wch: 22 },
  ]);
  XLSX.utils.book_append_sheet(wb, s9, "Place Categories");

  // Sheet 10 – Government Institutions
  const s10 = wsFromJson(govtInstitutions, [
    { wch: 16 }, { wch: 46 }, { wch: 36 }, { wch: 50 },
  ]);
  XLSX.utils.book_append_sheet(wb, s10, "Government Institutions");

  // Sheet 11 – Tourism Attractions
  const s11 = wsFromJson(tourismAttractions, [
    { wch: 28 }, { wch: 22 }, { wch: 14 }, { wch: 22 }, { wch: 12 },
    { wch: 60 }, { wch: 24 }, { wch: 22 }, { wch: 52 },
  ]);
  XLSX.utils.book_append_sheet(wb, s11, "Tourism Attractions");

  // Sheet 12 – Major Corporations
  const s12 = wsFromJson(corporations, [
    { wch: 22 }, { wch: 36 }, { wch: 10 }, { wch: 22 }, { wch: 70 },
  ]);
  XLSX.utils.book_append_sheet(wb, s12, "Major Corporations");

  const outPath = path.join(process.env.HOME, "Desktop", "ChatSouq_Jordan_Data.xlsx");
  XLSX.writeFile(wb, outPath);
  console.log(`\n✓ Saved: ${outPath}`);
  console.log(`  Sheets: ${wb.SheetNames.join(", ")}`);
})();
