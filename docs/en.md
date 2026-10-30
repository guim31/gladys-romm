# RomM

Bring your [RomM](https://romm.app) server (the self-hosted manager of your
retro game library) into Gladys, over your local network: the games, the
platforms, the size of the library, the games still without metadata, the
latest games added on a dashboard, scenes that react when a new game arrives or
when a scan is finished, and a scene action to scan the library.

The integration was tested against a real RomM 5.4.1 (the official Docker
image, with homebrew games), not yet in a real Gladys installation: feedback is
welcome on the [Gladys forum](https://community.gladysassistant.com) or in the
[issues](https://github.com/guim31/gladys-romm/issues).

## What you need

- Gladys Assistant 5.1.0 or later.
- A **RomM** server reachable from Gladys (same network), on the port of its web
  interface (`8080` by default). RomM 5.4 or later to start a scan from Gladys.
- A way to sign in, one of the two:
  - **recommended**, a **client API token**: in RomM, open your profile, then
    **Client API tokens**, create a token with the scopes **View ROMs**, **View
    platforms** and, to see and start the scans, **Run tasks** (an admin
    account), and copy it (it starts with `rmm_`);
  - or the **username** and **password** of a RomM user (an admin to see and
    start the scans).

## Set up

1. Install the integration from the Gladys catalog.
2. In **Configuration**, enter the **Address** of RomM (for example
   `192.168.1.2:8080`; without a port, `8080` is used), then the **Client API
   token**, or the **Username** and **Password**.
3. Save, then click **Test the connection**: the message under the button gives
   the version of RomM, the games and the size of the library, the platforms and
   the games without metadata.
4. Open the **Discover** tab: one device for the server. Click **Add**, pick a
   room and save.

Options:

- **Refresh interval**: 1 to 10 minutes (2 minutes by default). Each refresh is
  five small requests to the API of RomM.
- **Language of the feature names**: the names given to the features when the
  device is added (French by default) and the sentences of the scene actions.

The integration reads RomM. It changes something only when you ask for it: the
**Scan** button of the widget and the **Scan the RomM library** scene action.

## The device

One device, **RomM** followed by the address of the server:

| Feature                | What it gives                                     |
| ---------------------- | ------------------------------------------------- |
| Online                 | 1 when RomM answers, 0 otherwise                  |
| Platforms              | platforms with games in the library               |
| Games                  | games in the library                              |
| Library size           | size of the game files on disk, in GB             |
| Games without metadata | games RomM could not match with a metadata source |
| Last game added        | its name and its platform, as text                |

The figures move at each refresh.

## Dashboard

The **RomM** widget shows three tiles (games, platforms, games without
metadata), the scan in progress with its progress, the list of the latest games
added (name, platform and date), and a **Scan** button that starts a quick scan
(new games only).

Add it from the dashboard editor. Settings: the number of games in the list (3,
5 or 8), and a switch to hide the tiles and one to hide the button. It works
before the device is added.

## Scenes

### Triggers

- **RomM game added**: a new game appeared in the RomM library (after a scan or
  an upload). Filter: **Platform** (the name of the platform exactly as RomM
  shows it, for example `Game Boy Advance`; empty: any). Information passed on
  to the actions: the name of the game, its platform, its file name, the link to
  the game in RomM, and the number of games in the library. While RomM is still
  fetching the metadata of a game, the event waits for its final name (30
  minutes at most).
- **RomM scan finished**: a scan of the library is over, whoever started it
  (Gladys, the web interface of RomM, its schedule). Information: the scan type
  as RomM names it (`Quick Scan`…), the new games, the games identified and the
  games scanned (as RomM counts them), the games in the library and the
  duration in minutes. Needs an account that can see the tasks (admin, or a
  token with **Run tasks**).

Each event is announced once, even after a restart of the integration. What
RomM already had when the integration started is not announced.

### Actions

- **Scan the RomM library**: starts a scan, like the **Scan** button of RomM.
  Option **What to scan**: **New games only (quick)** (by default), **Games
  without metadata** (to retry the metadata sources) or **Whole library
  (complete, slow)**. Needs RomM 5.4 or later and an admin account (or a token
  with **Run tasks**). A scan already running makes the action fail.
- **Read the latest RomM games**: reads RomM now and gives a sentence for a
  message or a voice announcement, such as “RomM: 152 games on 6 platforms.
  Latest added: Tobu Tobu Girl (Game Boy), …”, with the figures separately
  (games, platforms, games without metadata, name and platform of the last game
  added). Option: the number of games named in the sentence (3 by default).

### Scene ideas

- Every night at 3 am, scan the RomM library; when the scan is finished with
  new games, send yourself a message “{new_games} new game(s) in RomM”.
- When a game is added on the **Game Boy Advance** platform, notify the
  children: “New game: {name}”.
- On Saturday morning, read the latest RomM games and announce the sentence on
  the living room speaker.

## Troubleshooting

- **“RomM does not answer”**: check the address and the port (`8080`), and
  that Gladys can reach the server (same network, firewall).
- **“RomM refused the sign-in”**: copy the client API token again (a token can
  expire or be revoked), or check the username and password.
- **“This account cannot read the games”**: the token lacks the scopes **View
  ROMs** and **View platforms**: create a new one with them.
- **“A scan needs an admin account”**: the user is not an admin, or the token
  lacks **Run tasks**. The games are still read; **RomM scan finished** does
  not fire.
- **“Starting a scan from Gladys needs RomM 5.4 or later”**: update RomM; older
  versions start a scan only from their web interface.
- **“No RomM at this address”**: another service answers on this port.
- **“The address redirects”**: a reverse proxy sends to a login page or to
  HTTPS; enter the direct address of RomM on your network.
- More details: set the `LOG_LEVEL` of the integration to `debug` and open its
  logs.

## Limits

- The figures and the events are as fresh as the refresh interval.
- Only the 10 newest games are compared at each refresh: beyond 10 new games at
  once (a whole folder copied), the games are counted, not all announced.
- The figures of **RomM scan finished** are those of RomM, which may count
  fewer games than were really added.
- No game cover in the widget: the covers of RomM need a sign-in the dashboard
  does not have.
- The integration was written for the API of RomM 5 (tested on 5.4.1): a future
  version that changes it may need an update.
- Not affiliated with RomM.
