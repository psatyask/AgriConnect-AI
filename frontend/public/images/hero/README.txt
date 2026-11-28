Hero pictures shown on the home page. The app uses the optimised .webp files in this folder (about 1400 px wide, under 300 KB).
Full-size originals are kept in frontend/hero-src/ (not served to visitors).

To add a picture: put the original in hero-src/, save a ~1400 px .webp here, add it to the country list in
src/regions/in.ts or us.ts (heroImages), and add its description to the hero.alts strings.
These pictures look AI-generated, so descriptions say "Illustration". Keep the licence note for any real photo you add.
