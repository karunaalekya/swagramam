import { ITEMS, CATS } from "./menu-data.js";
export { CATS, ITEMS };
export const BY_SKU = new Map(ITEMS.map(i => [i.sku, i]));
export const BY_KEY = new Map(ITEMS.map(i => [i.k, i]));
export const publicMenu = () => ITEMS.filter(i => i.available).map(({ sku, k, name, cat, veg, meal, priceMinor }) => ({ sku, k, name, cat, veg, meal, priceMinor }));
