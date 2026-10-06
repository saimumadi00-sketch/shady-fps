# Local assets

- `yard-map.svg`: the active lobby map thumbnail, copied into the production build.
- `maps/freedm/`: original map source, BSD license and contributor credits. The playable adaptation is generated in `src/maps/freedm-dm01.js`; reproduce it with `npm run import:conquest-map`.

The lobby environment and squad are rendered locally from `src/world.js` and `src/characters.js`. Third-party license notices are in `../THIRD_PARTY_NOTICES.md`.
