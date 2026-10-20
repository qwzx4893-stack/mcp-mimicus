/** Relevant RFC9309 matching: exact product groups, URI octets and bounded glob
 * matching. Source rules never become executable regular expressions. */
function uriOctets(value: string) {
  let result = '';
  for (let i = 0; i < value.length; ) {
    const encoded = value.slice(i, i + 3);
    if (/^%[0-9a-f]{2}$/i.test(encoded)) {
      const byte = String.fromCharCode(Number.parseInt(encoded.slice(1), 16));
      result += /^[a-z0-9._~-]$/i.test(byte) ? byte : encoded.toUpperCase();
      i += 3;
    } else {
      const point = value.codePointAt(i)!,
        character = String.fromCodePoint(point);
      result +=
        point > 127
          ? [...Buffer.from(character)]
              .map((b) => '%' + b.toString(16).toUpperCase().padStart(2, '0'))
              .join('')
          : character;
      i += character.length;
    }
  }
  return result;
}
function matches(pattern: string, target: string) {
  const anchored = pattern.endsWith('$'),
    glob = anchored ? pattern.slice(0, -1) : pattern;
  let p = 0,
    t = 0,
    star = -1,
    retry = 0;
  while (t < target.length) {
    if (p === glob.length && !anchored) return true;
    if (glob[p] === '*') {
      star = p++;
      retry = t;
      continue;
    }
    if (glob[p] === target[t]) {
      p++;
      t++;
      continue;
    }
    if (star >= 0) {
      p = star + 1;
      t = ++retry;
      continue;
    }
    return false;
  }
  while (glob[p] === '*') p++;
  return p === glob.length;
}
export function robotsAllowed(text: string, path: string, productToken = 'mcp-mimicus') {
  const groups: {
    agents: string[];
    rules: { allow: boolean; path: string }[];
    ruleSeen: boolean;
  }[] = [];
  let group: (typeof groups)[number] | undefined;
  for (const raw of text.split(/\r?\n/)) {
    const match = raw
      .split('#')[0]!
      .trim()
      .match(/^([\w-]+)\s*:\s*(.*)$/);
    if (!match) continue;
    const name = match[1]!.toLowerCase(),
      value = match[2]!.trim();
    if (name === 'user-agent') {
      if (!group || group.ruleSeen) {
        group = { agents: [], rules: [], ruleSeen: false };
        groups.push(group);
      }
      group.agents.push(value.toLowerCase());
    } else if (group && (name === 'allow' || name === 'disallow')) {
      // An empty rule still ends the user-agent header sequence.
      group.ruleSeen = true;
      if (value.startsWith('/'))
        group.rules.push({ allow: name === 'allow', path: uriOctets(value) });
    }
  }
  const specific = groups.filter((g) => g.agents.includes(productToken.toLowerCase()));
  const active = specific.length ? specific : groups.filter((g) => g.agents.includes('*'));
  const target = uriOctets(path);
  let best = -1,
    allowed = true;
  for (const rule of active.flatMap((g) => g.rules)) {
    if (!matches(rule.path, target)) continue;
    const specificity = rule.path.replace(/\*/g, '').replace(/\$$/, '').length;
    if (specificity > best || (specificity === best && rule.allow)) {
      best = specificity;
      allowed = rule.allow;
    }
  }
  return allowed;
}
