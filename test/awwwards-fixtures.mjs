export const ROOT = 'https://www.awwwards.com/websites/';
export const groups = {
  Awards: [
    ['Sites of the Day', 'sites_of_the_day'],
    ['Honorable Mention', 'honorable'],
  ],
  Category: [
    ['Culture & Education', 'culture-education'],
    ['Architecture', 'architecture'],
  ],
  Tag: [
    ['Animation', 'animation'],
    ['Clean', 'clean'],
  ],
  Technology: [
    ['WebGL', 'webgl'],
    ['GSAP', 'gsap-animation'],
  ],
  Country: [['United States', 'United%20States']],
  Font: [['Aeonik', 'Aeonik']],
};
export const taxonomyHtml = Object.entries(groups)
  .map(
    ([label, values]) =>
      `<li><span class="nav-filters__item">${label.replaceAll('&', '&amp;')}</span><ul>${values.map(([text, slug]) => `<a class="nav-filters__subitem" href="/websites/${slug}/">${text.replaceAll('&', '&amp;')}</a>`).join('')}</ul></li>`,
  )
  .join('');
export const card = (id, tags = ['Animation', 'WebGL', 'Culture & Education']) => {
  const meta = JSON.stringify({
    id,
    slug: 'site-' + id,
    title: 'Original ' + id,
    tags,
    createdAt: 1792454400,
    type: 'submission',
    images: { thumbnail: 'must-not-be-imported.png' },
  })
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;');
  return `<li data-collectable-model-value="${meta}"><a href="/sites/site-${id}" class="figure-rollover__link"></a><a href="https://original${id}.example/" class="figure-rollover__bt"></a><h3 class="avatar-name__title">Maker ${id}</h3><span class="budget-tag budget-tag--sotd"></span></li>`;
};
export const listing = (ids, next) =>
  `<main>${taxonomyHtml}<ul>${ids.map((id) => card(id)).join('')}</ul>${next ? `<a class="pagination__next" href="${next}">Next</a>` : ''}</main>`;
export const detail = (id) =>
  `<main><a data-visit-count-type-value="submission" href="https://original${id}.example/">Visit Site</a><div class="list-tags"><a href="/websites/webgl/">WebGL</a></div></main>`;
