# Changelog

All notable changes to this integration are documented in this file. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project
uses [semantic versioning](https://semver.org/).

Describe each change under `## [Unreleased]` as you make it. The Release
workflow moves that section under the version it ships, and the section becomes
the notes of the version's GitHub Release.

## [Unreleased]

### Added

- RomM in Gladys: one device per server with online, platforms, games, library
  size, games without metadata and last game added, read every 1 to 10 minutes.
- Sign-in with a RomM client API token, or a username and password.
- Scene triggers: a game added (filter on the platform) and a scan finished,
  each announced once, even after a restart.
- Scene actions: scan the library (new games, games without metadata, or
  everything; RomM 5.4 or later) and read the latest games as a sentence.
- Dashboard widget: games, platforms, games without metadata, scan in progress,
  latest games added and a Scan button, each block can be hidden.
- Texts and documentation in English, French, German and Spanish.
