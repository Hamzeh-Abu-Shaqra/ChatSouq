import CategoryPage from "../_category/CategoryPage";

export default function SalonsPage() {
  return (
    <CategoryPage
      category="salons"
      displayName="Salons & Beauty"
      heading="The best salons in Amman"
      subtext="200+ salons, nail bars, and beauty studios — from everyday haircuts to bridal packages."
      aiInsight="Abdoun and Sweifieh lead for high-end beauty salons. Weibdeh and Rainbow Street have a growing independent salon scene with competitive pricing."
      subcategories={["All", "Ladies", "Gents", "Nail", "Hair", "Bridal"]}
      icon="✂️"
      count="200+"
    />
  );
}
