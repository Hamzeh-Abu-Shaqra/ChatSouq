import CategoryPage from "../_category/CategoryPage";

export default function GiftsPage() {
  return (
    <CategoryPage
      category="gifts"
      displayName="Gifts"
      heading="The best gifts in Amman"
      subtext="For every occasion — Eid, birthdays, weddings, and more. 30,000+ products from Jordan's top vendors."
      aiInsight="Amman's gift scene ranges from handcrafted local artisan pieces to international brands. Describe the recipient and budget — ChatSouq finds the right fit."
      subcategories={["All", "Birthday", "Eid", "Wedding", "Corporate", "Flowers", "Personalised"]}
      icon="🎁"
      count="30,000+"
    />
  );
}
