import { readFileSync } from 'node:fs';
import { join } from 'node:path';

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
}

export function loadEntries(root) {
  const collections = {};
  for (const collection of ['publications', 'projects']) {
    const path = join(root, 'src/data', `${collection}.json`);
    let entries;
    try { entries = JSON.parse(readFileSync(path, 'utf8')); }
    catch (error) { throw new Error(`${collection}.json: ${error.message}`); }
    if (!Array.isArray(entries)) throw new Error(`${collection}.json must contain an array.`);
    const ids = new Set();
    entries.forEach((entry, index) => {
      const context = `${collection}.json entry ${index + 1}`;
      function require(condition, message) {
        if (!condition) throw new Error(`${context}: ${message}`);
      }
      function string(object, key, optional = false) {
        require(optional && object[key] === undefined ||
          typeof object[key] === 'string' && object[key].trim().length > 0,
        `${key} must be a nonempty string.`);
      }
      require(entry && typeof entry === 'object' && !Array.isArray(entry), 'must be an object.');
      string(entry, 'id');
      require(/^[a-z0-9-]+$/.test(entry.id) && !ids.has(entry.id), 'id must be unique and use lowercase letters, numbers, or hyphens.');
      ids.add(entry.id);
      string(entry, 'title');
      if (collection === 'projects') string(entry, 'descriptionHtml');
      string(entry, 'highlight', true);
      require(typeof entry.enabled === 'boolean', 'enabled must be true or false.');
      require(Array.isArray(entry.links), 'links must be an array.');
      for (const link of entry.links) {
        require(link && typeof link === 'object', 'each link must be an object.');
        string(link, 'label');
        string(link, 'url');
      }
      const peopleKey = collection === 'publications' ? 'authors' : 'contributors';
      require(Array.isArray(entry[peopleKey]) && entry[peopleKey].length > 0, `${peopleKey} must be a nonempty array.`);
      for (const person of entry[peopleKey]) {
        require(person && typeof person === 'object', `each ${peopleKey} item must be an object.`);
        string(person, 'name');
        string(person, 'url', true);
        require(person.bold === undefined || typeof person.bold === 'boolean', 'bold must be true or false.');
      }
      if (collection === 'publications') {
        require(entry.venue && typeof entry.venue === 'object', 'venue must be an object.');
        string(entry.venue, 'name');
        string(entry.venue, 'location', true);
        string(entry.venue, 'place', true);
      }
    });
    collections[collection] = entries;
  }
  return collections;
}

function personHtml(person, className) {
  const name = escapeHtml(person.name);
  const content = person.bold ? `<strong>${name}</strong>` : name;
  return person.url
    ? `<a class="${className} group-text" href="${escapeHtml(person.url)}">${content}</a>`
    : `<span class="${className} group-text">${content}</span>`;
}

function linksHtml(links) {
  return links.map(({ label, url }) =>
    `<span class="group-text">[ <a class="tag" href="${escapeHtml(url)}">${escapeHtml(label)}</a> ]</span>`
  ).join('\n');
}

function cardHtml(entry, publication = false) {
  const content = [`<div class="title">${escapeHtml(entry.title)}</div>`];
  if (entry.highlight && !publication) content.push(`<div class="authors"><span style="color: #9b3022; font-style: italic">${escapeHtml(entry.highlight)}</span></div>`);
  if (entry.authors) content.push(`<div class="authors">${entry.authors.map((person) => personHtml(person, 'author')).join(', ')}</div>`);
  // Project descriptions are trusted, repository-authored HTML so inline links
  // remain intact. All other text and attribute values are escaped.
  if (entry.descriptionHtml) content.push(`<div class="desc"><p>${entry.descriptionHtml}</p></div>`);
  const tags = `<div class="tags">\n${linksHtml(entry.links)}\n</div>`;
  if (!publication) content.push(tags);
  if (entry.venue) {
    const venue = [`<span class="publisher">${escapeHtml(entry.venue.name)}</span>`];
    if (entry.venue.location) {
      const location = publication ? entry.venue.location.replace(/^in\s+/, '') : entry.venue.location;
      venue.push(`<span class="status">${escapeHtml(location)}</span>`);
    }
    if (entry.venue.place) venue.push(`<span class="place">${escapeHtml(entry.venue.place)}</span>`);
    const separator = publication ? '<span class="publication-separator" aria-hidden="true"> · </span>' : ' ';
    content.push(`<div class="publish">${venue.join(separator)}</div>`);
  }
  if (publication) {
    if (entry.highlight) content.push(`<div class="publication-highlight">${escapeHtml(entry.highlight)}</div>`);
    content.push(tags);
  }
  if (entry.contributors) {
    const people = entry.contributors.map((person) => personHtml(person, 'contributor')).join('<span style="font-weight: 400">, </span>');
    content.push(`<div class="contribute">Contributors: ${people}</div>`);
  }
  return `<div class="pub">\n  <div class="pub-right">\n${content.map((line) => line.split('\n').map((part) => '    ' + part).join('\n')).join('\n')}\n  </div>\n</div>`;
}

function citationHtml(entry) {
  let citation = `${escapeHtml(entry.title)}.`;
  if (entry.authors) {
    const names = entry.authors.map(({ name }) => escapeHtml(name));
    const authors = names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names.at(-1)}` : names[0];
    citation = `${authors}. “${escapeHtml(entry.title)}.” ${escapeHtml(entry.venue.name)}.`;
  }
  return `<li>\n  <span class="fa-li" style="top: -0.2em"><i class="fas fa-circle" style="font-size: 0.5em"></i></span>\n  ${citation}\n${linksHtml(entry.links).split('\n').map((line) => '  ' + line).join('\n')}\n</li>`;
}

export function renderEntries(collections, name) {
  const sitemap = name.endsWith('-sitemap');
  const collection = sitemap ? name.slice(0, -8) : name;
  if (!Object.hasOwn(collections, collection)) throw new Error(`Unknown entries collection: ${name}`);
  return collections[collection].filter((entry) => entry.enabled)
    .map((entry) => sitemap ? citationHtml(entry) : cardHtml(entry, collection === 'publications')).join('\n\n');
}
