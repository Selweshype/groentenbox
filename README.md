# Groentebox-kok

Upload een foto of de tekst van je groentebox-mail. Je krijgt een vegetarisch weekmenu dat alles uit je box opmaakt. Wat het snelst bederft, eet je eerst.

**Live site:** https://selweshype.github.io/groentenbox/

## Wat heb je nodig?

Een eigen **API-sleutel van Anthropic**. De site praat met Claude via die sleutel. Jij betaalt dus zelf het gebruik, per keer.

### Zo maak je een API-sleutel

1. Ga naar [console.anthropic.com](https://console.anthropic.com) en maak een account.
2. Ga naar **Billing** en zet er tegoed op. €5 is genoeg om te beginnen.
3. Ga naar **API Keys** en klik op **Create Key**.
4. Kopieer de sleutel. Je ziet hem maar één keer.

## Wat kost het?

Ongeveer, met prijzen van oktober 2026:

| Wat je doet | Model | Kosten per keer |
|---|---|---|
| Box uitlezen (foto of tekst) | Claude Haiku 5.5 | minder dan € 0,01 |
| Weekmenu maken | Claude Opus 5.5 | ongeveer € 0,05 tot € 0,15 |
| Eén "Ander recept" | Claude Haiku 5.5 | minder dan € 0,01 |

Dus: **één week koken kost meestal minder dan € 0,20.**
Je ziet je echte verbruik in de Anthropic Console onder **Usage**.

## Zo gebruik je de site

1. Open de site. Klik bovenaan op **Instellingen**.
2. Plak je API-sleutel en klik op **Sleutel opslaan**.
3. **Stap 1:** upload een foto van je bezorgmail, of plak de tekst. Klik op **Lees box uit**.
4. Klopt de lijst? Haal iets weg met **×** of voeg iets toe.
5. **Stap 2:** kies het aantal personen, avonden en de kooktijd. Vul in wat je nog in huis hebt.
6. Klik op **Maak weekmenu**. De recepten verschijnen één voor één.
7. **Stap 3:** zet recepten aan of uit. Niet blij met een recept? Klik op **Ander recept**.
8. Klik op **Kopieer lijst** voor je boodschappenlijst.

## Is mijn sleutel veilig?

- Je sleutel staat **alleen in jouw browser** (localStorage). Niet op een server, niet in deze code.
- De sleutel gaat alleen naar `api.anthropic.com`.
- Klaar of op een gedeelde computer? Klik op **Sleutel wissen**.
- Zet in de Anthropic Console een **maandlimiet** op je uitgaven. Dan weet je zeker dat het nooit veel kost.

## Foutmeldingen

| Melding | Wat doe je? |
|---|---|
| Je hebt nog geen API-sleutel ingevuld | Vul je sleutel in bij Instellingen. |
| Je API-sleutel klopt niet | Maak een nieuwe sleutel en plak die opnieuw. |
| Je tegoed is op / limiet bereikt | Zet tegoed bij in de Console, of wacht een minuut. |
| Geen verbinding | Controleer je internet. |

## Voor ontwikkelaars

- Gewone HTML, CSS en JavaScript in `/docs`. Geen build-stap, geen framework, geen server.
- `docs/api.js` is de enige plek die met de API praat. Bovenaan staan de modellen.
- Lokaal testen: `python3 -m http.server -d docs` en open `http://localhost:8000`.
- Online via GitHub Pages: branch `main`, map `/docs`.
