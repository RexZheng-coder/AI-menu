const allergenAliases: Record<string, string> = {
  dairy: "dairy",
  milk: "dairy",
  cheese: "dairy",
  lactose: "dairy",
  cream: "dairy",
  butter: "dairy",
  egg: "egg",
  eggs: "egg",
  gluten: "gluten",
  wheat: "gluten",
  flour: "gluten",
  pasta: "gluten",
  bread: "gluten",
  peanut: "peanut",
  peanuts: "peanut",
  tree_nut: "tree_nut",
  tree_nuts: "tree_nut",
  nut: "tree_nut",
  nuts: "tree_nut",
  almond: "tree_nut",
  almonds: "tree_nut",
  walnut: "tree_nut",
  walnuts: "tree_nut",
  pecan: "tree_nut",
  pecans: "tree_nut",
  cashew: "tree_nut",
  cashews: "tree_nut",
  pistachio: "tree_nut",
  pistachios: "tree_nut",
  macadamia: "tree_nut",
  macadamias: "tree_nut",
  hazelnut: "tree_nut",
  hazelnuts: "tree_nut",
  shellfish: "shellfish",
  crustacean: "shellfish",
  crustaceans: "shellfish",
  shrimp: "shellfish",
  prawn: "shellfish",
  prawns: "shellfish",
  crab: "shellfish",
  lobster: "shellfish",
  mollusk: "mollusk",
  mollusks: "mollusk",
  mollusc: "mollusk",
  molluscs: "mollusk",
  clam: "mollusk",
  clams: "mollusk",
  mussel: "mollusk",
  mussels: "mollusk",
  oyster: "mollusk",
  oysters: "mollusk",
  scallop: "mollusk",
  scallops: "mollusk",
  fish: "fish",
  seafood: "seafood",
  soy: "soy",
  soybean: "soy",
  soya: "soy",
  tofu: "soy",
  sesame: "sesame",
  mustard: "mustard",
  celery: "celery",
  sulfite: "sulfite",
  sulfites: "sulfite",
  coconut: "coconut",
};

const allergenLabelsZh: Record<string, string> = {
  dairy: "奶制品",
  egg: "蛋类",
  gluten: "麸质",
  peanut: "花生",
  tree_nut: "坚果",
  shellfish: "甲壳类",
  mollusk: "贝类",
  fish: "鱼类",
  seafood: "海鲜",
  soy: "大豆",
  sesame: "芝麻",
  mustard: "芥末",
  celery: "芹菜",
  sulfite: "亚硫酸盐",
  coconut: "椰子",
};

export function normalizeAllergen(value: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");

  return allergenAliases[normalized] ?? normalized;
}

export function normalizeAllergens(values: string[]): string[] {
  return Array.from(
    new Set(
      values
        .map(normalizeAllergen)
        .filter((value) => value.length > 0),
    ),
  );
}

export function getAllergenLabelZh(allergen: string): string {
  const normalized = normalizeAllergen(allergen);
  return allergenLabelsZh[normalized] ?? allergen.trim();
}
