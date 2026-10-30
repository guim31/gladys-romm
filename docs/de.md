# RomM

Bring deinen [RomM](https://romm.app)-Server (die selbst gehostete Verwaltung
deiner Retro-Spielebibliothek) über dein lokales Netzwerk in Gladys: die
Spiele, die Plattformen, die Größe der Bibliothek, die Spiele noch ohne
Metadaten, die zuletzt hinzugefügten Spiele auf einem Dashboard, Szenen, die auf
ein neues Spiel oder das Ende eines Scans reagieren, und eine Szenenaktion zum
Scannen der Bibliothek.

Die Integration wurde mit einem echten RomM 5.4.1 getestet (das offizielle
Docker-Image, mit Homebrew-Spielen), noch nicht in einer echten
Gladys-Installation: Rückmeldungen sind im
[Gladys-Forum](https://community.gladysassistant.com) oder in den
[Issues](https://github.com/guim31/gladys-romm/issues) willkommen.

## Was du brauchst

- Gladys Assistant 5.1.0 oder neuer.
- Einen **RomM**-Server, den Gladys erreicht (gleiches Netzwerk), auf dem Port
  seiner Weboberfläche (standardmäßig `8080`). RomM 5.4 oder neuer, um einen
  Scan aus Gladys zu starten.
- Eine Anmeldung, eine der beiden:
  - **empfohlen**, ein **Client-API-Token**: Öffne in RomM dein Profil, dann
    **Client API tokens**, erstelle ein Token mit den Rechten **View ROMs**,
    **View platforms** und, um die Scans zu sehen und zu starten, **Run tasks**
    (Admin-Konto), und kopiere es (es beginnt mit `rmm_`);
  - oder **Benutzername** und **Passwort** eines RomM-Benutzers (ein Admin, um
    die Scans zu sehen und zu starten).

## Einrichtung

1. Installiere die Integration aus dem Gladys-Katalog.
2. Gib unter **Konfiguration** die **Adresse** von RomM ein (zum Beispiel
   `192.168.1.2:8080`; ohne Port wird `8080` verwendet), dann das
   **Client-API-Token** oder **Benutzername** und **Passwort**.
3. Speichere und klicke auf **Verbindung testen**: Die Meldung unter der
   Schaltfläche nennt die Version von RomM, die Spiele und die Größe der
   Bibliothek, die Plattformen und die Spiele ohne Metadaten.
4. Öffne den Tab **Entdecken**: ein Gerät für den Server. Klicke auf
   **Hinzufügen**, wähle einen Raum und speichere.

Optionen:

- **Aktualisierungsintervall**: 1 bis 10 Minuten (standardmäßig 2 Minuten). Jede
  Aktualisierung sind fünf kleine Anfragen an die API von RomM.
- **Sprache der Funktionsnamen**: die Namen der Funktionen beim Hinzufügen des
  Geräts (standardmäßig Französisch) und die Sätze der Szenenaktionen.

Die Integration liest RomM. Etwas ändert sie nur, wenn du es verlangst: die
Schaltfläche **Scannen** des Widgets und die Szenenaktion **RomM-Bibliothek
scannen**.

## Das Gerät

Ein Gerät, **RomM** gefolgt von der Adresse des Servers:

| Funktion                    | Was sie liefert                                         |
| --------------------------- | ------------------------------------------------------- |
| Online                      | 1, wenn RomM antwortet, sonst 0                         |
| Plattformen                 | Plattformen mit Spielen in der Bibliothek               |
| Spiele                      | Spiele in der Bibliothek                                |
| Größe der Bibliothek        | Größe der Spieldateien auf der Festplatte, in GB        |
| Spiele ohne Metadaten       | Spiele, die RomM keiner Metadatenquelle zuordnen konnte |
| Zuletzt hinzugefügtes Spiel | sein Name und seine Plattform, als Text                 |

Die Zahlen ändern sich bei jeder Aktualisierung.

## Dashboard

Das Widget **RomM** zeigt drei Kacheln (Spiele, Plattformen, Spiele ohne
Metadaten), den laufenden Scan mit seinem Fortschritt, die Liste der zuletzt
hinzugefügten Spiele (Name, Plattform und Datum) und eine Schaltfläche
**Scannen**, die einen schnellen Scan startet (nur neue Spiele).

Füge es im Dashboard-Editor hinzu. Einstellungen: die Anzahl der Spiele in der
Liste (3, 5 oder 8), ein Schalter zum Ausblenden der Kacheln und einer zum
Ausblenden der Schaltfläche. Es funktioniert schon vor dem Hinzufügen des
Geräts.

## Szenen

### Auslöser

- **Spiel in RomM hinzugefügt**: Ein neues Spiel ist in der RomM-Bibliothek
  erschienen (nach einem Scan oder Upload). Filter: **Plattform** (der Name der
  Plattform, genau wie RomM ihn anzeigt, zum Beispiel `Game Boy Advance`; leer:
  beliebig). An die Aktionen weitergegebene Informationen: der Name des Spiels,
  seine Plattform, sein Dateiname, der Link zum Spiel in RomM und die Anzahl der
  Spiele in der Bibliothek. Solange RomM noch die Metadaten eines Spiels sucht,
  wartet das Ereignis auf seinen endgültigen Namen (höchstens 30 Minuten).
- **RomM-Scan beendet**: Ein Scan der Bibliothek ist beendet, egal wer ihn
  gestartet hat (Gladys, die Weboberfläche von RomM, ihr Zeitplan).
  Informationen: der Scan-Typ, wie RomM ihn nennt (`Quick Scan`…), die neuen,
  die erkannten und die gescannten Spiele (von RomM gezählt), die Spiele in der
  Bibliothek und die Dauer in Minuten. Braucht ein Konto, das die Aufgaben sieht
  (Admin oder Token mit **Run tasks**).

Jedes Ereignis wird nur einmal gemeldet, auch nach einem Neustart der
Integration. Was RomM beim Start der Integration schon hatte, wird nicht
gemeldet.

### Aktionen

- **RomM-Bibliothek scannen**: startet einen Scan wie die Schaltfläche **Scan**
  von RomM. Option **Was scannen**: **Nur neue Spiele (schnell)** (Standard),
  **Spiele ohne Metadaten** (um die Metadatenquellen erneut zu versuchen) oder
  **Ganze Bibliothek (vollständig, langsam)**. Braucht RomM 5.4 oder neuer und
  ein Admin-Konto (oder ein Token mit **Run tasks**). Läuft schon ein Scan,
  schlägt die Aktion fehl.
- **Neueste RomM-Spiele lesen**: liest RomM sofort und liefert einen Satz für
  eine Nachricht oder Sprachansage, etwa „RomM: 152 Spiele auf 6 Plattformen.
  Zuletzt hinzugefügt: Tobu Tobu Girl (Game Boy), …“, mit den Zahlen getrennt
  (Spiele, Plattformen, Spiele ohne Metadaten, Name und Plattform des zuletzt
  hinzugefügten Spiels). Option: die Anzahl der im Satz genannten Spiele
  (standardmäßig 3).

### Szenenideen

- Jede Nacht um 3 Uhr die RomM-Bibliothek scannen; wenn der Scan mit neuen
  Spielen beendet ist, dir eine Nachricht schicken: „{new_games} neue(s)
  Spiel(e) in RomM“.
- Wenn ein Spiel auf der Plattform **Game Boy Advance** hinzugefügt wird, die
  Kinder benachrichtigen: „Neues Spiel: {name}“.
- Am Samstagmorgen die neuesten RomM-Spiele lesen und den Satz über den
  Lautsprecher im Wohnzimmer ansagen.

## Fehlerbehebung

- **„RomM antwortet nicht“**: Prüfe die Adresse und den Port (`8080`) und ob
  Gladys den Server erreicht (gleiches Netzwerk, Firewall).
- **„RomM hat die Anmeldung abgelehnt“**: Kopiere das Client-API-Token erneut
  (ein Token kann ablaufen oder widerrufen werden) oder prüfe Benutzername und
  Passwort.
- **„Dieses Konto kann die Spiele nicht lesen“**: Dem Token fehlen die Rechte
  **View ROMs** und **View platforms**: Erstelle ein neues mit diesen Rechten.
- **„Ein Scan braucht ein Admin-Konto“**: Der Benutzer ist kein Admin oder dem
  Token fehlt **Run tasks**. Die Spiele werden weiter gelesen; **RomM-Scan
  beendet** löst nicht aus.
- **„Einen Scan aus Gladys zu starten braucht RomM 5.4 oder neuer“**:
  Aktualisiere RomM; ältere Versionen starten einen Scan nur aus ihrer
  Weboberfläche.
- **„Kein RomM unter dieser Adresse“**: Ein anderer Dienst antwortet auf diesem
  Port.
- **„Die Adresse leitet um“**: Ein Reverse-Proxy leitet auf eine Anmeldeseite
  oder auf HTTPS um; gib die direkte Adresse von RomM in deinem Netzwerk ein.
- Mehr Details: Setze das `LOG_LEVEL` der Integration auf `debug` und öffne ihre
  Protokolle.

## Grenzen

- Die Zahlen und die Ereignisse sind so frisch wie das Aktualisierungsintervall.
- Nur die 10 neuesten Spiele werden bei jeder Aktualisierung verglichen: Bei
  mehr als 10 neuen Spielen auf einmal (ein ganzer Ordner kopiert) werden die
  Spiele gezählt, aber nicht alle gemeldet.
- Die Zahlen von **RomM-Scan beendet** sind die von RomM, das weniger Spiele
  zählen kann, als wirklich hinzugekommen sind.
- Kein Cover im Widget: Die Cover von RomM brauchen eine Anmeldung, die das
  Dashboard nicht hat.
- Die Integration ist für die API von RomM 5 geschrieben (getestet mit 5.4.1):
  Eine künftige Version, die sie ändert, kann ein Update erfordern.
- Nicht mit RomM verbunden.
