"""
Outputs: ~/Desktop/ChatSouq_Jordan_Data/
  00_INDEX.csv
  01_amman_neighborhoods.csv
  02_jordan_governorates.csv
  03_jordan_cities.csv
  04_product_categories.csv
  05_vendors.csv
  06_product_listings.csv          (62,898 rows)
  07_products_supplement.csv
  08_listings_category_summary.csv
  09_knowledge_graph_master.csv    (8,305 rows)
  10_osm_places.csv                (8,350 rows)
  11_automotive_retail_ngo.csv
  12_business_directories.csv
  13_ecommerce_products.csv
  14_entertainment_sports.csv
  15_financial_services.csv
  16_government_institutions_raw.csv
  17_restaurants_ecommerce.csv
  18_technology_sector.csv
  19_tourism_healthcare_govt.csv
  20_place_categories_osm.csv
  21_government_institutions_curated.csv
  22_tourism_attractions_curated.csv
  23_major_corporations_curated.csv
"""

import csv, json, os
from pathlib import Path

BASE  = Path("/Users/Hamzeh23/Desktop/chatsouq/data")
RAW   = BASE / "knowledge-graph" / "raw"
KG    = BASE / "knowledge-graph" / "output"
SEED  = BASE / "seed"
OUT   = Path.home() / "Desktop" / "ChatSouq_Jordan_Data"
OUT.mkdir(exist_ok=True)

# UTF-8 with BOM so Arabic displays correctly when opened in Excel / Numbers
ENC = "utf-8-sig"

def w(filename, headers, rows):
    path = OUT / filename
    with open(path, "w", newline="", encoding=ENC) as f:
        writer = csv.writer(f, quoting=csv.QUOTE_MINIMAL)
        writer.writerow(headers)
        writer.writerows(rows)
    count = len(rows)
    print(f"  {filename}  ({count:,} rows)")
    return count

def load_ndjson(path):
    out = []
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                out.append(json.loads(line))
    return out

def load_json_list(path):
    with open(path, encoding="utf-8") as f:
        d = json.load(f)
    if isinstance(d, list):
        return d
    for key in ("businesses","places","institutions","items","entities","data"):
        if key in d:
            return d[key]
    return []

