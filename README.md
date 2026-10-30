# RomM for Gladys Assistant

A [Gladys Assistant](https://gladysassistant.com) external integration for
[RomM](https://romm.app), the self-hosted manager of your retro game library:
the games and platforms of your library on a device and a dashboard widget,
scenes that react when a new game arrives or when a scan is finished, and a
scene action to scan the library.

Tested against a real RomM 5.4.1 (the official Docker image, homebrew games),
not yet in a real Gladys installation: feedback welcome on the
[Gladys forum](https://community.gladysassistant.com) or in the
[issues](https://github.com/guim31/gladys-romm/issues).

## What it does

- **One device** per RomM server: online, platforms, games, size of the
  library, games without metadata, last game added.
- **Dashboard widget**: games, platforms and games without metadata, the scan in
  progress, the latest games added (name, platform, date), a **Scan** button.
- **Scene triggers**: a game added (filter on the platform), a scan finished
  (whoever started it), with their details as variables.
- **Scene actions**: scan the library (new games, games without metadata, or
  everything), and read the latest games as a sentence for a message or a
  voice announcement.
- Four languages: English, French, German, Spanish.

## Requirements

- Gladys Assistant 5.1.0 or later.
- RomM reachable from Gladys on the local network (port `8080` by default);
  RomM 5.4 or later to start a scan from Gladys.
- A RomM client API token (scopes **View ROMs**, **View platforms**, and **Run
  tasks** for the scans), or the username and password of a RomM user (an admin
  for the scans).

## Installation

In Gladys, open **Integrations → Install from GitHub** and enter
`https://github.com/guim31/gladys-romm`, or install it from the catalog. Then
follow the documentation: [English](docs/en.md), [Français](docs/fr.md),
[Deutsch](docs/de.md), [Español](docs/es.md).

## How it works

The container reads the REST API of RomM at the interval chosen (2 minutes by
default): the heartbeat, the statistics, the ten newest games, the count of
games without metadata and the task list. It publishes only what changed (and
every value again within 12 hours), and remembers under `/data` the games and
scans already announced, so a restart announces nothing twice. The device is
published with `should_poll: false`: Gladys does not poll it, the container's
own timer does. The only write is the scan, when you ask for it
(`POST /api/tasks/scan`).

## Limits

- Ten newest games compared per refresh: a bigger batch is counted, not all
  announced.
- The figures of a finished scan are RomM's own counters.
- No game cover in the widget (RomM serves them behind its sign-in).
- Written for the API of RomM 5 (tested on 5.4.1).

## Development

```bash
npm ci
npm run format:check && npm run lint && npm test
npx -y github:GladysAssistant/integration-store --skip-image-check .
```

The tests run against the fake Gladys of the SDK and an in-memory RomM that
answers with the shape of the real API (`test/fixtures/romm/`, recorded from
RomM 5.4.1). See [`CLAUDE.md`](CLAUDE.md) for the architecture and the
pitfalls.

## Credits

- [RomM](https://github.com/rommapp/romm) by zurdi15, gantoine and its
  contributors (AGPL-3.0). The logo of the cover comes from its official
  repository
  ([`.github/resources/isotipo.svg` and `logotipo.svg`](https://github.com/rommapp/romm/tree/master/.github/resources)).
  No code of RomM is copied: the integration only calls its API.
- Built on the official
  [integration template](https://github.com/GladysAssistant/integration-template-js)
  and SDK of Gladys Assistant; structure adapted from
  [gladys-tubearchivist](https://github.com/guim31/gladys-tubearchivist).

Not affiliated with RomM. Licensed under the [Apache License 2.0](LICENSE).
