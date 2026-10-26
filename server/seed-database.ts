import { db } from "./db";
import { recipes, families, weeklyTargets } from "../shared/schema";
import { hashPassword } from "./auth-middleware";

async function seedDatabase() {
  console.log("Seeding database with families and sample recipes...");

  // First, create families
  console.log("Creating families...");
  // SEED_FAMILIES="Family Name:password,Other Family:password2" - never hard-code real passwords
  const familiesList = (process.env.SEED_FAMILIES || "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const idx = entry.lastIndexOf(":");
      return { name: entry.slice(0, idx).trim(), password: entry.slice(idx + 1).trim() };
    })
    .filter((family) => family.name && family.password);

  const createdFamilies = [];
  for (const family of familiesList) {
    try {
      const result = await db.insert(families).values({ ...family, password: await hashPassword(family.password) }).returning();
      createdFamilies.push(result[0]);
      console.log(`Created family: ${family.name}`);
    } catch (error) {
      console.log(`Family ${family.name} may already exist, skipping...`);
    }
  }

  // Create default weekly targets for each family
  console.log("Creating weekly targets for families...");
  for (const family of createdFamilies) {
    try {
      await db.insert(weeklyTargets).values({
        familyId: family.id,
        dailyCalories: 2000,
        dailyProtein: 150,
        dailyCarbs: 250,
        dailyFats: 67,
      });
      console.log(`Created weekly targets for ${family.name}`);
    } catch (error) {
      console.log(`Weekly targets for ${family.name} may already exist, skipping...`);
    }
  }

  const sampleRecipes = [
    {
      name: "Berry Protein Bowl",
      description: "Greek yogurt with mixed berries and granola",
      imageUrl: "https://images.unsplash.com/photo-1511690743698-d9d85f2fbf38",
      calories: 420,
      protein: 25,
      carbs: 45,
      fats: 12,
      mealTypes: ["breakfast"],
      maxWeeklyUses: 3,
      isAiSuggested: false,
      isApproved: true,
    },
    {
      name: "Avocado Toast",
      description: "Whole grain toast with avocado and poached egg",
      imageUrl: "https://images.unsplash.com/photo-1541519227354-08fa5d50c44d",
      calories: 380,
      protein: 18,
      carbs: 32,
      fats: 22,
      mealTypes: ["breakfast"],
      maxWeeklyUses: 3,
      isAiSuggested: false,
      isApproved: true,
    },
    {
      name: "Grilled Chicken Salad",
      description: "Mixed greens with grilled chicken and vegetables",
      imageUrl: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd",
      calories: 520,
      protein: 45,
      carbs: 25,
      fats: 22,
      mealTypes: ["lunch"],
      maxWeeklyUses: 3,
      isAiSuggested: false,
      isApproved: true,
    },
    {
      name: "Turkey & Hummus Wrap",
      description: "Whole wheat wrap with turkey, hummus, and veggies",
      imageUrl: "https://images.unsplash.com/photo-1565299624946-b28f40a0ca4b",
      calories: 450,
      protein: 32,
      carbs: 38,
      fats: 18,
      mealTypes: ["lunch"],
      maxWeeklyUses: 3,
      isAiSuggested: false,
      isApproved: true,
    },
    {
      name: "Trail Mix",
      description: "Mixed nuts and dried fruit",
      imageUrl: "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b",
      calories: 280,
      protein: 8,
      carbs: 24,
      fats: 20,
      mealTypes: ["snack"],
      maxWeeklyUses: 4,
      isAiSuggested: false,
      isApproved: true,
    },
    {
      name: "Greek Yogurt & Berries",
      description: "Protein-rich Greek yogurt with fresh berries",
      imageUrl: "https://images.unsplash.com/photo-1488477181946-6428a0291777",
      calories: 180,
      protein: 15,
      carbs: 20,
      fats: 4,
      mealTypes: ["snack"],
      maxWeeklyUses: 4,
      isAiSuggested: false,
      isApproved: true,
    },
    {
      name: "Salmon & Quinoa",
      description: "Grilled salmon with quinoa and asparagus",
      imageUrl: "https://images.unsplash.com/photo-1467003909585-2f8a72700288",
      calories: 650,
      protein: 45,
      carbs: 48,
      fats: 28,
      mealTypes: ["dinner"],
      maxWeeklyUses: 3,
      isAiSuggested: false,
      isApproved: true,
    },
    {
      name: "Chicken Stir Fry",
      description: "Chicken breast with mixed vegetables and brown rice",
      imageUrl: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd",
      calories: 580,
      protein: 42,
      carbs: 52,
      fats: 18,
      mealTypes: ["dinner"],
      maxWeeklyUses: 3,
      isAiSuggested: false,
      isApproved: true,
    },
  ];

  try {
    // Check if recipes already exist
    const existingRecipes = await db.select().from(recipes).limit(1);
    
    if (existingRecipes.length === 0) {
      await db.insert(recipes).values(sampleRecipes);
      console.log(`Successfully seeded ${sampleRecipes.length} recipes!`);
    } else {
      console.log("Database already contains recipes, skipping seed.");
    }
  } catch (error) {
    console.error("Error seeding database:", error);
  }
}

// Run the seed function
seedDatabase();