def load_csv_raw(path):
    rows = []
    with open(path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            rows.append(dict(row))
    return rows

def flat(val):
    """Flatten lists/dicts to readable strings."""
    if val is None:
        return ""
    if isinstance(val, list):
        return "; ".join(str(v) for v in val if v)
    if isinstance(val, dict):
        return "; ".join(f"{k}: {v}" for k, v in val.items() if v)
    return str(val).strip()

def dict_to_row(d, headers):
    return [flat(d.get(h)) for h in headers]

manifest = []   # for 00_INDEX

print("\nGenerating ChatSouq Jordan CSVs →", OUT)
print()

# ─────────────────────────────────────────────────────────────────
# 01  AMMAN NEIGHBORHOODS
# ─────────────────────────────────────────────────────────────────
headers = [
    "neighborhood", "name_arabic", "tier", "price_level",
    "rent_min_jod", "rent_max_jod", "area_location",
    "characteristics", "pros", "cons", "best_for"
]
rows = [
    ("Dabouq","دابوق","Luxury","$$$$",1000,3500,"Far West Amman",
     "Quiet villa district; Far west Amman; Lush greenery; Very private",
     "Most spacious & private; Large villas with gardens; Very low density; Excellent air quality",
     "Far from city center (30+ min); Car absolutely essential; Limited nearby shops",
     "High-budget families; Executives; Those wanting maximum space & privacy"),
    ("Abdoun","عبدون","Luxury","$$$$",900,2500,"West Amman – 5th Circle",
     "Embassy district; Tree-lined streets; Villas & upscale apartments; Near 5th Circle",
     "Prestige address; Extremely safe & secure; Near best restaurants in Amman; International community",
     "Car essential; Very high cost of living; Limited public transit",
     "Expats; Senior executives; Diplomatic families"),
    ("Deir Ghbar","دير غبار","Luxury","$$$$",800,2000,"West Amman – 5th Circle",
     "Quiet hilltop; Upscale residential; Private community feel; Near 5th Circle",
     "Panoramic city views; Very secure; Modern buildings; Close to Abdoun amenities",
     "Car essential; Limited walkability; Higher service charges",
     "Families; Expats; Professionals seeking quiet luxury"),
    ("Rabieh","الرابية","Upscale","$$$",700,1800,"West Amman – 4th/5th Circles",
     "Quiet suburban; Upscale housing; Near 4th & 5th circles; Green spaces",
     "Very peaceful & quiet; High-quality buildings; Good international schools nearby; Safe & secure",
     "Need a car; Limited walkability; Fewer cafes & shops",
     "Families with children; Expats; Professionals"),
    ("Um Uthaina","أم أذينة","Upscale","$$$",550,1200,"West Amman – 4th Circle",
     "Residential & commercial mix; Near 4th Circle; Well-connected; Many amenities",
     "Central-west location; Walkable to shops; Good schools & hospitals; Less traffic than Sweifieh",
     "Getting denser; Moderate traffic; Mixed commercial-residential",
     "Young professionals; Couples; Families who want convenience"),
    ("Sweifieh","الصويفية","Upscale","$$$",500,1100,"West Amman – Central",
     "Major shopping district; Cafes & restaurants; Active nightlife; Central-west Amman",
     "Everything within walking distance; Excellent transport; Great dining & entertainment; Lively atmosphere",
     "Heavy traffic congestion; Noisy; Parking nightmare; Higher rents for size",
     "Young singles & couples; Expats who like city energy; Those who don't need a car"),
    ("Shmeisani","الشميساني","Mid-Range","$$",450,900,"Central Amman",
     "Business & financial district; Banks & corporate offices; Central location; Good infrastructure",
     "Most central location in Amman; Walking distance to offices & banks; Great connectivity; Diverse amenities",
     "Commercial feel; Heavy peak-hour traffic; Less residential charm; Noisy on weekdays",
     "Business professionals; Singles; Those who work in the area"),
    ("Jabal Amman","جبل عمان","Mid-Range","$$",400,850,"Central Amman – 1st–4th Circles",
     "Historic trendy district; 1st–4th Circles; Rainbow Street; Cafes & boutiques",
     "Cultural & artsy vibe; Walkable neighbourhood; Best café & dining scene in Amman; Historic character",
     "Hilly terrain (hard on older people); Older buildings; Very limited parking",
     "Creatives & artists; Young professionals; Culture & food lovers"),
    ("Wadi Saqra / 3rd Circle","وادي صقرة / الدوار الثالث","Mid-Range","$$",350,800,"Central-West Amman",
     "Central-west Amman; Near 3rd Circle; Mix of residential & offices; Convenient location",
     "Very central; Good connectivity to all areas; Walkable to many services; Character neighbourhood",
     "Traffic at circles; Parking limited; Older building stock",
     "Young professionals; Singles; Couples who value central location"),
    ("Khalda","خلدا","Mid-Range","$$",380,780,"West Amman – University Area",
     "Established residential; Near University of Jordan; Family-oriented; Quieter pace",
     "Peaceful atmosphere; Family-friendly community; Reasonably priced for quality; Good schools & uni nearby",
     "Needs a car for most errands; Less entertainment & nightlife",
     "Families; Students at UJ; Those seeking quiet family life"),
    ("Tlaa Al-Ali","تلاع العلي","Mid-Range","$$",320,700,"West Amman – Suburbs",
     "Residential suburb; Newer developments; Family-focused; Quieter",
     "Modern apartments with good finishes; Spacious for the price; Family community feel; Less congested",
     "Further from city center (20+ min); Car essential; Less entertainment",
     "Young families; Those seeking space at reasonable cost"),
    ("Sweileh","سويلح","Mid-Range","$",250,550,"West Amman – University Area",
     "Near University of Jordan; Active area; Mixed residential-commercial; Affordable",
     "Very affordable for west Amman; Busy local scene; Good transport options; Near university",
     "Can be chaotic; Heavy traffic on main roads; Less polished environment",
     "Students; Budget-conscious professionals; University staff"),
    ("Jubeiha","الجبيهة","Budget","$",220,480,"West Amman – University Hub",
     "University student hub; Affordable; Lively local cafes; Near UJ & JUST",
     "Lowest-cost option in west Amman; Lively student atmosphere; Many cheap eats & cafes",
     "Noisier & busier; Less polished; Can feel overcrowded in student season",
     "University students; Young budget renters; Those on tight budgets near campus"),
    ("Jabal Hussein","جبل الحسين","Budget","$",180,400,"Central East Amman",
     "Central east Amman; Dense residential; Affordable; Local markets",
     "Very central location; Affordable rents; Good public transport; Strong local community",
     "Dense & crowded; Older buildings; Limited amenities",
     "Budget renters; Those needing central location on tight budget; Local families"),
    ("Jabal Al-Nuzha","جبل النزهة","Budget","$",150,350,"East Amman",
     "East Amman residential; Affordable; Family neighbourhood; Local community",
     "Affordable family apartments; Good community feel; Accessible public transport",
     "Limited modern amenities; Older building stock; Distance from west Amman",
     "Families on tight budgets; Local Jordanians; Those working in east Amman"),
    ("Marka","ماركا","Budget","$",130,320,"East Amman",
     "East Amman; Working-class area; Very affordable; Near airport road",
     "Cheapest rents in Amman; Near Queen Alia Highway; Strong local community",
     "Far from west Amman amenities; Older housing stock; Less infrastructure",
     "Very tight budgets; Those working near the airport or east Amman"),
    ("Sahab","سحاب","Budget","$",110,280,"South-East Amman",
     "South-east Amman suburb; Industrial area; Very affordable; Spacious",
     "Lowest rents in greater Amman area; Larger apartments for price; Quiet residential streets",
     "Very far from city center (30+ min drive); Limited local services; Far from top schools",
     "Extremely tight budgets; Those working in industrial areas; Large families needing space"),
]
n = w("01_amman_neighborhoods.csv", headers, rows)
manifest.append(("01_amman_neighborhoods.csv", "Amman Neighborhoods", n, "17 districts – tier, JOD rent range, characteristics, pros, cons, best-for audience"))

# ─────────────────────────────────────────────────────────────────
# 02  JORDAN GOVERNORATES
# ─────────────────────────────────────────────────────────────────
headers = ["number","governorate","name_arabic","capital_city","lat_n","lng_e","notes"]
rows = [
    (1,"Amman","عمّان","Amman",31.95,35.93,"Largest governorate; political & economic capital; 4.2M+ population"),
    (2,"Irbid","إربد","Irbid",32.55,35.85,"2nd most populous; northern Jordan; major university city (JUST, Yarmouk)"),
    (3,"Zarqa","الزرقاء","Zarqa",32.07,36.09,"Industrial centre; large Syrian refugee population"),
    (4,"Mafraq","المفرق","Mafraq",32.34,36.21,"Border with Syria; large Bedouin community; eastern desert"),
    (5,"Balqa","البلقاء","Salt (Al-Salt)",32.04,35.73,"Includes Dead Sea (Sweimeh area); Salt is UNESCO World Heritage (2021)"),
    (6,"Madaba","مادبا","Madaba",31.72,35.79,"Famous Byzantine mosaic map; Wadi Mujib reserve; Christian heritage"),
    (7,"Karak","الكرك","Karak",31.18,35.70,"Crusader-era Karak Castle; King's Highway; agricultural south"),
    (8,"Tafilah","الطفيلة","Tafilah",30.84,35.60,"Dana Biosphere Reserve; relatively rural and sparsely populated"),
    (9,"Ma'an","معان","Ma'an",30.19,35.73,"Largest by area; gateway to Petra & Wadi Rum; desert landscape"),
    (10,"Aqaba","العقبة","Aqaba",29.53,35.01,"Only seaport; Red Sea coast; ASEZA free economic zone"),
    (11,"Jerash","جرش","Jerash",32.27,35.90,"Best-preserved Roman city in Jordan; 'Pompeii of the East'"),
    (12,"Ajloun","عجلون","Ajloun",32.33,35.75,"Saladin-era Ajloun Castle; pine forest reserve; eco-tourism"),
]
n = w("02_jordan_governorates.csv", headers, rows)
manifest.append(("02_jordan_governorates.csv", "Jordan Governorates", n, "All 12 governorates with geographic centroids and notes"))

# ─────────────────────────────────────────────────────────────────
# 03  JORDAN CITIES
# ─────────────────────────────────────────────────────────────────
headers = ["city","name_arabic","governorate","population_estimate","role_and_notes"]
rows = [
    ("Amman","عمّان","Amman","4,200,000+","Capital; political, economic & cultural hub of Jordan"),
    ("Irbid","إربد","Irbid","660,000+","Northern university city (JUST, Yarmouk); Jordan's 2nd largest city"),
    ("Zarqa","الزرقاء","Zarqa","600,000+","Industrial & manufacturing hub; Jordan's 3rd largest city"),
    ("Aqaba","العقبة","Aqaba","148,000+","Red Sea port; tourism & ASEZA free economic zone"),
    ("Salt","السلط","Balqa","90,000+","UNESCO World Heritage Site (2021); historic Ottoman trade city"),
    ("Madaba","مادبا","Madaba","60,000+","City of mosaics; Christian heritage; tourism gateway"),
    ("Jerash","جرش","Jerash","50,000+","Roman ruins – one of best-preserved in the world"),
    ("Karak","الكرك","Karak","45,000+","Historic Crusader castle; agricultural market town"),
    ("Mafraq","المفرق","Mafraq","40,000+","Border city; gateway to eastern desert & Iraq"),
    ("Petra (Wadi Musa)","البتراء","Ma'an","25,000+","UNESCO World Heritage; New Seven Wonders of the World"),
]
n = w("03_jordan_cities.csv", headers, rows)
manifest.append(("03_jordan_cities.csv", "Jordan Cities", n, "Major Jordanian cities with Arabic names, population and role"))

# ─────────────────────────────────────────────────────────────────
# 04  PRODUCT CATEGORIES
# ─────────────────────────────────────────────────────────────────
headers = ["number","canonical_category","name_arabic","subcategory_examples","raw_source_categories","key_vendors"]
rows = [
    (1,"Beauty & Skincare","العناية بالبشرة","Serums, moisturisers, cleansers, sunscreen, toners, face masks","beauty & skincare; personal care; nail care","Beauty Box Jordan; Gifts Center"),
    (2,"Makeup","مكياج","Lipstick, foundation, eyeshadow, mascara, concealer, blush, primer","makeup","Beauty Box Jordan"),
    (3,"Hair Care","العناية بالشعر","Shampoo, conditioner, hair dryers, hair oil, hair mask, hair serum","hair & beauty","Beauty Box Jordan"),
    (4,"Perfume & Fragrance","عطور","EDP, EDT, cologne, oud, body mist, deodorant, gift sets","perfume & fragrance","Gifts Center; Beauty Box Jordan"),
    (5,"Health & Wellness","الصحة والعافية","Vitamins, supplements, dental care, oral-b, thermometers, first aid","health & wellness","Various"),
    (6,"Mobile Phones","هواتف ذكية","iPhone, Samsung Galaxy, Xiaomi, Huawei, OPPO, phone cases","mobile phones","Multi-vendor"),
    (7,"Tablets","أجهزة لوحية","iPad, Samsung Galaxy Tab, Lenovo Tab, Huawei MatePad","tablets","Multi-vendor"),
    (8,"Computers & Laptops","أجهزة كمبيوتر","MacBook, Dell, HP, Lenovo, Asus; monitors, keyboards, mice, webcams","computers & laptops","Multi-vendor"),
    (9,"Audio & Headphones","سماعات وصوتيات","Headphones, earbuds, AirPods, TWS, speakers, soundbars, headsets","audio & sound","Multi-vendor"),
    (10,"TVs & Displays","تلفزيونات وشاشات","Smart TV, OLED, 4K, curved, projectors, TV stands","tvs & displays","Multi-vendor"),
    (11,"Cameras","كاميرات","DSLR, mirrorless, GoPro, action cameras, lenses, tripods, gimbals","cameras","Multi-vendor"),
    (12,"Gaming","ألعاب إلكترونية","PS5, Xbox Series, Nintendo Switch, controllers, gaming chairs, headsets","gaming","Multi-vendor"),
    (13,"Electronics & Accessories","إلكترونيات وملحقات","Chargers, cables, power banks, HDMI, USB hubs, routers, SD cards, adapters","electronics accessories; networking; printers & scanners; smart home & security; accessories","Multi-vendor"),
    (14,"Home Appliances","أجهزة منزلية","Blenders, microwaves, fridges, vacuum cleaners, kettles, irons, fans, air conditioners","home appliances","Multi-vendor"),
    (15,"Home & Living","المنزل والديكور","Vases, plants, cushions, candles, lamps, curtains, bedding, rugs, towels","home & living; lighting; vases & planters; faux flowers & plants; bouquets & arrangements","Vyne Flower Boutique"),
    (16,"Watches & Accessories","ساعات وإكسسوارات","Smartwatch, luxury watch, fashion watch, straps, wristbands, smart bands","watches & accessories","Gifts Center; Multi-vendor"),
    (17,"Jewelry","مجوهرات","Necklaces, rings, bracelets, earrings, pendants, gold, silver, gemstones","jewelry","Gifts Center"),
    (18,"Bags & Luggage","حقائب وأمتعة","Backpacks, handbags, suitcases, trolleys, wallets, purses; brands: Samsonite, Rimowa","bags & backpacks; bags & accessories","Multi-vendor"),
    (19,"Toys & Games","ألعاب أطفال","LEGO, dolls, remote control cars, puzzles, board games, action figures","toys & games","Multi-vendor"),
    (20,"Baby & Kids","مستلزمات الأطفال","Strollers, baby food, diapers, nursery decor, car seats, baby monitors","baby & kids","Multi-vendor"),
    (21,"Food & Gourmet","أطعمة فاخرة","Belgian chocolates, specialty coffee, tea, honey, dates, gourmet gift boxes","belgian chocolates; coffee & beverages","Neuhaus Belgian Chocolates; Multi-vendor"),
    (22,"Sports & Outdoors","رياضة وأماكن مفتوحة","Dumbbells, yoga mats, treadmills, tents, sleeping bags, bicycles, camping gear","sports & fitness; outdoor & camping; camping kitchen; sleeping gear; tents & shelters","Multi-vendor"),
    (23,"Stationery & Office","قرطاسية ومكتبيات","Notebooks, pens, planners, agendas, art supplies, office furniture","stationery","Multi-vendor"),
]
n = w("04_product_categories.csv", headers, rows)
manifest.append(("04_product_categories.csv", "Product Categories", n, "23 canonical product departments – Arabic names, subcategories, raw source mappings"))

# ─────────────────────────────────────────────────────────────────
# 05  VENDORS
# ─────────────────────────────────────────────────────────────────
vendors = load_ndjson(SEED / "vendors.ndjson")
headers = ["vendor_id","business_name","category","description","location","website_url","instagram_url","status"]
rows = [
    [v.get("id",""), v.get("businessName",""), v.get("category",""),
     v.get("description",""), v.get("location",""),
     v.get("websiteUrl",""), v.get("instagramUrl",""), v.get("status","")]
    for v in vendors
]
n = w("05_vendors.csv", headers, rows)
manifest.append(("05_vendors.csv", "Vendors", n, "All 64 verified Jordan vendors – category, description, website, Instagram"))

# ─────────────────────────────────────────────────────────────────
# 06  PRODUCT LISTINGS  (full 62,898)
# ─────────────────────────────────────────────────────────────────
print("  Loading 62,898 product listings…", end=" ", flush=True)
listings = load_ndjson(SEED / "listings.ndjson")
headers = ["listing_id","vendor_id","name","category","brand","price","currency","image_url","source_url","search_text","description"]
rows = [
    [l.get("id",""), l.get("vendorId",""), l.get("name",""),
     l.get("category",""), l.get("brand",""),
     l.get("price",""), l.get("currency","JOD"),
     l.get("imageUrl",""), l.get("sourceUrl",""),
     l.get("searchText",""), (l.get("description") or "")]
    for l in listings
]
n = w("06_product_listings.csv", headers, rows)
manifest.append(("06_product_listings.csv", "Product Listings", n, "Full product catalogue – name, category, brand, price (JOD), URLs, description"))

# ─────────────────────────────────────────────────────────────────
# 07  PRODUCTS SUPPLEMENT
# ─────────────────────────────────────────────────────────────────
supp = load_ndjson(SEED / "products_supplement.ndjson")
if supp:
    all_keys = list(dict.fromkeys(k for row in supp for k in row))
    rows = [[flat(row.get(k)) for k in all_keys] for row in supp]
    n = w("07_products_supplement.csv", all_keys, rows)
    manifest.append(("07_products_supplement.csv", "Products Supplement", n, "14 additional curated product entries"))

# ─────────────────────────────────────────────────────────────────
# 08  LISTINGS CATEGORY SUMMARY
# ─────────────────────────────────────────────────────────────────
from collections import Counter
counts = Counter(l.get("category","Unknown") for l in listings)
total = sum(counts.values())
summary = sorted(counts.items(), key=lambda x: -x[1])
headers = ["raw_category","listing_count","pct_of_total"]
rows = [[cat, cnt, f"{cnt/total*100:.2f}%"] for cat, cnt in summary]
rows.append(["TOTAL", total, "100.00%"])
n = w("08_listings_category_summary.csv", headers, rows)
manifest.append(("08_listings_category_summary.csv", "Listings Category Summary", n, "Count of listings per raw category (52 categories, 62,898 total)"))

# ─────────────────────────────────────────────────────────────────
# 09  KNOWLEDGE GRAPH MASTER
# ─────────────────────────────────────────────────────────────────
print("  Loading Knowledge Graph Master…", end=" ", flush=True)
master = load_csv_raw(KG / "Master.csv")
if master:
    headers = list(master[0].keys())
    rows = [[row.get(h,"") for h in headers] for row in master]
    n = w("09_knowledge_graph_master.csv", headers, rows)
    manifest.append(("09_knowledge_graph_master.csv", "Knowledge Graph – Master", n, "All entities: services, food, tourism, healthcare, education, government, retail"))

# ─────────────────────────────────────────────────────────────────
# 10  OSM PLACES
# ─────────────────────────────────────────────────────────────────
print("  Loading OSM Places…", end=" ", flush=True)
places = load_json_list(RAW / "places.json")
if places:
    all_keys = list(dict.fromkeys(k for row in places for k in row))
    rows = [[flat(row.get(k)) for k in all_keys] for row in places]
    n = w("10_osm_places.csv", all_keys, rows)
    manifest.append(("10_osm_places.csv", "OSM Places (Raw)", n, "8,350 OpenStreetMap places across Jordan – name, category, city, lat/lng, website"))

# ─────────────────────────────────────────────────────────────────
# 11–19  RAW KNOWLEDGE GRAPH SOURCE FILES
# ─────────────────────────────────────────────────────────────────
raw_files = [
    ("11_automotive_retail_ngo.csv",       "automotive_retail_ngo.json",       "Automotive, Retail & NGO",       "Car dealers, retail chains, NGOs and non-profits"),
    ("12_business_directories.csv",         "business_directories.json",         "Business Directories",           "Curated businesses: restaurants, shops, services with contact details"),
    ("13_ecommerce_products.csv",           "ecommerce_products.json",           "E-Commerce Products",            "502 curated e-commerce product entries with price and vendor"),
    ("14_entertainment_sports.csv",         "entertainment_sports.json",         "Entertainment & Sports",         "Venues, sports clubs, cinemas, cultural centres"),
    ("15_financial_services.csv",           "financial_services.json",           "Financial Services",             "Banks, insurance, money exchange, investment firms"),
    ("16_government_institutions_raw.csv",  "jordan_government_institutions.json","Government Institutions (Raw)", "Ministries, departments and public authorities with descriptions"),
    ("17_restaurants_ecommerce.csv",        "restaurants_ecommerce.json",        "Restaurants & E-Commerce",       "Restaurants and online retail businesses"),
    ("18_technology_sector.csv",            "technology_sector.json",            "Technology Sector",              "Tech companies, startups, accelerators and digital businesses"),
    ("19_tourism_healthcare_govt.csv",      "tourism_healthcare_govt.json",      "Tourism, Healthcare & Govt",     "Tourism sites, hospitals, clinics and government offices"),
]
for filename, source, label, desc in raw_files:
    data = load_json_list(RAW / source)
    if data:
        all_keys = list(dict.fromkeys(k for row in data for k in row))
        rows = [[flat(row.get(k)) for k in all_keys] for row in data]
        n = w(filename, all_keys, rows)
        manifest.append((filename, label, n, desc))

# ─────────────────────────────────────────────────────────────────
# 20  PLACE CATEGORIES (OSM)
# ─────────────────────────────────────────────────────────────────
headers = ["osm_type","osm_key_value","normalised_label","group"]
rows = [
    ("Amenity","amenity=restaurant","Restaurant","Food & Beverage"),
    ("Amenity","amenity=cafe","Cafe","Food & Beverage"),
    ("Amenity","amenity=fast_food","Fast Food","Food & Beverage"),
    ("Amenity","amenity=bar","Bar","Food & Beverage"),
    ("Amenity","amenity=pub","Pub","Food & Beverage"),
    ("Amenity","amenity=ice_cream","Ice Cream","Food & Beverage"),
    ("Amenity","amenity=food_court","Food Court","Food & Beverage"),
    ("Amenity","amenity=pharmacy","Pharmacy","Healthcare"),
    ("Amenity","amenity=hospital","Hospital","Healthcare"),
    ("Amenity","amenity=clinic","Clinic","Healthcare"),
    ("Amenity","amenity=doctors","Doctors","Healthcare"),
    ("Amenity","amenity=dentist","Dentist","Healthcare"),
    ("Amenity","amenity=veterinary","Veterinary","Healthcare"),
    ("Amenity","amenity=bank","Bank","Financial"),
    ("Amenity","amenity=bureau_de_change","Currency Exchange","Financial"),
    ("Amenity","amenity=atm","ATM","Financial"),
    ("Amenity","amenity=fuel","Gas Station","Transport"),
    ("Amenity","amenity=car_rental","Car Rental","Transport"),
    ("Amenity","amenity=bus_station","Bus Station","Transport"),
    ("Amenity","amenity=taxi","Taxi Stand","Transport"),
    ("Amenity","amenity=car_wash","Car Wash","Automotive"),
    ("Amenity","amenity=cinema","Cinema","Entertainment"),
    ("Amenity","amenity=theatre","Theatre","Entertainment"),
    ("Amenity","amenity=nightclub","Nightclub","Entertainment"),
    ("Amenity","amenity=events_venue","Events Venue","Entertainment"),
    ("Amenity","amenity=marketplace","Marketplace","Retail"),
    ("Amenity","amenity=school","School","Education"),
    ("Amenity","amenity=university","University","Education"),
    ("Amenity","amenity=college","College","Education"),
    ("Amenity","amenity=kindergarten","Kindergarten","Education"),
    ("Amenity","amenity=library","Library","Education"),
    ("Amenity","amenity=language_school","Language School","Education"),
    ("Amenity","amenity=gym","Gym","Health & Fitness"),
    ("Amenity","amenity=spa","Spa","Health & Fitness"),
    ("Amenity","amenity=post_office","Post Office","Government"),
    ("Amenity","amenity=police","Police Station","Government"),
    ("Amenity","amenity=fire_station","Fire Station","Government"),
    ("Amenity","amenity=government","Government Office","Government"),
    ("Amenity","amenity=embassy","Embassy","Government"),
    ("Amenity","amenity=coworking_space","Coworking Space","Business"),
    ("Amenity","amenity=community_centre","Community Centre","Social"),
    ("Amenity","amenity=place_of_worship","Mosque / Church","Religious"),
    ("Shop","shop=supermarket","Supermarket","Retail"),
    ("Shop","shop=convenience","Convenience Store","Retail"),
    ("Shop","shop=bakery","Bakery","Food & Beverage"),
    ("Shop","shop=butcher","Butcher","Food & Beverage"),
    ("Shop","shop=greengrocer","Greengrocer","Food & Beverage"),
    ("Shop","shop=confectionery","Sweets","Food & Beverage"),
    ("Shop","shop=pastry","Pastry","Food & Beverage"),
    ("Shop","shop=coffee","Coffee Shop","Food & Beverage"),
    ("Shop","shop=tea","Tea Shop","Food & Beverage"),
    ("Shop","shop=clothes","Clothing","Retail – Fashion"),
    ("Shop","shop=shoes","Shoes","Retail – Fashion"),
    ("Shop","shop=jewelry","Jewelry","Retail – Fashion"),
    ("Shop","shop=watches","Watches","Retail – Fashion"),
    ("Shop","shop=bags","Bags","Retail – Fashion"),
    ("Shop","shop=tailor","Tailor","Retail – Fashion"),
    ("Shop","shop=fabric","Fabric","Retail – Fashion"),
    ("Shop","shop=mobile_phone","Mobile Phones","Retail – Electronics"),
    ("Shop","shop=electronics","Electronics","Retail – Electronics"),
    ("Shop","shop=computer","Computers","Retail – Electronics"),
    ("Shop","shop=furniture","Furniture","Retail – Home"),
    ("Shop","shop=hardware","Hardware Store","Retail – Home"),
    ("Shop","shop=houseware","Houseware","Retail – Home"),
    ("Shop","shop=car","Car Dealer","Automotive"),
    ("Shop","shop=car_repair","Car Repair","Automotive"),
    ("Shop","shop=car_parts","Car Parts","Automotive"),
    ("Shop","shop=bicycle","Bicycle Shop","Sports"),
    ("Shop","shop=books","Bookstore","Retail"),
    ("Shop","shop=stationery","Stationery","Retail"),
    ("Shop","shop=gift","Gift Shop","Retail"),
    ("Shop","shop=toys","Toys","Retail"),
    ("Shop","shop=sports","Sporting Goods","Retail"),
    ("Shop","shop=beauty","Beauty","Retail – Beauty"),
    ("Shop","shop=hairdresser","Salon","Retail – Beauty"),
    ("Shop","shop=cosmetics","Cosmetics","Retail – Beauty"),
    ("Shop","shop=perfumery","Perfume","Retail – Beauty"),
    ("Shop","shop=optician","Optician","Healthcare"),
    ("Shop","shop=florist","Florist","Retail"),
    ("Shop","shop=mall","Shopping Mall","Retail"),
    ("Shop","shop=department_store","Department Store","Retail"),
    ("Shop","shop=music","Music Store","Retail"),
    ("Shop","shop=pet","Pet Shop","Retail"),
    ("Shop","shop=outdoor","Outdoor / Camping","Sports"),
    ("Tourism","tourism=hotel","Hotel","Accommodation"),
    ("Tourism","tourism=motel","Motel","Accommodation"),
    ("Tourism","tourism=hostel","Hostel","Accommodation"),
    ("Tourism","tourism=guest_house","Guest House","Accommodation"),
    ("Tourism","tourism=apartment","Serviced Apartment","Accommodation"),
    ("Tourism","tourism=museum","Museum","Tourism"),
    ("Tourism","tourism=attraction","Attraction","Tourism"),
    ("Tourism","tourism=gallery","Gallery","Tourism"),
    ("Tourism","tourism=viewpoint","Viewpoint","Tourism"),
    ("Tourism","tourism=camp_site","Campsite","Tourism"),
    ("Tourism","tourism=theme_park","Theme Park","Entertainment"),
    ("Tourism","tourism=zoo","Zoo","Entertainment"),
    ("Tourism","tourism=information","Tourist Information","Tourism"),
    ("Leisure","leisure=fitness_centre","Gym","Health & Fitness"),
    ("Leisure","leisure=sports_centre","Sports Center","Health & Fitness"),
    ("Leisure","leisure=stadium","Stadium","Sports"),
    ("Leisure","leisure=park","Park","Outdoor"),
    ("Leisure","leisure=garden","Garden","Outdoor"),
    ("Leisure","leisure=playground","Playground","Outdoor"),
    ("Leisure","leisure=swimming_pool","Swimming Pool","Health & Fitness"),
    ("Leisure","leisure=water_park","Water Park","Entertainment"),
    ("Leisure","leisure=golf_course","Golf Course","Sports"),
    ("Leisure","leisure=marina","Marina","Outdoor"),
    ("Leisure","leisure=dance","Dance Studio","Health & Fitness"),
    ("Leisure","leisure=bowling_alley","Bowling Alley","Entertainment"),
    ("Leisure","leisure=nature_reserve","Nature Reserve","Outdoor"),
    ("Leisure","leisure=horse_riding","Horse Riding","Sports"),
    ("Healthcare","healthcare=pharmacy","Pharmacy","Healthcare"),
    ("Healthcare","healthcare=hospital","Hospital","Healthcare"),
    ("Healthcare","healthcare=clinic","Clinic","Healthcare"),
    ("Healthcare","healthcare=doctor","Doctor","Healthcare"),
    ("Healthcare","healthcare=dentist","Dentist","Healthcare"),
    ("Healthcare","healthcare=laboratory","Medical Lab","Healthcare"),
    ("Healthcare","healthcare=physiotherapist","Physiotherapy","Healthcare"),
    ("Healthcare","healthcare=optometrist","Optician","Healthcare"),
    ("Healthcare","healthcare=blood_bank","Blood Bank","Healthcare"),
    ("Office","office=estate_agent","Real Estate Agency","Business"),
    ("Office","office=insurance","Insurance","Business"),
    ("Office","office=lawyer","Law Firm","Business"),
    ("Office","office=accountant","Accounting","Business"),
    ("Office","office=government","Government Office","Government"),
    ("Office","office=travel_agent","Travel Agency","Business"),
    ("Office","office=coworking","Coworking Space","Business"),
    ("Office","office=company","Company","Business"),
    ("Office","office=it","IT Company","Technology"),
    ("Office","office=telecommunication","Telecom Office","Technology"),
    ("Office","office=employment_agency","Employment Agency","Business"),
    ("Office","office=ngo","NGO / Non-Profit","Social"),
]
n = w("20_place_categories_osm.csv", headers, rows)
manifest.append(("20_place_categories_osm.csv", "Place Categories (OSM)", n, "All normalised OpenStreetMap place types used in the ChatSouq places engine"))

# ─────────────────────────────────────────────────────────────────
# 21  GOVERNMENT INSTITUTIONS CURATED
# ─────────────────────────────────────────────────────────────────
headers = ["sector","institution","name_arabic","notes"]
rows = [
    ("Ministry","Ministry of Finance","وزارة المالية","Fiscal policy, national budget, taxation and public debt"),
    ("Ministry","Ministry of Interior","وزارة الداخلية","Civil status, passports, residency permits, national security"),
    ("Ministry","Ministry of Health","وزارة الصحة","Healthcare regulation, public hospitals, drug licensing"),
    ("Ministry","Ministry of Education","وزارة التربية والتعليم","K-12 public education curriculum and school administration"),
    ("Ministry","Ministry of Higher Education & Scientific Research","وزارة التعليم العالي","Universities, academic accreditation, research funding"),
    ("Ministry","Ministry of Tourism & Antiquities","وزارة السياحة والآثار","Tourism promotion, archaeological site management, heritage conservation"),
    ("Ministry","Ministry of Trade & Industry","وزارة الصناعة والتجارة","Business registration, trade policy, competition regulation, consumer protection"),
    ("Ministry","Ministry of Energy & Mineral Resources","وزارة الطاقة والثروة المعدنية","Energy, oil, gas, renewable energy, mining and mineral policy"),
    ("Ministry","Ministry of Transport","وزارة النقل","Road network, aviation policy, maritime transport, public transit"),
    ("Ministry","Ministry of Agriculture","وزارة الزراعة","Food security, farming policy, water allocation for agriculture"),
    ("Ministry","Ministry of Labor","وزارة العمل","Employment law, work permits, labor disputes, occupational safety"),
    ("Ministry","Ministry of Justice","وزارة العدل","Courts, judiciary, legal reform, notary services"),
    ("Ministry","Ministry of Foreign Affairs","وزارة الخارجية","Diplomatic relations, visa policy, Jordanian embassies abroad"),
    ("Ministry","Ministry of Digital Economy & Entrepreneurship","وزارة الاقتصاد الرقمي","Tech policy, digital transformation, startup ecosystem, e-government"),
    ("Ministry","Ministry of Water & Irrigation","وزارة المياه والري","Water resources management, irrigation, dams"),
    ("Ministry","Ministry of Environment","وزارة البيئة","Environmental regulation, nature reserves, climate policy"),
    ("Ministry","Ministry of Social Development","وزارة التنمية الاجتماعية","Social welfare, NGO licensing, poverty alleviation, disability services"),
    ("Ministry","Ministry of Communication & IT","وزارة الاتصالات","Telecom regulation, internet policy, postal services"),
    ("Central / Regulatory","Central Bank of Jordan (CBJ)","البنك المركزي الأردني","Monetary policy, JOD currency management, banking sector oversight, payment systems"),
    ("Central / Regulatory","Jordan Securities Commission (JSC)","هيئة الأوراق المالية","Capital markets regulator; oversees ASE listings and disclosure"),
    ("Central / Regulatory","Amman Stock Exchange (ASE)","بورصة عمّان","National stock exchange; 250+ listed companies; established 1978"),
    ("Central / Regulatory","Greater Amman Municipality (GAM)","أمانة عمّان الكبرى","Amman city administration, urban planning, roads, public services"),
    ("Central / Regulatory","Aqaba Special Economic Zone Authority (ASEZA)","سلطة منطقة العقبة الاقتصادية الخاصة","Manages Aqaba free economic zone; tax incentives; investment attraction"),
    ("Central / Regulatory","Jordan Investment Commission (JIC)","هيئة الاستثمار الأردنية","FDI facilitation, investor services, licensing one-stop-shop"),
    ("Central / Regulatory","Jordan Customs Department","دائرة الجمارك الأردنية","Import/export duties, border control, trade compliance"),
    ("Central / Regulatory","Civil Status & Passports Dept. (DCSPS)","دائرة الأحوال المدنية والجوازات","National IDs, passports, birth & marriage certificates"),
    ("Central / Regulatory","Income & Sales Tax Department","دائرة ضريبة الدخل والمبيعات","Direct & indirect tax collection; GST-equivalent 16%"),
    ("Utility","National Electric Power Co. (NEPCO)","شركة الكهرباء الوطنية","National electricity transmission grid; wholesale market operator"),
    ("Utility","Water Authority of Jordan (WAJ)","سلطة المياه","Drinking water supply, wastewater treatment, infrastructure"),
    ("Utility","Jordan Electricity Company (JEA)","شركة كهرباء الأردن","Electricity distribution in greater Amman region"),
    ("Bank","Arab Bank","البنك العربي","Largest Arab bank by assets; HQ Amman since 1930; 600+ branches worldwide"),
    ("Bank","Bank of Jordan","بنك الأردن","Full-service retail & commercial banking; 90+ Jordan branches"),
    ("Bank","Housing Bank for Trade & Finance","بنك الإسكان للتجارة والتمويل","Largest bank by total assets in Jordan; strong mortgage & retail portfolio"),
    ("Bank","Jordan Ahli Bank","البنك الأهلي الأردني","Retail banking; 75+ branches; strong SME focus"),
    ("Bank","Cairo Amman Bank","بنك القاهرة عمّان","Retail & SME focus; 80+ branches; operates eFAWATEERcom blink"),
    ("Bank","Jordan Islamic Bank (JIB)","البنك الإسلامي الأردني","Largest Islamic bank in Jordan; 100% Shariah-compliant; AlBaraka Group member"),
    ("Bank","Safwa Islamic Bank","بنك صفوة الإسلامي","Islamic banking with growing mobile/digital capabilities"),
    ("Bank","Capital Bank","بنك كابيتال","Corporate & investment banking; regional operations"),
    ("Bank","Jordan Kuwait Bank (JKB)","البنك الأردني الكويتي","Retail banking; partially Kuwaiti-owned; 40+ branches"),
    ("Bank","Arab Jordan Investment Bank (AJIB)","البنك العربي الأردني للاستثمار","Investment & corporate banking; treasury services"),
    ("Digital Bank","Blink (by Cairo Amman Bank)","بلنك","Jordan's first fully digital bank; app-only; instant account opening"),
    ("Digital Bank","Reflect (by Bank al Etihad)","ريفلكت","Mobile-first digital banking; no branches; AI-powered personal finance"),
    ("Telecom","Zain Jordan","زين الأردن","Largest operator by subscribers; nationwide 4G; rolling out 5G"),
    ("Telecom","Orange Jordan","أورنج الأردن","Fixed-line & mobile; Orange Group subsidiary; strong FTTH fibre network"),
    ("Telecom","Umniah","أمنية","Budget mobile operator; Bahrain Telecom (Batelco) subsidiary"),
    ("Telecom","Jordan Telecom Group (JTG / Umniah parent)","مجموعة الاتصالات الأردنية","Fixed-line incumbent; ADSL & fibre broadband"),
    ("Transport","Royal Jordanian Airlines (RJ)","الملكية الأردنية","National carrier; Oneworld alliance member; 50+ destinations; HUB: AMM"),
    ("Transport","Queen Alia International Airport (AMM)","مطار الملكة علياء الدولي","Jordan's main hub; 12M+ passengers/year; Terminals 1 & 2; AIG operated"),
    ("Transport","Jordan Tourism Board (JTB)","هيئة تنشيط السياحة الأردنية","National tourism marketing body; Visit Jordan brand; international offices"),
]
n = w("21_government_institutions_curated.csv", headers, rows)
manifest.append(("21_government_institutions_curated.csv", "Govt Institutions – Curated", n, "48 key government entities: ministries, banks, telcos, utilities, transport"))

# ─────────────────────────────────────────────────────────────────
# 22  TOURISM ATTRACTIONS
# ─────────────────────────────────────────────────────────────────
headers = ["site","name_arabic","governorate","type","unesco_status",
           "highlights","best_time_to_visit","entry_fee_jod","visitor_tips"]
rows = [
    ("Petra","البتراء","Ma'an","Archaeological","Yes – Cultural (1985)",
     "New Seven Wonders of the World (2007); Rose-red Nabataean city (2nd c. BC); The Siq gorge; Al-Khazneh (Treasury); Ad Deir (Monastery); 800+ monuments; camel & horse rides",
     "March–May, September–November","50 JOD (1 day) / 55 JOD (2 days) / 60 JOD (3 days)",
     "Book Treasury sunrise tour in advance; hire a licensed guide (English/Arabic); wear comfortable flat shoes; Petra by Night show on Mon/Wed/Thu (17 JOD extra); avoid midday July–August heat"),
    ("Wadi Rum","وادي رم","Aqaba","Nature / Desert","Yes – Mixed (2011)",
     "Red sandstone & granite desert; Bedouin culture & hospitality; jeep safari tours; camel treks; sandboarding; rock climbing; hot air balloon; Bedouin overnight camp; exceptional stargazing; filming location: The Martian, Rogue One, Lawrence of Arabia",
     "March–May, September–November","5 JOD (bus entry from visitor centre)",
     "Book jeep tour & camp in advance especially for weekends; stay at least 1 night; minimum 4 hours for a good jeep tour; bring cash for camps and guides; sun protection essential"),
    ("Dead Sea","البحر الميت","Balqa (Sweimeh)","Nature / Wellness","No",
     "World's lowest point on Earth (−430 m below sea level); 9.6× saltier than ocean – you float effortlessly; mineral-rich black therapeutic mud; 10+ luxury beach resorts (Kempinski, Marriott, Movenpick, Dead Sea Spa); sunset views spectacular",
     "March–June, September–November (avoid July–August peak heat)","15–30 JOD (resort day pass incl. beach, pool & towels)",
     "Apply resort-provided sunscreen before entering (UV exposure intense); never splash water in eyes (extremely painful); rinse mud off quickly; book resort in advance on weekends; visit early morning or late afternoon"),
    ("Jerash","جرش","Jerash","Roman Archaeological","No (UNESCO nomination pending)",
     "'Pompeii of the East'; one of world's best-preserved Roman provincial cities; Hadrian's Arch (2nd c. AD); Oval Plaza; Cardo Maximus colonnaded street; Temple of Artemis; 6,000-seat South Theatre; chariot racing re-enactments (daily); Jerash Festival (July)",
     "All year; avoid midday July–August","10 JOD",
     "45 min from Amman; hire a guide at the entrance (negotiable); allow 2–3 hours; combine with Ajloun Castle (30 min away); buy replica Roman coins from vendors inside"),
    ("Wadi Mujib Biosphere Reserve","وادي الموجب","Madaba","Nature / Adventure Hiking","IUCN / MAB Biosphere Reserve",
     "Jordan's Grand Canyon; world's lowest nature reserve (−410 m); aquatic siq trail (wade through crystal-clear river gorge); canyoning; waterfall abseiling; cliff hiking; 420+ plant species; 180+ bird species; rock hyrax; wolves",
     "April–October (trails closed November–March – dangerous flooding)","21 JOD (siq trail) / 28 JOD (canyon trail)",
     "MUST book in advance at RSCN website; bring waterproof bag for phone; expect to get fully wet; not suitable for non-swimmers; life jackets provided; no hiking alone; start early morning"),
    ("Dana Biosphere Reserve","محمية ضانا","Tafilah","Eco-tourism / Nature","IUCN / MAB Biosphere Reserve",
     "Jordan's largest protected area (308 km²); 4 bio-geographic zones (Mediterranean, Irano-Turanian, Saharo-Arabian, Sudanian); historic Dana village (14th c.); Feynan Ecolodge (off-grid, solar-powered, no roads); 800+ plant species; 190+ bird species; Nubian ibex; sand cat; wolves; superb stargazing",
     "March–May, September–November","Free entry; guide recommended (30–50 JOD/day)",
     "Stay at Feynan Ecolodge for the complete eco-experience (book months in advance); hire local RSCN guide; multiple trails from 2h to 2-day overnight; Dana village guesthouse is also excellent"),
    ("Ajloun Castle (Qal'at al-Rabad)","قلعة عجلون","Ajloun","Islamic Fortress","No",
     "12th-century Islamic military fortress built 1184–1185 AD by Izz al-Din Usama (nephew of Saladin); designed to counter Crusader expansion; panoramic views over Jordan Valley, Ajloun forest & West Bank on clear days",
     "All year (closes 5 PM)","3 JOD",
     "1 hour from Amman; combine with Ajloun Forest Reserve hiking trails (RSCN); nearby Ajloun town has good local restaurants; buy local olive oil and hand-made soap"),
    ("Amman Citadel (Jabal al-Qal'a)","جبل القلعة","Amman","Multi-era Archaeological","No",
     "Continuously inhabited since Neolithic period (c. 7000 BC); Temple of Hercules (2nd c. AD – massive hand fragment survives); Byzantine church ruins; Umayyad Palace (8th c. AD); Jordan Archaeological Museum; stunning 360° Amman panorama",
     "All year (closes 5 PM winter, 7 PM summer)","3.5 JOD (includes Jordan Archaeological Museum)",
     "Free on Tuesdays (national policy); Jordan Museum is 10 min walk (different, newer museum); late afternoon light is best for photography; combine with Roman Theatre below"),
    ("Roman Theatre, Amman","المسرح الروماني","Amman","Roman Archaeological","No",
     "2nd-century AD theatre (built under Marcus Aurelius c. 169 AD); 6,000-seat capacity; 102 m wide; still used for concerts and performances; adjacent Odeon (500 seats); Folklore Museum and Popular Traditions Museum inside",
     "All year (closes 5 PM)","3.5 JOD (includes both museums)",
     "Downtown Amman walking distance from Rainbow Street; free on some national holidays; excellent acoustics – check if any concerts scheduled during your visit"),
    ("Mount Nebo","جبل نيبو","Madaba","Religious / Historical","No",
     "Where Moses viewed the Promised Land and died (Deuteronomy 34); Franciscan church (rebuilt 1933); exceptional 4th–6th century Byzantine floor mosaics; on a clear day: views of Dead Sea, Jordan River valley, Jerusalem and Bethlehem",
     "All year (closes 5 PM)","3 JOD",
     "45 min from Amman; combine with Madaba mosaic map (15 min away); best visibility on winter mornings; check Franciscan Custody website for opening hours"),
    ("Madaba Mosaic Map","خريطة مادبا","Madaba","Religious / Historical / Mosaic Art","No",
     "World's oldest surviving cartographic depiction of the Holy Land; 6th-century Byzantine mosaic (c. 560 AD); 2.3 million coloured tessera; shows Jerusalem, Nile Delta, Dead Sea, Jordan River, named cities from Egypt to Lebanon; inside functioning Greek Orthodox Church of St George",
     "All year (Sundays limited – church service)","2 JOD",
     "Madaba is known as 'City of Mosaics' – visit the Archaeological Park for more; Haret Jdoudna restaurant nearby for traditional lunch; combine with Mount Nebo (15 min away)"),
    ("Jordan Museum","المتحف الأردني","Amman","National Museum","No",
     "Jordan's premier national museum (opened 2014); Dead Sea Scrolls (on display); Ain Ghazal statues (c. 7500 BC – world's oldest large-scale human figures); Chalcolithic, Bronze Age, Iron Age, Nabataean, Roman, Byzantine, Islamic collections; state-of-the-art exhibits",
     "All year (closed Mondays; Fridays open from 10 AM)","4 JOD",
     "Plan 2–3 hours; excellent air-conditioning (great on hot days); gift shop has quality reproductions; near Amman Citadel (10 min walk)"),
    ("Aqaba Marine Reserve","محمية العقبة البحرية","Aqaba","Marine / Diving","ASEZA Protected Area",
     "Northern Red Sea; exceptional coral reef ecosystem; 1000+ species of fish; 350+ coral species; 6 dive sites accessible from shore; sea turtles year-round; glass-bottom boat tours; snorkelling; scuba diving; water temperature 20–27°C year-round",
     "Year-round (best April–June and September–November for visibility)","10 JOD (marine park entry)",
     "10+ dive centres in Aqaba town; easy snorkelling from beach with mask and fins; combine with ferry to Sinai or Eilat; post-dive camel ride on beach; Aqaba is 4 hours from Amman"),
    ("Baptism Site (Al-Maghtas / Bethany Beyond the Jordan)","الموقع الأثري المغطس","Balqa","Religious","Yes – Cultural (2015)",
     "Where Jesus was baptised by John the Baptist (all four Gospels + Roman historian Origen); Jordan River site; Byzantine and early Christian church remains; ongoing excavations revealing 1st–5th century layers; pilgrimage destination for 1M+ visitors/year",
     "All year (open 8 AM – 6 PM; Fridays 8 AM – 3 PM)","12 JOD (includes shuttle and guide)",
     "45 min from Amman; official guided tour mandatory (included in ticket); no photography near the actual baptism font (some areas); coordinate with nearby Dead Sea visit to make a full day trip; Pope Francis visited 2014"),
    ("Azraq Wetland Reserve","محمية الأزرق الرطبة","Zarqa","Nature / Birdwatching","Ramsar Wetland Convention Site",
     "Desert oasis in eastern Jordan; 1M+ migratory birds transit annually (cranes, pelicans, flamingos, storks); resident Black Iris (Jordan's national flower); 300+ recorded bird species; T.E. Lawrence (Lawrence of Arabia) used Azraq Castle as HQ in WWI; rare African species",
     "October–April for peak migration; all year for birdwatching","3 JOD",
     "RSCN managed; 90 min from Amman; binoculars essential; birdwatching hide available; combine with Azraq Castle and Qasr Amra (Umayyad desert castle, UNESCO) in same day trip"),
]
n = w("22_tourism_attractions_curated.csv", headers, rows)
manifest.append(("22_tourism_attractions_curated.csv", "Tourism Attractions – Curated", n, "15 major sites – UNESCO status, highlights, entry fees, best time to visit, visitor tips"))

# ─────────────────────────────────────────────────────────────────
# 23  MAJOR CORPORATIONS
# ─────────────────────────────────────────────────────────────────
headers = ["sector","company","founded","status_listing","description"]
rows = [
    ("Tech / Internet","Maktoob","1999","Acquired by Yahoo (2009, $165M)","Pioneer Arab internet portal (email, news, chat, sports); founded Amman by Samih Toukan & Hussam Khoury; paved the way for Jordan's startup ecosystem; Maktoob.com had 16.5M users at acquisition"),
    ("Tech / E-Commerce","Souq.com","2005","Acquired by Amazon (2017, ~$650M)","Arab world's largest e-commerce marketplace; co-founded by Jordanian Ronaldo Mouchawar; became Amazon.ae/Amazon.sa; operated in UAE, Saudi, Egypt; watershed moment for Arab tech investment"),
    ("Tech / Books","Jamalon","2010","Active – Private (Series B funded)","Arab world's largest online bookstore; HQ Amman; 10M+ Arabic & English titles; delivers to 22+ Arab countries; B2B and consumer channels"),
    ("Tech / Gaming","Tamatem Games","2013","Active – Private","Leading Arabic mobile game publisher; 25M+ lifetime downloads; HQ Amman; business model: localises hit global games for Arabic market; top titles: Baloot, VIP Jalsat"),
    ("Tech / Content","Mawdoo3","2011","Active – Private","Largest Arabic digital content platform; Wikipedia-like reference site; 100M+ monthly unique visitors; 5,000+ curated topics; based in Amman with distributed Arabic content team"),
    ("Tech / Animation","Kharabeesh","2007","Active – Private","Leading Arabic animation & digital content studio; political satire cartoons; YouTube presence 3M+ subscribers; produced content for Al Jazeera; HQ Amman"),
    ("Tech / Social","Jeeran","2000","Active – Private","Early Arab social network & local business directory (Yelp equivalent for Arab world); restaurant and venue reviews; HQ Amman; still operational"),
    ("Tech / Logistics","Aramex","1982","Public – ADX: ARMX","Global logistics & express courier; founded Amman by Fadi Ghandour; 600+ cities in 65+ countries; first Arab company listed on NASDAQ (1997); revenues ~$1.7B; acquired by Agility Logistics (2021)"),
    ("Tech / Payments","eFAWATEERcom","2014","Active – Central Bank of Jordan mandate","Jordan's national bill payment & presentment system; Central Bank backed; 700+ billers; 40+ bank integrations; handles government, utility, telecom, education payments"),
    ("Tech / Accelerator","Oasis500","2010","Active – Government & Private backed","Jordan's leading startup accelerator; 200+ startups funded; $25M invested; backed by King Abdullah II Fund for Development; portfolio includes Jamalon, Kharabeesh"),
    ("Tech / Accelerator","Endeavor Jordan","2004","Active – Global NGO","High-impact entrepreneur support network (global Endeavor); mentors scale-up companies; Jordan chapter has supported 30+ scale-up companies; access to global mentor network"),
    ("Tech / Accelerator","Plug and Play Jordan","2019","Active – Franchise","Silicon Valley-origin accelerator; Amman hub; connects Jordanian startups to global corporate partners; fintech, logistics, proptech focus"),
    ("Pharma","Hikma Pharmaceuticals","1978","Public – LSE: HIK","LSE-listed global pharmaceutical company; founded Amman by Samih Darwazah; manufactures branded & generic drugs + injectables; 30 countries; revenues $3B+; employs 8,000+; dual HQ London/Amman"),
    ("Pharma","Jordan Pharmaceutical Manufacturing (JPM)","1978","Active – Private","Leading Jordanian generic drug manufacturer; WHO & GMP certified; exports to 60+ countries across Arab world, Africa, Southeast Asia"),
    ("Pharma","Arab Pharmaceutical Manufacturing (APM)","1976","Active – Private","Another leading Jordan pharma exporter; GMP certified; specialises in antibiotics and chronic disease medications; exports to 60+ countries"),
    ("Healthcare","King Hussein Cancer Center (KHCC)","2003","Public Institution – Government","Jordan's premier specialised cancer hospital; JCI accredited (2006 – first in Arab world); serves patients from 70+ countries; affiliated with Johns Hopkins Medicine; stem cell transplant regional leader"),
    ("Healthcare","Royal Medical Services (RMS)","1950","Government / Jordan Armed Forces","Largest healthcare network in Jordan by bed count; military & dependants + some civilian services; runs King Hussein Medical Center (Amman's largest hospital)"),
    ("Mining","Jordan Phosphate Mines Co. (JPMC)","1953","Public – ASE: JOPH","3rd largest phosphate producer globally; 24M+ tons/year mining capacity; major national export earner (~$1B+/year); operates 3 mines (Eshidiya, Hasa, Wadi Abyad); JV with OCP Morocco for fertilisers"),
    ("Mining","Arab Potash Company (APC)","1956","Public – ASE: APOT","Extracts potash (MOP – Muriate of Potash) from Dead Sea evaporation pans; 2.5M ton/year capacity; one of world's top 10 potash producers; major global agricultural input supplier"),
    ("Energy","Jordan Petroleum Refinery Co. (JPRC)","1956","Public – ASE: JOPRC","Sole petroleum refinery in Jordan; Zarqa governorate; 100,000 bbl/day processing capacity; supplies ~80% of Jordan's refined fuel needs; produces LPG, gasoline, diesel, jet fuel"),
    ("Supermarket","Carrefour Jordan (MAF)","1999","Active – Franchise (Majid Al Futtaim)","Jordan's largest supermarket chain by store count; 10+ hypermarkets; anchor tenant at City Mall, Mecca Mall, Abdali Mall; part of MAF Retail network operating 400+ stores across MENA"),
    ("Supermarket","Safeway Jordan","1999","Active – Local ownership","Premium positioned supermarket; 5 west Amman branches; strong in expat and upper-middle-class communities; known for imported goods and fresh produce"),
    ("Supermarket","Cozmo (Lemongrass Group)","2010","Active – Private","Upscale grocery & gourmet supermarket; 10+ branches; trendy west Amman focus; known for international food brands, fresh pastries, sushi counters"),
    ("Retail Mall","City Mall","2005","Active","Largest mall in Jordan by GLA; Mecca Street Amman; 350+ stores; anchors: IKEA (Middle East's 3rd largest), Geant hypermarket, Zara, H&M, Marks & Spencer; 2 dedicated entertainment floors"),
    ("Retail Mall","Mecca Mall","1999","Active","Pioneer enclosed mall; Sweifieh, Amman; 220+ stores; Jordan's first major Western-style enclosed mall; anchor: Virgin Megastore, Zara, restaurants row"),
    ("Retail Mall","Taj Mall","2008","Active","Luxury-positioned mall; 7th Circle; 230+ stores; anchors: Carrefour, Cinescape (luxury cinema), premium fashion brands; upscale food court"),
    ("Retail Mall","Abdali Mall","2016","Active","Modern open-air + enclosed mixed-use mall in downtown Abdali development; sky bridges; 350+ stores; connected to Rotana Hotel and office towers"),
    ("Retail Mall","Avenue Mall","2021","Active","Newest large-format mall in South Amman (Sahab road); family-oriented; open-air sections; community mall model with hypermarket anchor"),
    ("Food Delivery","Talabat Jordan","2004","Active (Delivery Hero subsidiary)","Dominant food delivery app in Jordan; 3,000+ restaurant partners; grocery and pharmacy delivery (Talabat Mart); part of Delivery Hero operating across 70+ countries"),
    ("Ride-Hailing","Careem / Uber","2015 / 2016","Active (Uber acquired Careem 2019 for $3.1B)","Both Careem and Uber operate in Jordan; Careem dominant locally; Careem also offers Careem Pay, food delivery, bikes; employs 3,000+ drivers in Jordan"),
    ("Media","Roya TV","2010","Active – Private","Most-watched private TV channel in Jordan; news, entertainment, drama; digital presence; founded by businessman Fares Sayegh; covers Arab affairs and Jordan-specific content"),
    ("Airlines","Royal Jordanian (RJ)","1963","Public – ASE: RJAL","National flag carrier; Oneworld alliance member; serves 50+ destinations across Europe, Americas, Asia, Africa; HUB: Queen Alia International Airport (AMM); underwent restructuring 2020–2023"),
    ("Logistics","Aramex","1982","Public – ADX: ARMX","Already listed above under Tech/Logistics – also the flagship Jordanian logistics success story internationally"),
]
n = w("23_major_corporations_curated.csv", headers, rows)
manifest.append(("23_major_corporations_curated.csv", "Major Corporations – Curated", n, "33 key Jordanian companies – sector, founding year, status, detailed description"))

# ─────────────────────────────────────────────────────────────────
# 00  INDEX  (written last so row counts are accurate)
# ─────────────────────────────────────────────────────────────────
index_headers = ["file","sheet_name","row_count","description"]
index_rows = [list(m) for m in manifest]
path = OUT / "00_INDEX.csv"
with open(path, "w", newline="", encoding=ENC) as f:
    writer = csv.writer(f)
    writer.writerow(index_headers)
    writer.writerows(index_rows)
print(f"\n  00_INDEX.csv  ({len(manifest)} files listed)")

# ─────────────────────────────────────────────────────────────────
# Summary
# ─────────────────────────────────────────────────────────────────
total_rows = sum(m[2] for m in manifest)
print(f"\n✓  {len(manifest)+1} CSV files  →  {OUT}")
print(f"   Total data rows across all files: {total_rows:,}")
