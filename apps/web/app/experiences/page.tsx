import CategoryPage from "../_category/CategoryPage";

export default function ExperiencesPage() {
  return (
    <CategoryPage
      category="experiences"
      displayName="Experiences"
      heading="Things to do in Amman"
      subtext="From rooftop dinners to hiking trails — the best experiences in Amman, curated and explained."
      aiInsight="Amman's experience scene mixes old and new — ancient ruins minutes from coffee shops. Souk Jara runs every Friday in summer; Rainbow Street is always alive on weekends."
      subcategories={["All", "Date night", "Family", "Outdoor", "Cultural", "Food tours"]}
      icon="🎭"
      count="80+"
    />
  );
}
