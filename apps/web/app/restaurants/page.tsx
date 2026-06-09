import CategoryPage from "../_category/CategoryPage";

export default function RestaurantsPage() {
  return (
    <CategoryPage
      category="restaurants"
      displayName="Restaurants"
      heading="The best restaurants in Amman"
      subtext="From authentic Jordanian mansaf to international cuisine — find where to dine tonight, ranked by what matters."
      aiInsight="Amman's dining scene is growing fast. Weibdeh and Rainbow Street lead for independent restaurants; Abdoun and Sweifieh for upscale dining."
      subcategories={["All", "Jordanian", "Lebanese", "Italian", "Seafood", "Cafes", "Fast food"]}
      icon="🍽"
      count="1,200+"
    />
  );
}
