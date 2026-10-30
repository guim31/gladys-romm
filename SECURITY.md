# Security policy

## Reporting a vulnerability

Please do **not** report a security problem in a public issue, pull request or
forum post.

Report it privately through GitHub instead: open the **Security** tab of this
repository, then **Report a vulnerability**.

No such button? Private reporting is not enabled yet: open an issue that only
asks the maintainers for a private contact, without any detail of the problem,
and send the report there.

Include, when you can:

- the version of the integration and of Gladys;
- what an attacker can do, and the steps to reproduce it;
- the log lines that help (remove tokens, passwords and addresses first).

The fix ships as a new version of the integration, and the advisory is
published once users can update.

## Supported versions

Only the latest release receives security fixes: update the integration from
Gladys before reporting a problem.

## Scope

In scope: the code of this repository and the Docker image it publishes.

What the integration handles:

- The client API token, or the username and password of RomM, stored by Gladys
  in the configuration of the integration. They are sent only to the RomM
  server you configured, in the `Authorization` header (Bearer or HTTP Basic),
  never in a URL and never in the logs. Prefer a token limited to the scopes
  **View ROMs**, **View platforms** and **Run tasks**.
- Under `/data`: the address of the server, and the ids of the games and scans
  already announced. No secret.
- Network: HTTP(S) requests to the RomM server only. The only write is a scan
  of the library, when the user asks for it. No inbound port.

Out of scope: Gladys Assistant itself (see its
[security policy](https://github.com/GladysAssistant/Gladys/security/policy)),
and RomM itself (see its
[security policy](https://github.com/rommapp/romm/security/policy)).
