-- Post-seed category correction pass.
-- Run this after seed.ts completes. The running seed uses an older compiled
-- taxonomy; this script applies all STRONG_NAME_RULES patterns via SQL so the
-- live DB matches the current taxonomy.ts without a full re-seed.
--
-- Usage: psql "$DATABASE_URL" -f fix-categories.sql

BEGIN;

-- 1. Luggage brands wrongly tagged on beauty/general vendor sites.
UPDATE listings SET category = 'Bags & Luggage'
WHERE name ~* '\y(samsonite|rimowa|delsey|american tourister|carlton|antler|briggs|tumi)\y';

-- 2. Unambiguous luggage product types.
UPDATE listings SET category = 'Bags & Luggage'
WHERE category != 'Bags & Luggage'
  AND (name ~* '\ysuitcase\y' OR name ~* '\btrolley\s*(bag|luggage)\b' OR name ~* '\bspinner\s*(luggage|suitcase|bag|\d+)\b');

-- 3. Planners and agendas (often sold on beauty/lifestyle sites).
UPDATE listings SET category = 'Stationery & Office'
WHERE name ~* '\y(mofkera|agenda|day\s*planner)\y';

-- 4. Bath and home textiles.
UPDATE listings SET category = 'Home & Living'
WHERE name ~* '\y(bath\s+towel|guest\s+towel|bath\s+sheet|bath\s+mat|face\s+cloth)\y';

-- 5. Baby consumables (avoid "Baby Skin" makeup primers — requires compound match).
UPDATE listings SET category = 'Baby & Kids'
WHERE name ~* '\bbaby\s+(wipes?|bottle|formula|powder|food|soap|diaper|nappy|rash)\b';

UPDATE listings SET category = 'Baby & Kids'
WHERE name ~* '\b(feeding\s+bottle|nappy\s+rash)\b';

-- 6. Gift cards and gift-service utilities — should never appear as product picks.
UPDATE listings SET category = 'Home & Living'
WHERE name ~* '\bgift\s*(cards?|vouchers?|certificates?)\b';

UPDATE listings SET category = 'Home & Living'
WHERE name ~* '\bgift\s*(wrap(ping)?|blocks?)\b';

UPDATE listings SET category = 'Home & Living'
WHERE name ILIKE '%(e-card)%' OR name ILIKE '%(ecard)%';

-- 7. Dental / oral care products.
UPDATE listings SET category = 'Health & Wellness'
WHERE name ~* '\b(toothbrush(\s+head)?|toothpaste|dental\s+floss|mouthwash|oral-b|oral\s+b)\b';

-- 8. Vitamins and supplements.
UPDATE listings SET category = 'Health & Wellness'
WHERE name ~* '\b(vitamin\s+[a-z0-9]+|supplement|omega.?3|collagen\s+supplement|probiotic|multivitamin)\b';

-- Report changes
SELECT category, count(*) AS count
FROM listings
GROUP BY category
ORDER BY count DESC;

COMMIT;
