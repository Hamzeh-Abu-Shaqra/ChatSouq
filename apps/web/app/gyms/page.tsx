import CategoryPage from "../_category/CategoryPage";

export default function GymsPage() {
  return (
    <CategoryPage
      category="gyms"
      displayName="Gyms & Fitness"
      heading="The best gyms in Amman"
      subtext="140+ gyms, studios, and fitness centres across Amman — filtered by location, type, and what you actually need."
      aiInsight="West Amman (Abdoun, Sweifieh, Khalda) has the highest density of premium gyms. Ladies-only options are widely available. Many offer free first-day trials."
      subcategories={["All", "With pool", "Ladies only", "CrossFit", "Yoga", "Personal training"]}
      icon="💪"
      count="140+"
    />
  );
}
