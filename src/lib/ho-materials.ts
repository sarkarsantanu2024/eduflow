/**
 * Head Office material/kit catalogue — the items a center buys from HO and sells
 * to parents after adding a margin. `hoPrice` is what the center pays HO (its
 * cost). Seeded from the HO price list; can move to a super-admin-managed table
 * later when HO needs to add/edit items itself.
 */
export interface HoMaterial {
  name: string;
  hoPrice: number; // rupees the center pays Head Office
}

export const HO_MATERIALS: HoMaterial[] = [
  // Kits
  { name: "Junior Kids 1 Kit", hoPrice: 830 },
  { name: "Junior Kids 2 Kit", hoPrice: 830 },
  { name: "Senior Basic Kit", hoPrice: 830 },
  { name: "Senior Level 1 Kit", hoPrice: 830 },
  { name: "Vedic L1 Kit", hoPrice: 700 },
  // Books
  { name: "Kids 1 Book", hoPrice: 165 },
  { name: "Kids 2 Book", hoPrice: 165 },
  { name: "Kids 3 Book", hoPrice: 165 },
  { name: "Basic Book", hoPrice: 200 },
  { name: "Level 1 Book", hoPrice: 220 },
  { name: "Level 2 Book", hoPrice: 220 },
  { name: "Level 3 Book", hoPrice: 200 },
  { name: "Level 4 Book", hoPrice: 200 },
  { name: "Level 5 Book", hoPrice: 200 },
  { name: "Level 6 Book", hoPrice: 200 },
  { name: "Level 7 Book", hoPrice: 200 },
  { name: "Level 8 Book", hoPrice: 200 },
  { name: "Vedic Level 1 Book", hoPrice: 200 },
  { name: "Vedic Level 2 Book", hoPrice: 200 },
  { name: "Vedic Level 3 Book", hoPrice: 200 },
  { name: "Vedic Level 4 Book", hoPrice: 200 },
  // Apparel & bags
  { name: "T-Shirt (22 to 34)", hoPrice: 250 },
  { name: "T-Shirt (36 to 40)", hoPrice: 280 },
  { name: "Abacus Bag", hoPrice: 200 },
  { name: "Vedic Bag", hoPrice: 250 },
  // Tools
  { name: "Abacus", hoPrice: 100 },
  { name: "Master Abacus", hoPrice: 2000 },
  // Cards & stationery
  { name: "Report Card", hoPrice: 10 },
  { name: "Fees Card", hoPrice: 10 },
  { name: "I-Card", hoPrice: 20 },
  { name: "Note Book", hoPrice: 30 },
  { name: "Monthly Paper", hoPrice: 0 },
  { name: "Level Competition Paper", hoPrice: 0 },
  { name: "Certificate", hoPrice: 0 },
  { name: "Fees Book", hoPrice: 0 },
  { name: "Admission Form", hoPrice: 0 },
  { name: "Others Stationery", hoPrice: 0 },
];
