# GowriAI Website

Static website deployed through GitHub Pages. Run `make serve` to preview at
http://localhost:8000. No build step is required.

## Updating the Portfolio

Product, capability, and leadership cards are served directly in `index.html`
so visitors and crawlers can read them with JavaScript disabled.

When adding or editing a product:

1. Update its article in `#initiative-grid`, including the link, preview, description, and tags.
2. Update the corresponding `hasOfferCatalog.itemListElement` entry in the JSON-LD near the top of `index.html`.
3. Update its entry in `llms.txt`, keeping the name, URL, description, and order consistent.
4. Add any preview image under `assets/images/initiatives/` and check `git diff --check`.

Keep the page description, social descriptions, organization description, and hero
copy aligned with the portfolio. `llms.txt` is supplementary documentation;
the HTML remains the primary source of public content.
