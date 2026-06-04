# Club crests

**No asset work needed.** Club logos are loaded directly from API-Football's media CDN:

```
https://media.api-sports.io/football/teams/<team_id>.png
```

This CDN serves logos as public PNGs with no API key required.

## How the lookup works

`web/components/icons/crest.tsx` holds a hardcoded map of club name → API-Football team ID for the 11 clubs in our roster:

| Club | API-Football ID |
|---|---|
| Real Madrid | 541 |
| Man United | 33 |
| PSG | 85 |
| Atlético Madrid | 530 |
| Arsenal | 42 |
| Inter Miami | 1616 |
| Liverpool | 40 |
| Tottenham | 47 |
| Galatasaray | 645 |
| Fenerbahçe | 611 |
| Al-Hilal | 2932 |

If the network is down, the ID is wrong, or the image 404s, the Crest component falls back to a small shield with the club's initials (e.g., `RM` for Real Madrid). No layout break.

## Adding a new club

1. Look up the team at [api-football.com](https://www.api-football.com/) → copy its numeric ID
2. Add an entry to `CLUB_ID` in `web/components/icons/crest.tsx`
3. The crest loads automatically

## Overriding with a local SVG (optional)

This folder is currently unused. If you want to override a specific crest
with your own SVG (e.g., to dodge trademark concerns), the cleanest path is
to extend `crest.tsx` to check for a local file first — ask Claude to wire that in.

## Attribution

Team data and logos via [API-Football](https://www.api-football.com/) ·
served from `media.api-sports.io`.
