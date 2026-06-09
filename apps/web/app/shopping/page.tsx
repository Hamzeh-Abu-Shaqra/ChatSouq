import CategoryPage from "../_category/CategoryPage";

export default function ShoppingPage() {
  return (
    <CategoryPage
      category="shopping"
      displayName="Shopping"
      heading="The best shopping in Amman"
      subtext="500+ stores and boutiques — from malls to independent concept stores. Find exactly what you're looking for."
      aiInsight="Mecca Street and Abdali lead for malls and international brands. Weibdeh and Rainbow Street are the destination for independent boutiques and concept stores."
      subcategories={["All", "Fashion", "Electronics", "Home", "Sports", "Books"]}
      icon="🛍"
      count="500+"
    />
  );
}
